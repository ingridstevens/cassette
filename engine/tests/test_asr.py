import pytest

pytestmark = pytest.mark.needs_ml


def test_cuda_choice_comes_from_ctranslate2(monkeypatch):
    import ctranslate2
    from engine import asr

    monkeypatch.setattr(ctranslate2, "get_cuda_device_count", lambda: 1)
    assert asr.pick_device("auto") == ("cuda", "float16")
    monkeypatch.setattr(ctranslate2, "get_cuda_device_count", lambda: 0)
    assert asr.pick_device("auto") == ("cpu", "int8")
    assert asr.pick_device("cpu") == ("cpu", "int8")


def test_transcribe_turns_detects_language_per_turn_and_drops_slivers():
    import types
    from engine.asr import transcribe_turns

    class Fake:
        def __init__(self): self.calls = 0
        def transcribe(self, clip, **kw):
            self.calls += 1
            lang = "es" if self.calls == 1 else "fr"
            w = types.SimpleNamespace(start=0.2, end=0.6, word=" hola" if lang == "es" else " bonjour", probability=0.9)
            return [types.SimpleNamespace(words=[w], end=0.6)], types.SimpleNamespace(language=lang, language_probability=0.9)

    import numpy as np
    audio = np.zeros(16000 * 10, dtype="float32")
    turns = [(1.0, 2.5, "A"), (3.0, 3.1, "B"), (5.0, 6.5, "B")]
    words, dominant, info = transcribe_turns(Fake(), audio, 16000, turns, False, None, 0.0)
    assert [(w["word"], w["lang"]) for w in words] == [(" hola", "es"), (" bonjour", "fr")]
    assert info["languages"] == {"es": 1.5, "fr": 1.5}
    assert words[0]["start"] > 1.0 - 0.01  # time is shifted back into file time


def test_verbatim_prompt_is_in_the_recordings_language_and_after_the_vocabulary():
    from engine.asr import VERBATIM_PROMPTS, build_prompt

    assert build_prompt(None, False, "de") is None
    assert build_prompt("Müller GmbH", False, "de") == "Müller GmbH"
    p = build_prompt("Müller GmbH", True, "de")
    assert p.startswith("Müller GmbH ") and p.endswith(VERBATIM_PROMPTS["de"])
    assert build_prompt(None, True, "ja") is None  # no sample for other languages: nothing is invented


def test_transcribe_passes_the_verbatim_prompt_and_detects_the_language_first():
    import types
    import numpy as np
    from engine.asr import VERBATIM_PROMPTS, transcribe

    seen = {}

    class Fake:
        def detect_language(self, audio): return ("fr", 0.9, [])
        def transcribe(self, audio, **kw):
            seen.update(kw)
            return [], types.SimpleNamespace(language=kw["language"], language_probability=0.9)

    transcribe(np.zeros(16000, dtype="float32"), "small", None, "cpu", False, None, 0.0, 1.0, False, (Fake(), "cpu", "int8"), True)
    assert seen["language"] == "fr" and seen["initial_prompt"] == VERBATIM_PROMPTS["fr"]


def test_backend_choice_follows_the_rules(monkeypatch):
    from engine import asr, asr_mlx, models

    monkeypatch.setattr(asr_mlx, "available", lambda: True)
    monkeypatch.setattr(models, "_cached", lambda repo: True)
    assert asr.pick_backend("auto", "small", "auto", False) == "mlx"
    assert asr.pick_backend("auto", "small", "cpu", False) == "faster"      # the user asked for the CPU
    assert asr.pick_backend("auto", "small", "auto", True) == "faster"      # skip-silence needs faster-whisper's VAD
    assert asr.pick_backend("faster", "small", "auto", False) == "faster"
    monkeypatch.setattr(models, "_cached", lambda repo: False)
    assert asr.pick_backend("auto", "small", "auto", False) == "faster"      # not downloaded: fall back quietly
    with pytest.raises(RuntimeError):
        asr.pick_backend("mlx", "small", "auto", False)                      # explicitly asked for, not downloaded: say so
    monkeypatch.setattr(asr_mlx, "available", lambda: False)
    assert asr.pick_backend("auto", "small", "auto", False) == "faster"


def test_mlx_wrapper_returns_faster_whisper_shaped_results(monkeypatch):
    import sys
    import types
    import numpy as np
    from engine.asr_mlx import MlxModel

    calls = {}

    def fake_transcribe(audio, **kw):
        calls.update(kw)
        return {"segments": [{"start": 0.0, "end": 1.0, "text": " Hallo", "words": [{"word": " Hallo", "start": 0.0, "end": 0.9, "probability": 0.8}]}]}

    monkeypatch.setitem(sys.modules, "mlx_whisper", types.SimpleNamespace(transcribe=fake_transcribe))
    m = MlxModel("/models/x")
    monkeypatch.setattr(m, "detect_language", lambda audio, **k: ("de", 0.93, [("de", 0.93)]))
    segs, info = m.transcribe(np.zeros(16000, dtype="float32"), language=None, word_timestamps=True, vad_filter=True,
                              initial_prompt="Müller", condition_on_previous_text=False, multilingual=True, task="translate")
    segs = list(segs)  # lazy now, like faster-whisper's: pieces are written down as they are read
    assert info.language == "de" and info.language_probability == 0.93
    assert segs[0].words[0].word == " Hallo" and segs[0].words[0].probability == 0.8 and segs[0].end == 1.0
    assert calls["language"] == "de" and calls["task"] == "translate" and calls["initial_prompt"] == "Müller"
    assert "vad_filter" not in calls and "multilingual" not in calls  # not supported there, not passed on
