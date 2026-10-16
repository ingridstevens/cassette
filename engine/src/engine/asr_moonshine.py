"""Moonshine speech models (Moonshine AI), behind the same small interface as faster-whisper's WhisperModel.

Small, quick models that each know ONE language. Only the streaming models are offered: they are MIT-licensed in every language
(the non-streaming models for languages other than English are non-commercial, and are left out). Unlike every other model in
this app they are NOT downloaded from Hugging Face but from Moonshine's own server (download.moonshine.ai), by the moonshine-voice
package, into a folder of their own inside the models folder. They give timing per line, not per word: word times are estimated.
Like Parakeet they cannot detect the language themselves; a Whisper model helps when one is downloaded.
"""
import contextlib
import importlib.util
import io
import platform
import shutil
import sys
import types
from functools import lru_cache
from pathlib import Path

from .asr_mlx import SAMPLE_RATE, chunk_bounds

PREFIX = "moonshine-"
SOURCE = "download.moonshine.ai"
CHUNK_SECONDS = 300.0  # the audio is handed over as a Python list, so long recordings go in pieces to keep memory small
STREAMING = ("TINY_STREAMING", "BASE_STREAMING", "SMALL_STREAMING", "MEDIUM_STREAMING")


def available() -> bool:
    """True on an Apple Silicon Mac where moonshine-voice is installed."""
    return sys.platform == "darwin" and platform.machine() == "arm64" and importlib.util.find_spec("moonshine_voice") is not None


def cache_root() -> Path:
    from .models import models_dir

    return models_dir() / "moonshine"


@lru_cache(maxsize=1)
def catalog() -> dict[str, dict]:
    """{model id: {language, name, arch, bytes}} for every language that has a streaming (MIT) model. Read from the installed package, no network."""
    if not available():
        return {}
    import moonshine_voice.download as d

    out = {}
    for code, info in d._stt_catalog().items():
        default = next((m for m in info["models"] if m["is_default"]), info["models"][0])
        if default["model_arch"].name not in STREAMING:
            continue
        group = d._primary_stt_group(d.find_model_info(code, default["model_arch"]))
        out[PREFIX + code] = {"language": code, "name": info["english_name"], "arch": default["model_arch"].name,
                              "bytes": sum(f["size"] for f in group["files"]), "files": [(f["name"], f["size"]) for f in group["files"]],
                              "base_url": group["base_url"]}
    return out


def _folder(spec: dict) -> Path:
    return cache_root() / spec["base_url"].replace("https://", "")


def cached(model_id: str) -> bool:
    spec = catalog().get(model_id)
    if not spec:
        return False
    d = _folder(spec)
    return all((d / name).is_file() and (d / name).stat().st_size == size for name, size in spec["files"])


def size_on_disk(model_id: str) -> int:
    spec = catalog().get(model_id)
    return sum(f.stat().st_size for f in _folder(spec).glob("*")) if spec and _folder(spec).is_dir() else 0


def download(model_id: str) -> None:
    from .protocol import log, progress

    spec = catalog().get(model_id)
    if not spec:
        raise RuntimeError(f"Unknown Moonshine model: {model_id}")
    import moonshine_voice as mv

    log(f"Downloading {model_id} from {SOURCE} (Moonshine's own server, not Hugging Face) into {cache_root()}")
    with contextlib.redirect_stderr(io.StringIO()):  # the package prints a licence note for every non-English language; it does not apply to streaming models
        mv.get_model_for_language(spec["language"], getattr(mv.ModelArch, spec["arch"]), cache_root=cache_root(),
                                  on_progress=lambda fraction, name: progress("download", min(float(fraction), 0.99), model_id))
    log(f"Finished {model_id}. It is stored locally and works offline from now on.")


def delete(model_id: str) -> None:
    spec = catalog().get(model_id)
    if spec:
        shutil.rmtree(_folder(spec), ignore_errors=True)


def spread_words(text: str, start: float, duration: float) -> list[dict]:
    """Moonshine times whole lines. Gives each word a share of the line's time in proportion to its length, so words can be matched to speakers."""
    words = text.split()
    if not words:
        return []
    total = sum(len(w) + 1 for w in words)
    out, t = [], start
    for w in words:
        span = duration * (len(w) + 1) / total
        out.append({"start": t, "end": t + span, "word": " " + w, "prob": 1.0})
        t += span
    return out


class MoonshineModel:
    is_multilingual = False

    def __init__(self, model_id: str, helper=None):
        self.spec, self.helper, self.id = catalog()[model_id], helper, model_id
        self.language = self.spec["language"]
        self._tr = None

    def _transcriber(self):
        if self._tr is None:
            import moonshine_voice as mv
            from moonshine_voice.transcriber import Transcriber

            self._tr = Transcriber(str(_folder(self.spec)), getattr(mv.ModelArch, self.spec["arch"]))
        return self._tr

    def detect_language(self, audio, **kw):
        """From the helper Whisper model when there is one. Without: this model's own language at probability 0, which no caller treats as a finding."""
        if self.helper is not None:
            return self.helper.detect_language(audio, **kw)
        return self.language, 0.0, [(self.language, 0.0)]

    def transcribe(self, audio, language=None, word_timestamps=True, vad_filter=False, initial_prompt=None,
                   condition_on_previous_text=False, multilingual=False, task="transcribe", **_ignored):
        """Returns (segments, info) shaped like faster-whisper's. `initial_prompt`, `vad_filter` and `multilingual` are not available here."""
        if task == "translate":
            if self.helper is None:
                raise RuntimeError("Translation into English needs a Whisper model. Download one in Settings, Storage and models, or turn translation off.")
            return self.helper.transcribe(audio, language=language, task="translate", condition_on_previous_text=False)
        if language not in (None, self.language):
            raise RuntimeError(f"This Moonshine model is for {self.spec['name']}, not “{language}”. Pick the Moonshine model for that language, or a Whisper model.")
        tr = self._transcriber()

        def run():
            for lo, hi in chunk_bounds(audio, CHUNK_SECONDS, 8.0):
                shift = lo / SAMPLE_RATE
                for line in tr.transcribe_without_streaming(audio[lo:hi].tolist(), SAMPLE_RATE).lines:
                    if not line.text.strip():
                        continue
                    start = line.start_time + shift
                    words = spread_words(line.text, start, line.duration)
                    yield types.SimpleNamespace(
                        start=start, end=start + line.duration, text=line.text,
                        words=[types.SimpleNamespace(start=w["start"], end=w["end"], word=w["word"], probability=w["prob"]) for w in words])

        return run(), types.SimpleNamespace(language=self.language, language_probability=1.0)
