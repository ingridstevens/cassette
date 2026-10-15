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
