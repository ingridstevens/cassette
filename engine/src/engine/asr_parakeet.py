"""NVIDIA Parakeet TDT v3 on the Apple GPU (MLX), behind the same small interface as faster-whisper's WhisperModel.

Fast and accurate for 25 European languages, but it has no language detection and no translation. Both are borrowed from a Whisper
model when one is given (`helper`); without one, the language must be chosen by the user. Apple Silicon Macs only.
"""
import importlib
import importlib.util
import platform
import sys
import types

from .asr_mlx import SAMPLE_RATE, chunk_bounds

# The languages Parakeet TDT 0.6B v3 supports (model card: nvidia/parakeet-tdt-0.6b-v3).
LANGUAGES = "bg hr cs da nl en et fi fr de el hu it lv lt mt pl pt ro sk sl es sv ru uk".split()
CHUNK_SECONDS = 120.0  # Parakeet copes with long stretches; its memory use grows with them


def available() -> bool:
    """True on an Apple Silicon Mac where parakeet-mlx is installed."""
    return sys.platform == "darwin" and platform.machine() == "arm64" and importlib.util.find_spec("parakeet_mlx") is not None


def group_words(tokens) -> list[dict]:
    """Parakeet works in word pieces; a piece that starts with a space starts a new word. Returns {start, end, word, prob}."""
    words: list[dict] = []
    for tok in tokens:
        text = tok.text
        if words and not text.startswith(" "):
            w = words[-1]
            w["word"] += text
            w["end"] = tok.end
            w["_p"].append(tok.confidence)
        else:
            words.append({"start": tok.start, "end": tok.end, "word": text if text.startswith(" ") else " " + text, "_p": [tok.confidence]})
    for w in words:
        p = w.pop("_p")
        w["prob"] = round(sum(p) / len(p), 3)
    return words


class ParakeetModel:
    is_multilingual = True

    def __init__(self, path: str, helper=None):
        self.path, self.helper, self._model = path, helper, None

    def _loaded(self):
        if self._model is None:
            from parakeet_mlx import from_pretrained

            self._model = from_pretrained(self.path)
        return self._model

    def detect_language(self, audio, **kw):
        """(language, probability, [...]) from the helper Whisper model. Without one: ("en", 0.0, ...), which no caller treats as a finding."""
        if self.helper is not None:
            return self.helper.detect_language(audio, **kw)
        return "en", 0.0, [("en", 0.0)]

    def transcribe(self, audio, language=None, word_timestamps=True, vad_filter=False, initial_prompt=None,
                   condition_on_previous_text=False, multilingual=False, task="transcribe", **_ignored):
        """Returns (segments, info) shaped like faster-whisper's. `initial_prompt`, `vad_filter` and `multilingual` are not available here."""
        if task == "translate":
            if self.helper is None:
                raise RuntimeError("Translation into English needs a Whisper model. Download one in Settings, Storage and models, or turn translation off.")
            return self.helper.transcribe(audio, language=language, task="translate", condition_on_previous_text=False)
        prob = 1.0
        if language is None:
            language, prob, _ = self.detect_language(audio)
            if self.helper is None:
                raise RuntimeError("Parakeet cannot tell which language is spoken. Choose the language, or download a Whisper model so it can be detected.")
        if language not in LANGUAGES:
            raise RuntimeError(f"Parakeet does not support this language ({language}). Use a Whisper model for it.")
        mx = importlib.import_module("mlx.core")
        pk = importlib.import_module("parakeet_mlx.audio")
        model = self._loaded()

        def run():
            for lo, hi in chunk_bounds(audio, CHUNK_SECONDS, 8.0):
                if hi - lo < model.preprocessor_config.hop_length:
                    continue
                mel = pk.get_logmel(mx.array(audio[lo:hi]), model.preprocessor_config)
                result = model.generate(mel)[0]
                shift = lo / SAMPLE_RATE
                for s in result.sentences:
                    words = group_words(s.tokens)
                    yield types.SimpleNamespace(
                        start=s.start + shift, end=s.end + shift, text=s.text,
                        words=[types.SimpleNamespace(start=w["start"] + shift, end=w["end"] + shift, word=w["word"], probability=w["prob"]) for w in words],
                    )

        return run(), types.SimpleNamespace(language=language, language_probability=prob)
