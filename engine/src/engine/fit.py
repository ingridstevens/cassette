"""How well a speech model is expected to handle a language, so the app can say "this size is weak for Farsi" before wasting a run.

This is our judgement from Whisper's published per-language results and the app's own tests, not a benchmark: every language has a
`floor`, the smallest model that is reasonable for it. Below the floor the app warns; far below it, it suggests a bigger one.
"""
from .models import WHISPER_LANGUAGES, WHISPER_MODELS

# Smallest to largest. large-v3-turbo is as good as medium on most languages and worse than large-v3 on the rarest.
RANK = {"tiny": 0, "base": 1, "small": 2, "medium": 3, "large-v3-turbo": 3, "large-v3": 4}
ORDER = ["tiny", "base", "small", "medium", "large-v3-turbo", "large-v3"]

_SMALL = "en de fr es it pt nl ca sv da no nn pl ru tr id ms ja zh yue ko vi cs ro hu el uk bg hr sk sl la gl".split()
_MEDIUM = "ar fa hi ur bn ta te mr gu pa kn ml ne th he fi lt lv et sr bs mk sq hy ka az kk uz tg tt mn ps sd si km lo my be eu cy is af fo lb oc br".split()
# every other language Whisper knows (for example Amharic, Hausa, Swahili, Yoruba, Shona, Somali) needs the largest model

ENGINE_LANGUAGES = {"parakeet-v3": set("bg hr cs da nl en et fi fr de el hu it lv lt mt pl pt ro sk sl es sv ru uk".split())}  # kept in step with asr_parakeet.LANGUAGES by a test
FLOOR: dict[str, str] = {lang: "tiny" if lang == "en" else "small" if lang in _SMALL else "medium" if lang in _MEDIUM else "large-v3" for lang in WHISPER_LANGUAGES}


def fit(model: str, language: str) -> str:
    """"good" (at or above the floor), "weak" (one step below), or "poor" (further below). Unknown models and languages count as good: no warning on a guess."""
    if model.startswith("moonshine-"):  # one language per model: the language in its name
        return "good" if language == model[len("moonshine-"):] else "poor"
    if model in ENGINE_LANGUAGES:  # a model that knows a fixed list of languages: fine inside it, unusable outside it
        return "good" if language in ENGINE_LANGUAGES[model] else "poor"
    floor = FLOOR.get(language)
    if model not in RANK or floor is None:
        return "good"
    gap = RANK[floor] - RANK[model]
    return "good" if gap <= 0 else "weak" if gap == 1 else "poor"


def suggest(model: str, language: str, have: dict[str, bool] | None = None) -> str | None:
    """The smallest model that is good for `language`, preferring one already downloaded; None when `model` is already good."""
    if fit(model, language) == "good":
        return None
    better = [m for m in ORDER if m in WHISPER_MODELS and fit(m, language) == "good"]
    return next((m for m in better if have and have.get(m)), better[0] if better else None)


def table() -> dict:
    """What the app needs to explain fit without hardcoding it: the size order and every language's floor."""
    return {"order": ORDER, "floor": FLOOR, "engines": {m: sorted(langs) for m, langs in ENGINE_LANGUAGES.items()}}
