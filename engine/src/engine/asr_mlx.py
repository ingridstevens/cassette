"""Whisper on the Apple GPU (MLX), behind the same small interface as faster-whisper's WhisperModel.

Only `transcribe` and `detect_language` are provided, with the same arguments and result shapes the rest of the engine uses,
so transcription, per-turn languages, translation and the language check work unchanged. Apple Silicon Macs only.
"""
import importlib
import importlib.util
import platform
import sys
import types


def available() -> bool:
    """True on an Apple Silicon Mac where mlx-whisper is installed."""
    return sys.platform == "darwin" and platform.machine() == "arm64" and importlib.util.find_spec("mlx_whisper") is not None


class MlxModel:
    is_multilingual = True

    def __init__(self, path: str):
        self.path = path

    def _loaded(self):
        import mlx.core as mx

        holder = importlib.import_module("mlx_whisper.transcribe").ModelHolder
        return holder.get_model(self.path, mx.float16)

    def detect_language(self, audio, **_ignored):
        """(language, probability, [(language, probability), ...]) from the first 30 seconds."""
        import mlx.core as mx

        a = importlib.import_module("mlx_whisper.audio")
        model = self._loaded()
        mel = a.log_mel_spectrogram(audio, n_mels=model.dims.n_mels)
        mel = a.pad_or_trim(mel, a.N_FRAMES, axis=-2).astype(mx.float16)
        _, probs = model.detect_language(mel)
        ranked = sorted(((k, float(v)) for k, v in probs.items()), key=lambda kv: -kv[1])
        return ranked[0][0], ranked[0][1], ranked

    def transcribe(self, audio, language=None, word_timestamps=True, vad_filter=False, initial_prompt=None,
                   condition_on_previous_text=False, multilingual=False, task="transcribe", **_ignored):
        """Returns (segments, info) shaped like faster-whisper's. `vad_filter` and `multilingual` are not available here."""
        import mlx_whisper

        prob = 1.0
        if language is None:
            language, prob, _ = self.detect_language(audio)
        r = mlx_whisper.transcribe(audio, path_or_hf_repo=self.path, language=language, task=task, word_timestamps=word_timestamps,
                                   initial_prompt=initial_prompt, condition_on_previous_text=condition_on_previous_text)
        segments = [
            types.SimpleNamespace(
                start=s["start"], end=s["end"], text=s["text"],
                words=[types.SimpleNamespace(start=w["start"], end=w["end"], word=w["word"], probability=w.get("probability", 1.0)) for w in s.get("words") or []],
            )
            for s in r["segments"]
        ]
        return segments, types.SimpleNamespace(language=language, language_probability=prob)
