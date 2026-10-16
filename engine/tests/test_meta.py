"""The final `done` event of `transcribe` carries run metadata for the app's Info tab."""
import json
import types

import numpy as np

from engine import main as m


def _args(**kw):
    base = dict(input="x.wav", mixed_languages="auto", translate=False, verbatim=False, backend="faster", start=None, end=None, no_diarize=False, device="auto", num_speakers=None, min_speakers=None,
                max_speakers=None, language="auto", vad=False, prompt=None, model="small")
    return types.SimpleNamespace(**{**base, **kw})


def _fake_engine(monkeypatch):
    from engine import asr, audio, diarize

    monkeypatch.setattr(audio, "decode", lambda *a, **k: None)
    monkeypatch.setattr(audio, "load_wav", lambda p: (np.zeros(32000, dtype=np.float32), 16000))
    monkeypatch.setattr(diarize, "diarize", lambda *a, **k: ([(0.0, 2.0, "SPEAKER_00")], {"device": "mps"}))
    words = [{"start": 0.1, "end": 0.5, "word": " Hallo"}]
    monkeypatch.setattr(asr, "transcribe", lambda *a, **k: (words, "de", {"device": "cpu", "languageProb": 0.97}))
    monkeypatch.setattr(asr, "load_model", lambda *a, **k: (object(), "cpu", "int8"))
    monkeypatch.setattr(asr, "check_fit", lambda *a, **k: None)
    monkeypatch.setattr(asr, "probe_languages", lambda *a, **k: {"de": 9.0})


def _done(capsys):
    events = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    return [e for e in events if e["type"] == "done"][-1]


def test_done_event_has_meta(monkeypatch, capsys):
    _fake_engine(monkeypatch)
    m.cmd_transcribe(_args())
    done = _done(capsys)
    assert done["language"] == "de" and done["segments"] and done["speakers"] == ["SPEAKER_00"]  # existing fields stay
    meta = done["meta"]
    assert meta["model"] == "small" and meta["device"] == "cpu" and meta["speakerDevice"] == "mps"
    assert meta["languageProb"] == 0.97
    assert meta["secondsSpeakers"] >= 0 and meta["secondsTranscribe"] >= 0


def test_meta_without_speaker_detection(monkeypatch, capsys):
    _fake_engine(monkeypatch)
    m.cmd_transcribe(_args(no_diarize=True))
    meta = _done(capsys)["meta"]
    assert meta["speakerDevice"] is None and meta["secondsSpeakers"] is None and meta["device"] == "cpu"


def test_auto_mode_switches_to_per_turn_only_when_several_languages_are_found(monkeypatch, capsys):
    from engine import asr

    _fake_engine(monkeypatch)
    called = {}
    monkeypatch.setattr(asr, "probe_languages", lambda *a, **k: {"fr": 5.0, "en": 4.0})
    monkeypatch.setattr(asr, "transcribe_turns", lambda *a, **k: (called.setdefault("turns", True) and [{"start": 0.1, "end": 0.5, "word": " Salut", "lang": "fr"}], "fr", {"languages": {"fr": 5.0, "en": 4.0}, "languageProb": 0.9}))
    m.cmd_transcribe(_args())
    done = _done(capsys)
    assert called.get("turns") and done["meta"]["mixed"] is True and done["segments"][0]["lang"] == "fr"

    called.clear()
    monkeypatch.setattr(asr, "probe_languages", lambda *a, **k: {"de": 9.0})
    m.cmd_transcribe(_args())
    assert not called and _done(capsys)["meta"]["mixed"] is False


def test_translate_adds_english_only_for_other_languages(monkeypatch, capsys):
    from engine import asr

    _fake_engine(monkeypatch)
    monkeypatch.setattr(asr, "probe_languages", lambda *a, **k: {"de": 9.0})
    monkeypatch.setattr(asr, "translate_clip", lambda *a, **k: "Hello")
    m.cmd_transcribe(_args(translate=True))
    done = _done(capsys)
    assert done["segments"][0]["translation"] == "Hello" and done["meta"]["translated"] == 1


def test_probe_and_is_mixed_thresholds():
    import types
    from engine.asr import is_mixed, probe_languages

    assert is_mixed({"fr": 5.0, "en": 3.0}) and not is_mixed({"fr": 5.0, "en": 0.5}) and not is_mixed({"fr": 9.0})
    answers = iter([("fr", 0.9, []), ("en", 0.3, []), ("en", 0.8, [])])
    model = types.SimpleNamespace(detect_language=lambda clip: next(answers))
    audio = np.zeros(16000 * 20, dtype=np.float32)
    got = probe_languages(model, audio, 16000, [(0, 4, "A"), (5, 8, "B"), (10, 13, "C")], 0.0)
    assert got == {"fr": 4.0, "en": 3.0}  # the 30%-sure detection is ignored


def test_transcribe_stops_with_a_fit_event_before_doing_the_slow_work(monkeypatch, capsys):
    from engine import asr, diarize

    _fake_engine(monkeypatch)
    monkeypatch.setattr(asr, "check_fit", lambda *a, **k: {"language": "fa", "probability": 0.9, "model": "small", "level": "weak", "suggested": "medium", "have": {}})
    monkeypatch.setattr(diarize, "diarize", lambda *a, **k: (_ for _ in ()).throw(AssertionError("must not run")))
    m.cmd_transcribe(_args())
    events = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert events[-1]["type"] == "fit" and events[-1]["suggested"] == "medium"
    assert not any(e["type"] == "done" for e in events)
    capsys.readouterr()
    _fake_engine(monkeypatch)  # speaker detection works again
    m.cmd_transcribe(_args(accept_fit=True))  # "continue anyway" runs the whole job
    assert _done(capsys)["language"] == "de"
