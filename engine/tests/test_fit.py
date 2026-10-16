from engine.fit import FLOOR, fit, suggest
from engine.models import WHISPER_LANGUAGES


def test_every_whisper_language_has_a_floor():
    assert set(FLOOR) == set(WHISPER_LANGUAGES)


def test_farsi_is_weak_on_small_and_poor_on_base():
    assert fit("small", "fa") == "weak" and fit("base", "fa") == "poor" and fit("medium", "fa") == "good"


def test_english_is_good_everywhere_and_unknown_is_not_flagged():
    assert all(fit(m, "en") == "good" for m in ("tiny", "small", "large-v3"))
    assert fit("some-future-model", "fa") == "good" and fit("small", "xx") == "good"


def test_suggestion_prefers_what_is_downloaded_then_the_smallest_good_one():
    assert suggest("small", "en") is None
    assert suggest("small", "fa") == "medium"
    assert suggest("small", "fa", {"large-v3-turbo": True}) == "large-v3-turbo"
    assert suggest("medium", "sw") == "large-v3"
