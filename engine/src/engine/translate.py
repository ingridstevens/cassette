"""Translating lines into a language the user picks, with the local translation model (Hy-MT2)."""
from .llm import LocalLLM, TRANSLATION_MODEL

# Language code -> the English name the model is prompted with. These are the 38 languages Hy-MT2 lists on its model card.
NAMES = {
    "zh": "Chinese", "en": "English", "fr": "French", "pt": "Portuguese", "es": "Spanish", "ja": "Japanese", "tr": "Turkish", "ru": "Russian",
    "ar": "Arabic", "ko": "Korean", "th": "Thai", "it": "Italian", "de": "German", "vi": "Vietnamese", "ms": "Malay", "id": "Indonesian",
    "tl": "Filipino", "hi": "Hindi", "zh-Hant": "Traditional Chinese", "pl": "Polish", "cs": "Czech", "nl": "Dutch", "km": "Khmer",
    "my": "Burmese", "fa": "Persian", "gu": "Gujarati", "ur": "Urdu", "te": "Telugu", "mr": "Marathi", "he": "Hebrew", "bn": "Bengali",
    "ta": "Tamil", "uk": "Ukrainian", "bo": "Tibetan", "kk": "Kazakh", "mn": "Mongolian", "ug": "Uyghur", "yue": "Cantonese",
}


def translate_segments(segments: list[dict], target: str, default_language: str, llm: LocalLLM, on_progress=None) -> int:
    """Adds `translation` to every segment not already in `target`. Returns how many were translated."""
    name = NAMES[target]
    todo = [s for s in segments if (s.get("lang") or default_language) != target and s.get("text", "").strip()]
    for n, seg in enumerate(todo):
        if on_progress:
            on_progress(n / max(len(todo), 1))
        seg["translation"] = llm.translate(seg["text"], name)
        seg["translationLang"] = target
    return len(todo)


__all__ = ["NAMES", "TRANSLATION_MODEL", "translate_segments"]
