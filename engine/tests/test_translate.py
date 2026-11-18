from engine.llm import LLM_MODELS, TRANSLATION_MODEL
from engine.translate import NAMES, translate_segments


class Fake:
    def translate(self, text, language):
        return f"[{language}] {text}"


def test_only_lines_in_other_languages_are_translated():
    segs = [{"text": "Hallo", "lang": "de"}, {"text": "Hello", "lang": "en"}, {"text": "Bonjour"}, {"text": "  "}]
    n = translate_segments(segs, "en", "fr", Fake())
    assert n == 2 and segs[0]["translation"] == "[English] Hallo" and "translation" not in segs[1] and segs[2]["translation"] == "[English] Bonjour" and "translation" not in segs[3]


def test_translation_model_is_not_offered_for_highlights(monkeypatch):
    from engine import llm, models

    monkeypatch.setattr(llm, "backend", lambda: "mlx")
    monkeypatch.setattr(models, "_llm_cached", lambda n: False)
    st = models.llm_status()
    assert TRANSLATION_MODEL not in [m["id"] for m in st["catalog"]]
    assert [m["id"] for m in st["translation"]] == [TRANSLATION_MODEL]


def test_catalog_entry_is_complete_and_names_cover_the_model_card():
    spec = LLM_MODELS[TRANSLATION_MODEL]
    assert spec["mlx"] and spec["gguf"][1].endswith(".gguf") and set(spec["bytes"]) == {"mlx", "gguf"}
    assert len(NAMES) == 38 and NAMES["fa"] == "Persian"


def test_long_lines_are_translated_in_sentence_pieces():
    from engine.translate import pieces

    text = "Erster Satz. " * 30 + "Frage? Ende!"
    ps = pieces(text, 100)
    assert len(ps) > 3 and all(len(p) <= 100 for p in ps) and " ".join(ps) == text.strip()
    assert pieces("Kurz.", 100) == ["Kurz."] and pieces("   ") == []
    seen = []

    class Rec:
        def translate(self, t, language):
            seen.append(t)
            return t.upper()

    translate_segments([{"text": text, "lang": "fr"}], "en", "de", Rec())
    assert len(seen) == len(pieces(text)) > 1 and all(len(p) <= 240 for p in seen)


def test_turbo_and_helper_engines_translate_with_a_downloaded_whisper_size_that_can(monkeypatch):
    import pytest

    from engine import asr, models

    loaded = []
    monkeypatch.setattr(asr, "load_model", lambda name, device, backend="faster": (loaded.append(name) or name, device, "x"))
    cached = {"medium": False, "small": True, "large-v3-turbo": True, "tiny": True}
    monkeypatch.setattr(models, "_cached", lambda repo: cached.get(next((n for n, r in models.WHISPER_MODELS.items() if r == repo), ""), False))
    assert asr.translation_model("small", "current", "cpu") == "current"
    assert asr.translation_model("large-v3-turbo", "current", "cpu") == "small"
    assert asr.translation_model("parakeet-tdt", "current", "cpu") == "small"
    assert asr._whisper_helper("cpu") == "tiny"
    cached.update(tiny=False, small=False)
    assert asr._whisper_helper("cpu") is None
    with pytest.raises(RuntimeError, match="other than Large v3 turbo"):
        asr.translation_model("large-v3-turbo", "current", "cpu")
