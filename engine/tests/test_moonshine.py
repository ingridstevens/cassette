import numpy as np
import pytest

from engine.asr_moonshine import MoonshineModel, available, catalog, spread_words
from engine.fit import fit, suggest

needs_pkg = pytest.mark.skipif(not available(), reason="moonshine-voice is only installed on Apple Silicon Macs")


def test_words_share_the_lines_time_by_length_and_cover_it_exactly():
    w = spread_words("Ich bin hier", 10.0, 3.0)
    assert [x["word"] for x in w] == [" Ich", " bin", " hier"]
    assert w[0]["start"] == 10.0 and abs(w[-1]["end"] - 13.0) < 1e-9
    assert all(a["end"] == b["start"] for a, b in zip(w, w[1:])) and w[2]["end"] - w[2]["start"] > w[0]["end"] - w[0]["start"]
    assert spread_words("  ", 0, 1) == []


def test_fit_one_language_per_model_and_whisper_is_suggested_for_others():
    assert fit("moonshine-de", "de") == "good" and fit("moonshine-de", "fa") == "poor"
    assert suggest("moonshine-de", "fa", {"medium": True}) == "medium"


@needs_pkg
def test_catalog_has_only_streaming_models_in_the_languages_we_checked():
    cat = catalog()
    assert {"moonshine-en", "moonshine-de", "moonshine-ar"} <= set(cat)
    assert "moonshine-ko" not in cat and "moonshine-uk" not in cat  # no streaming model there: those are non-commercial
    assert all(c["arch"].endswith("STREAMING") and c["bytes"] > 1_000_000 for c in cat.values())


@needs_pkg
def test_wrong_language_and_translation_are_refused_with_a_hint():
    m = MoonshineModel("moonshine-de")
    audio = np.zeros(16000, dtype=np.float32)
    with pytest.raises(RuntimeError, match="Moonshine model for that language"):
        m.transcribe(audio, language="fr")
    with pytest.raises(RuntimeError, match="needs a Whisper model"):
        m.transcribe(audio, task="translate")
    assert m.detect_language(audio)[:2] == ("de", 0.0)
