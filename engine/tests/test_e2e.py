"""End to end: transcribe a real recording with the real tiny model and compare the words with the written-out text.
A dependency update that breaks audio decoding or the speech model path makes this fail, where the unit tests (which use fake models) would not.

It needs the tiny model on disk, so it is skipped when the model is not there (no download is ever started by the test: nothing
leaves this computer). To run it:  uv run python -m engine models download tiny   then   CASSETTE_E2E=1 uv run pytest tests/test_e2e.py
(CASSETTE_E2E=1 turns the skip into a failure, for a place where the model is cached on purpose.) ENGINE_MODELS_DIR is respected."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

from engine import models

SAMPLES = Path(__file__).resolve().parents[2] / "docs" / "samples"
AUDIO = SAMPLES / "test-interview-english-two-voices.m4a"
REFERENCE = SAMPLES / "test-interview-english-two-voices.txt"
MAX_WER = 0.25  # tiny scores 0.0 on this recording on a Mac; the room is for other systems. This catches broken audio, not small drifts.


def words_of(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower().replace("’", "'"))


def reference_words() -> list[str]:
    lines = REFERENCE.read_text(encoding="utf-8").splitlines()
    return words_of(" ".join(re.sub(r"^\[[\d:]+\]\s*Speaker \d+:\s*", "", line) for line in lines))


def wer(reference: list[str], hypothesis: list[str]) -> float:
    """Word error rate: word-level edit distance divided by the number of reference words."""
    prev = list(range(len(hypothesis) + 1))
    for i, r in enumerate(reference, 1):
        cur = [i]
        for j, h in enumerate(hypothesis, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h)))
        prev = cur
    return prev[-1] / max(len(reference), 1)


def test_wer_function():
    assert wer(["a", "b", "c"], ["a", "b", "c"]) == 0
    assert wer(["a", "b", "c", "d"], ["a", "x", "c"]) == 0.5  # one substitution, one deletion
    assert wer(["a"], []) == 1


def test_real_transcription_matches_the_text():
    if not models._cached(models.WHISPER_MODELS["tiny"]) and not os.environ.get("CASSETTE_E2E"):
        pytest.skip("the tiny model is not downloaded (run `python -m engine models download tiny`, then set CASSETTE_E2E=1 to require this test)")
    out = subprocess.run(
        [sys.executable, "-m", "engine", "transcribe", str(AUDIO), "--model", "tiny", "--no-diarize", "--language", "en", "--backend", "faster", "--device", "cpu"],
        capture_output=True, text=True, timeout=600, env={**os.environ, "ENGINE_MODELS_DIR": str(models.models_dir())},
    )
    assert out.returncode == 0, out.stderr[-2000:]
    events = [json.loads(line) for line in out.stdout.splitlines() if line.startswith("{")]
    done = [e for e in events if e["type"] == "done"]
    assert done, "the engine finished without a 'done' message: " + out.stdout[-1000:]
    heard = words_of(" ".join(s["text"] for s in done[0]["segments"]))
    score = wer(reference_words(), heard)
    assert score < MAX_WER, f"word error rate {score:.2f} is not below {MAX_WER}"
