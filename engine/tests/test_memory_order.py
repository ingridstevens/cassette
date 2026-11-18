"""The speech model must not be in memory while the speaker model runs (matters on computers with little memory)."""
import argparse

import numpy as np
import pytest

from engine import asr, audio, diarize as dz, main, models


class _Detector:
    def detect_language(self, clip):
        return "en", 0.99, []


def _args(**kw):
    base = dict(input="x.wav", start=None, end=None, model="small", device="cpu", backend="auto", vad=False, detect_model="tiny", language="en",
                accept_fit=False, no_diarize=False, num_speakers=None, min_speakers=None, max_speakers=None, mixed_languages="off", prompt=None,
                verbatim=False, translate=False, translate_to=None)
    base.update(kw)
    return argparse.Namespace(**base)


@pytest.fixture
def order(monkeypatch):
    events = []
    monkeypatch.setattr(audio, "decode", lambda *a, **k: None)
    monkeypatch.setattr(audio, "load_wav", lambda p: (np.zeros(16000 * 5, dtype="float32"), 16000))
    monkeypatch.setattr(asr, "load_model", lambda name, *a, **k: (events.append(f"load {name}"), (object(), "cpu", "int8"))[1])
    monkeypatch.setattr(asr, "load_detector", lambda detect, name, dev, model: (events.append(f"detector {detect}"), _Detector())[1])
    monkeypatch.setattr(asr, "check_fit", lambda *a, **k: (events.append("fit check"), None)[1])
    monkeypatch.setattr(dz, "diarize", lambda *a, **k: (events.append("diarize"), ([(0.0, 4.0, "SPEAKER_00")], {"device": "cpu"}))[1])
    monkeypatch.setattr(dz, "free_memory", lambda: events.append("free memory"))
    monkeypatch.setattr(asr, "transcribe", lambda *a, **k: ([{"start": 0.1, "end": 0.5, "word": " hi", "speaker": "SPEAKER_00"}], "en", {"device": "cpu"}))
    monkeypatch.setattr(models, "_cached", lambda repo: True)
    monkeypatch.setattr(main, "emit", lambda *a, **k: None)
    monkeypatch.setattr(main, "progress", lambda *a, **k: None)
    monkeypatch.setattr(main, "log", lambda *a, **k: None)
    monkeypatch.setattr(main, "partial", lambda *a, **k: None)
    return events


def test_speech_model_loads_after_the_speakers_are_found_when_the_checker_is_separate(order):
    main.cmd_transcribe(_args())
    assert order == ["detector tiny", "diarize", "free memory", "load small"]  # language is fixed here, so there is no fit check


def test_speech_model_loads_first_when_the_checker_is_the_speech_model_itself(order):
    main.cmd_transcribe(_args(detect_model="same"))
    assert order.index("load small") < order.index("diarize")
    assert "free memory" not in order


def test_no_speaker_detection_keeps_the_old_order(order):
    main.cmd_transcribe(_args(no_diarize=True))
    assert "diarize" not in order and order[0] == "load small"


def test_a_weak_model_stops_before_the_speech_model_is_ever_loaded(order, monkeypatch):
    emitted = []
    monkeypatch.setattr(asr, "check_fit", lambda *a, **k: {"language": "fa", "probability": 0.9, "model": "small", "level": "weak", "suggested": "medium", "have": {}})
    monkeypatch.setattr(main, "emit", lambda kind, **k: emitted.append(kind))
    main.cmd_transcribe(_args(language="auto"))
    assert emitted == ["fit"] and "load small" not in order and "diarize" not in order
