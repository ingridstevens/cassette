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


def test_check_fit_asks_only_when_the_language_is_clear_and_the_model_weak():
    from engine.asr import check_fit

    class M:
        def __init__(self, lang, prob): self.r = (lang, prob, [])
        def detect_language(self, audio): return self.r

    import numpy as np
    audio = np.zeros(16000 * 40, dtype=np.float32)
    ask = check_fit(M("fa", 0.93), audio, 16000, "small", {"small": True, "medium": False})
    assert ask["level"] == "weak" and ask["suggested"] == "medium" and ask["language"] == "fa"
    assert check_fit(M("fa", 0.4), audio, 16000, "small") is None      # a guess: say nothing
    assert check_fit(M("de", 0.99), audio, 16000, "small") is None     # small is fine for German
    assert check_fit(M("fa", 0.9), audio, 16000, "large-v3") is None   # nothing better to suggest
