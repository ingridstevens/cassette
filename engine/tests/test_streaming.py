"""Partial results: the Apple GPU engine's pieces, and the `partial` event sent while a run goes on."""
import json
import types

import numpy as np

from engine import main as m
from engine.asr_mlx import CHUNK_SECONDS, SAMPLE_RATE, chunk_bounds
from engine.protocol import partial


def test_short_audio_is_one_piece():
    assert chunk_bounds(np.zeros(SAMPLE_RATE * 20, dtype=np.float32)) == [(0, SAMPLE_RATE * 20)]


def test_long_audio_is_cut_at_the_quietest_moment_without_gaps():
    audio = (np.random.default_rng(0).normal(size=SAMPLE_RATE * 100) * 0.1).astype(np.float32)
    quiet = int(27.5 * SAMPLE_RATE)
    audio[quiet: quiet + 4000] = 0.0
    bounds = chunk_bounds(audio)
    assert bounds[0][0] == 0 and bounds[-1][1] == len(audio)
    assert all(a[1] == b[0] for a, b in zip(bounds, bounds[1:]))
    assert quiet <= bounds[0][1] <= quiet + 4000
    assert all((b - a) / SAMPLE_RATE <= CHUNK_SECONDS + 0.1 for a, b in bounds)


def test_partial_event(capsys):
    partial([{"start": 0.0, "end": 1.0, "speaker": "SPEAKER_00", "text": "Hallo"}])
    e = json.loads(capsys.readouterr().out)
    assert e["type"] == "partial" and e["segments"][0]["text"] == "Hallo"


def test_transcribe_sends_partial_lines_with_speakers(monkeypatch, capsys):
    from engine import asr, audio, diarize

    monkeypatch.setattr(audio, "decode", lambda *a, **k: None)
    monkeypatch.setattr(audio, "load_wav", lambda p: (np.zeros(32000, dtype=np.float32), 16000))
    monkeypatch.setattr(diarize, "diarize", lambda *a, **k: ([(0.0, 2.0, "SPEAKER_01")], {"device": "cpu"}))
    monkeypatch.setattr(asr, "load_model", lambda *a, **k: (object(), "cpu", "int8"))

    def fake(*a, **k):
        k.get("on_words") or a[-1]([{"start": 0.1, "end": 0.5, "word": " Hallo"}])
        return [{"start": 0.1, "end": 0.5, "word": " Hallo"}], "de", {"device": "cpu", "languageProb": 0.9}

    monkeypatch.setattr(asr, "transcribe", fake)
    args = types.SimpleNamespace(input="x.wav", mixed_languages="off", translate=False, verbatim=False, backend="faster", start=None, end=None, no_diarize=False, device="auto",
                                 num_speakers=None, min_speakers=None, max_speakers=None, language="de", vad=False, prompt=None, model="small", detect_model="same")
    m.cmd_transcribe(args)
    events = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    p = [e for e in events if e["type"] == "partial"]
    assert p and p[0]["segments"][0]["speaker"] == "SPEAKER_01" and "words" not in p[0]["segments"][0]
    assert events[-1]["type"] == "done"
