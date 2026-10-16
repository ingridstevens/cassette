import types

import numpy as np
import pytest

from engine.asr_parakeet import LANGUAGES, ParakeetModel, group_words


def tok(text, start, end, conf=0.9):
    return types.SimpleNamespace(text=text, start=start, end=end, confidence=conf)


def test_word_pieces_become_words():
    words = group_words([tok(" Hel", 0.0, 0.2, 0.8), tok("lo", 0.2, 0.4, 0.6), tok(" wor", 0.5, 0.7), tok("ld", 0.7, 0.9)])
    assert [w["word"] for w in words] == [" Hello", " world"]
    assert words[0]["start"] == 0.0 and words[0]["end"] == 0.4 and words[0]["prob"] == 0.7


def test_the_first_piece_without_a_space_still_gets_one():
    assert group_words([tok("Hi", 0, 1)])[0]["word"] == " Hi"


def test_languages_are_the_25_on_the_model_card():
    assert len(LANGUAGES) == 25 and "de" in LANGUAGES and "ar" not in LANGUAGES and "fa" not in LANGUAGES


def test_without_a_helper_it_asks_for_a_language_and_cannot_translate():
    m = ParakeetModel("/x")
    audio = np.zeros(16000, dtype=np.float32)
    assert m.detect_language(audio)[1] == 0.0
    with pytest.raises(RuntimeError, match="which language"):
        m.transcribe(audio, language=None)
    with pytest.raises(RuntimeError, match="Whisper"):
        m.transcribe(audio, language="de", task="translate")


def test_unsupported_language_is_refused_with_a_hint():
    with pytest.raises(RuntimeError, match="Use a Whisper model"):
        ParakeetModel("/x").transcribe(np.zeros(16000, dtype=np.float32), language="ar")


def test_fit_knows_parakeet_languages_and_suggests_whisper_for_the_rest():
    from engine.asr_parakeet import LANGUAGES as P
    from engine.fit import ENGINE_LANGUAGES, fit, suggest

    assert ENGINE_LANGUAGES["parakeet-v3"] == set(P)
    assert fit("parakeet-v3", "de") == "good" and fit("parakeet-v3", "fa") == "poor"
    assert suggest("parakeet-v3", "fa", {"medium": True}) == "medium"
    assert suggest("parakeet-v3", "de") is None


def test_status_lists_parakeet_only_where_it_can_run(monkeypatch, tmp_path):
    from engine import models

    monkeypatch.setenv("ENGINE_MODELS_DIR", str(tmp_path))
    monkeypatch.setattr(models, "mlx_available", lambda: False)
    monkeypatch.setattr(models, "parakeet_available", lambda: False)
    assert "parakeet-v3" not in models.status()["whisper"]
    monkeypatch.setattr(models, "parakeet_available", lambda: True)
    st = models.status()
    assert st["whisper"]["parakeet-v3"] is False and "parakeet-v3" in st["sizes"]["whisper"] and st["parakeetAvailable"]
