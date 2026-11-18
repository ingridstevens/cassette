import os
import re
import subprocess
import wave
from pathlib import Path

import numpy as np


def ffmpeg_exe() -> str:
    if os.environ.get("FFMPEG_BIN"):
        return os.environ["FFMPEG_BIN"]
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def decode(src: str, dst: Path, start: float | None = None, end: float | None = None) -> None:
    """Decode/trim any media file to 16 kHz mono 16-bit wav."""
    cmd = [ffmpeg_exe(), "-y", "-v", "error"]
    if start:
        cmd += ["-ss", str(start)]
    cmd += ["-i", src]
    if end is not None:
        cmd += ["-t", str(end - (start or 0))]
    cmd += ["-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(dst)]
    subprocess.run(cmd, check=True, capture_output=True)


PEAK_RATE = 8000  # Hz: plenty for a waveform picture
_PEAK_BLOCK = 80  # samples per fine block (10 ms); the requested points are folded from these


def peaks(src: str, points: int = 8000) -> tuple[list[float], float]:
    """A waveform for the window without decoding the recording there: the largest |sample| (0..1) in each of `points` equal slices, and the duration in seconds.
    ffmpeg decodes to 8 kHz mono and the output is read in chunks, so a long recording never sits in memory (only one number per 10 ms is kept)."""
    proc = subprocess.Popen(
        [ffmpeg_exe(), "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", str(PEAK_RATE), "-f", "s16le", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )
    assert proc.stdout is not None
    blocks: list[np.ndarray] = []
    carry = b""
    total = 0
    while True:
        raw = proc.stdout.read(1 << 20)
        if not raw:
            break
        raw = carry + raw
        usable = len(raw) - len(raw) % (2 * _PEAK_BLOCK)  # whole blocks only; the rest waits for the next chunk
        carry = raw[usable:]
        if usable:
            data = np.frombuffer(raw[:usable], dtype="<i2")
            blocks.append(np.abs(data.astype(np.int32)).reshape(-1, _PEAK_BLOCK).max(axis=1).astype(np.int16))
            total += usable // 2
    if proc.wait() != 0:
        raise RuntimeError("The audio could not be read from this file")
    tail = np.frombuffer(carry[: len(carry) - len(carry) % 2], dtype="<i2")
    if len(tail):
        blocks.append(np.array([np.abs(tail.astype(np.int32)).max()], dtype=np.int16))
        total += len(tail)
    if not total:
        raise RuntimeError("The recording has no audio")
    fine = np.concatenate(blocks)
    points = max(1, min(int(points), len(fine)))
    edges = np.linspace(0, len(fine), points, endpoint=False).astype(np.int64)
    folded = np.maximum.reduceat(fine, edges)
    return [round(float(v) / 32768.0, 4) for v in folded], total / PEAK_RATE


def clip(src: str, dst: str, start: float, end: float) -> None:
    """Export a trimmed audio clip, re-encoded to match the destination extension."""
    subprocess.run(
        [ffmpeg_exe(), "-y", "-v", "error", "-ss", str(start), "-i", src, "-t", str(end - start), "-vn", dst],
        check=True, capture_output=True,
    )


def _safe(text: str, limit: int = 40) -> str:
    """A piece of a file name: no path separators or characters Windows and macOS refuse."""
    return re.sub(r"\s+", " ", re.sub(r'[\\/:*?"<>|\x00-\x1f]', " ", text)).strip(" .")[:limit]


def export_clips(src: str, out_dir: str, clips: list[dict], fmt: str = "mp3", pad: float = 0.3, on_progress=lambda f: None) -> list[str]:
    """One audio file per clip ({start, end, speaker?, text?}) in `out_dir`, named `01 - Anna - 2m05s.mp3` so they sort in the order they occur.
    `pad` seconds of room are added on both sides so a quote does not start or stop mid-breath. Returns the paths written."""
    if fmt not in ("mp3", "wav", "m4a"):
        raise RuntimeError(f"Unsupported audio format: {fmt}")
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    width = max(2, len(str(len(clips))))
    paths = []
    for n, c in enumerate(clips, 1):
        on_progress((n - 1) / max(len(clips), 1))
        start = max(0.0, c["start"] - pad)
        mins, secs = divmod(int(c["start"]), 60)
        name = " - ".join(p for p in (str(n).zfill(width), _safe(c.get("speaker", "")), f"{mins}m{secs:02d}s") if p) + "." + fmt
        dst = str(Path(out_dir) / name)
        codec = {"mp3": ["-c:a", "libmp3lame", "-q:a", "2"], "m4a": ["-c:a", "aac", "-b:a", "192k"], "wav": ["-c:a", "pcm_s16le"]}[fmt]
        subprocess.run([ffmpeg_exe(), "-y", "-v", "error", "-ss", str(start), "-i", src, "-t", str(c["end"] + pad - start), "-vn", *codec, dst], check=True, capture_output=True)
        paths.append(dst)
    on_progress(1.0)
    return paths


def load_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as f:
        sr = f.getframerate()
        data = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16)
    return data.astype(np.float32) / 32768.0, sr
