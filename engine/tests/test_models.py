import pytest

pytestmark = pytest.mark.needs_ml


def test_language_list_matches_faster_whisper():
    from faster_whisper.tokenizer import _LANGUAGE_CODES
    from engine.models import WHISPER_LANGUAGES

    assert set(WHISPER_LANGUAGES) == set(_LANGUAGE_CODES)
    assert {"de", "en", "fr", "es"} <= set(WHISPER_LANGUAGES)
