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
