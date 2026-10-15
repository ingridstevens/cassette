import json

from engine.export import to_json, to_md, to_srt, to_txt, to_vtt

SEGS = [
    {"start": 0.0, "end": 2.5, "speaker": "SPEAKER_00", "text": "Hallo zusammen."},
    {"start": 3661.234, "end": 3663.0, "speaker": "SPEAKER_01", "text": "Bonjour."},
]
NAMES = {"SPEAKER_00": "Anna"}


def test_txt_uses_names_and_timestamps():
    t = to_txt(SEGS, NAMES)
    assert "[00:00:00] Anna: Hallo zusammen." in t
    assert "[01:01:01] SPEAKER_01: Bonjour." in t


def test_srt_format():
    s = to_srt(SEGS, NAMES)
    assert s.startswith("1\n00:00:00,000 --> 00:00:02,500\nAnna: Hallo zusammen.\n")
    assert "2\n01:01:01,234 --> 01:01:03,000" in s


def test_vtt_format():
    v = to_vtt(SEGS, NAMES)
    assert v.startswith("WEBVTT\n\n00:00:00.000 --> 00:00:02.500\n<v Anna>Hallo zusammen.")


def test_md_and_json():
    assert "**Anna**" in to_md(SEGS, NAMES)
    data = json.loads(to_json(SEGS, NAMES))
    assert data["segments"][0]["speaker_name"] == "Anna"


def test_csv_has_header_names_and_both_time_formats():
    from engine.export import to_csv

    rows = to_csv(SEGS, NAMES).splitlines()
    assert rows[0] == "start_seconds,end_seconds,start,end,speaker,text,overlap,language,translation"
    assert rows[1] == "0.00,2.50,00:00:00,00:00:02,Anna,Hallo zusammen.,,,"
    assert rows[2].startswith("3661.23,3663.00,01:01:01,01:01:03,SPEAKER_01,")


def test_csv_quotes_commas_and_newlines():
    from engine.export import to_csv

    out = to_csv([{"start": 0, "end": 1, "speaker": "A", "text": 'He said "hi", twice'}])
    assert '"He said ""hi"", twice"' in out


def test_docx_is_valid_and_contains_names_and_text():
    import io

    from docx import Document

    from engine.export import to_docx

    doc = Document(io.BytesIO(to_docx(SEGS, NAMES, title="Meeting")))
    text = "\n".join(p.text for p in doc.paragraphs)
    assert "Meeting" in text and "Anna" in text and "Hallo zusammen." in text and "SPEAKER_01" in text


def test_docx_header_lists_date_and_participants():
    import io

    from docx import Document

    from engine.export import to_docx

    doc = Document(io.BytesIO(to_docx(SEGS, NAMES, title="Minutes")))
    text = "\n".join(p.text for p in doc.paragraphs)
    assert "Participants: Anna, SPEAKER_01" in text and "speakers" in text and "Made with" not in text


# ---- subtitle cues, chapters, EDL
from engine.export import to_chapters, to_edl  # noqa: E402


def _words(text, start=0.0, per=0.4, sp="SPEAKER_00"):
    out, t = [], start
    for i, w in enumerate(text.split()):
        out.append({"start": t, "end": t + per, "word": ("" if i == 0 else " ") + w, "speaker": sp})
        t += per
    return out


LONG = "This is a fairly long sentence that has to be split across several subtitle cues so nothing overflows the screen at all"


def _seg(text, start=0.0, sp="SPEAKER_00", **kw):
    w = _words(text, start, sp=sp)
    return {"start": start, "end": w[-1]["end"], "speaker": sp, "text": text, "words": w, **kw}


def _blocks(srt):
    return [b.split("\n") for b in srt.strip().split("\n\n")]


def test_cues_respect_max_chars_and_lines():
    srt = to_srt([_seg(LONG)], NAMES, {"maxChars": 30, "maxLines": 2, "speakerNames": True})
    blocks = _blocks(srt)
    assert len(blocks) > 1
    for b in blocks:
        lines = b[2:]
        assert 1 <= len(lines) <= 2
        assert all(len(l) <= 30 for l in lines)
    assert blocks[0][2].startswith("Anna: ")
    assert not any("Anna" in l for b in blocks[1:] for l in b[2:])


def test_cue_max_duration_and_single_line():
    srt = to_srt([_seg(LONG * 2)], None, {"maxChars": 60, "maxLines": 1, "speakerNames": False})
    for b in _blocks(srt):
        assert len(b) == 3
        a, z = b[1].split(" --> ")
        h = lambda t: sum(float(x.replace(",", ".")) * k for x, k in zip(t.split(":"), (3600, 60, 1)))
        assert h(z) - h(a) <= 7.001


def test_no_speaker_names_and_offset_clamped():
    seg = _seg("Hello there", start=4.0)
    srt = to_srt([seg], NAMES, {"speakerNames": False, "offsetSeconds": 2.5})
    assert "00:00:06,500 -->" in srt and "Anna" not in srt
    neg = to_srt([seg], NAMES, {"offsetSeconds": -4.5})
    assert neg.startswith("1\n00:00:00,000 -->")
    assert to_srt([seg], NAMES, {"offsetSeconds": -10}) == ""


def test_vtt_voice_tag_first_cue_only():
    vtt = to_vtt([_seg(LONG)], NAMES, {"maxChars": 30})
    assert vtt.count("<v Anna>") == 1 and vtt.startswith("WEBVTT")


def test_min_duration_one_second():
    srt = to_srt([_seg("Ok", start=2.0)], None, {"speakerNames": False})
    assert "00:00:02,000 --> 00:00:03,000" in srt


def test_chapters_prepend_intro_and_hours():
    segs = [{**SEGS[0], "start": 5.0, "chapter": "Start"}, {**SEGS[1], "chapter": "Late"}, {**SEGS[0], "start": 9.0}]
    assert to_chapters(segs) == "0:00 Intro\n0:05 Start\n1:01:01 Late\n"
    segs[0]["start"] = 0.4
    assert to_chapters(segs).startswith("0:00 Start\n")
    assert to_chapters(SEGS) == ""


def test_edl_timecodes_25_and_30():
    segs = [{**SEGS[0], "chapter": "Intro"}, {**SEGS[1], "start": 61.48, "chapter": "Two | pipes"}]
    e25 = to_edl(segs, NAMES, {"fps": 25}, title="Show")
    assert e25.startswith("TITLE: Show\nFCM: NON-DROP FRAME")
    assert "001  001      V     C        01:00:00:00 01:00:00:01 01:00:00:00 01:00:00:01" in e25
    assert "01:01:01:12 01:01:01:13" in e25
    assert " |C:ResolveColorBlue |M:Intro |D:1" in e25 and "Two / pipes" in e25
    e30 = to_edl(segs, NAMES, {"fps": 30, "startTimecode": "00:59:58:00"})
    assert "00:59:58:00 00:59:58:01" in e30 and "01:00:59:14 01:00:59:15" in e30


def test_edl_fractional_rates_and_drop_frame():
    # 29.97 non-drop: an hour of real time is 107892 frames, so the clock lags 3.6 s behind a plain 30 fps count
    seg = [{**SEGS[0], "start": 3600.0, "chapter": "Hour"}]
    nd = to_edl(seg, NAMES, {"fps": 29.97, "startTimecode": "00:00:00:00"})
    assert "FCM: NON-DROP FRAME" in nd and "00:59:56:12 00:59:56:13" in nd
    # drop-frame: skipping frame numbers keeps the clock on real time, so one real hour reads 01:00:00;00
    df = to_edl(seg, NAMES, {"fps": 29.97, "dropFrame": True, "startTimecode": "00:00:00;00"})
    assert "FCM: DROP FRAME" in df and "01:00:00;00 01:00:00;01" in df
    # 23.976 counts 24 frames a second; the start timecode is respected
    e24 = to_edl([{**SEGS[0], "start": 1.0, "chapter": "x"}], NAMES, {"fps": 23.976})
    assert "01:00:01:00 01:00:01:01" in e24
    # drop-frame is ignored for rates that do not have it
    assert "NON-DROP" in to_edl(seg, NAMES, {"fps": 25, "dropFrame": True})


def test_edl_falls_back_to_speaker_turns():
    e = to_edl(SEGS, NAMES)
    assert "|M:Anna: Hallo zusammen." in e and "|M:SPEAKER_01: Bonjour." in e


def test_docx_has_talk_share_chapter_band_and_footer():
    import io

    from docx import Document

    from engine.export import to_docx

    segs = [
        {"start": 0, "end": 6, "speaker": "A", "text": "Hallo.", "chapter": "Intro"},
        {"start": 6, "end": 8, "speaker": "B", "text": "Hi."},
    ]
    doc = Document(io.BytesIO(to_docx(segs, {"A": "Anna", "B": "Ben"}, title="T")))
    text = "\n".join(p.text for p in doc.paragraphs)
    assert "75%" in text and "25%" in text and "Intro" in text and "█" in text
    assert "Made with Local Transcriber" in doc.sections[0].footer.paragraphs[0].text


def test_redacted_replaces_names_everywhere():
    from engine.export import to_redacted

    segs = [{"start": 0, "end": 1, "speaker": "A", "text": "Hi, I am Anna."}, {"start": 2, "end": 3, "speaker": "B", "text": "Hello Anna"}]
    t = to_redacted(segs, {"A": "Anna"})
    assert "Anna" not in t and "[00:00:00] P01: Hi, I am [name]." in t and "P02: Hello [name]" in t


def test_quotes_only_marked_lines():
    from engine.export import to_quotes

    segs = [{"start": 5, "end": 6, "speaker": "A", "text": "skip"}, {"start": 65, "end": 66, "speaker": "A", "text": "keep", "marked": True}]
    q = to_quotes(segs, {"A": "Anna"})
    assert "keep" in q and "skip" not in q and "Anna" in q


def test_changes_lists_edits_only():
    from engine.export import to_changes

    segs = [{"start": 0, "end": 1, "speaker": "A", "text": "new", "orig": {"text": "old", "words": []}}, {"start": 1, "end": 2, "speaker": "A", "text": "same"}]
    c = to_changes(segs)
    assert c.startswith("1 edited line of 2") and "original: old" in c and "edited:   new" in c


def test_combined_csv_has_project_column():
    from engine.export import to_combined_csv

    rows = to_combined_csv([{"name": "P1", "segments": SEGS, "speakers": NAMES}]).splitlines()
    assert rows[0].startswith("project,") and rows[1].startswith("P1,0.00")


def test_minutes_docx_has_decisions():
    import io
    from docx import Document
    from engine.export import to_minutes

    segs = [{"start": 0, "end": 1, "speaker": "A", "text": "We ship Friday", "marked": True}]
    d = Document(io.BytesIO(to_minutes(segs, {"A": "Anna"})))
    txt = "\n".join(p.text for p in d.paragraphs)
    assert "Decisions and action items" in txt and "We ship Friday (Anna, 0:00)" in txt


def test_import_folder_copies_known_models(tmp_path, monkeypatch):
    from engine import models

    dst = tmp_path / "dst"
    monkeypatch.setenv("ENGINE_MODELS_DIR", str(dst))
    src = tmp_path / "src" / "models--Systran--faster-whisper-tiny"
    (src / "blobs").mkdir(parents=True)
    (src / "blobs" / "abc").write_text("x")
    snap = src / "snapshots" / "rev1"
    snap.mkdir(parents=True)
    (snap / "model.bin").symlink_to("../../blobs/abc")
    (tmp_path / "src" / "models--someone--unknown" / "snapshots" / "r").mkdir(parents=True)
    got = models.import_folder(tmp_path / "src")
    assert got == ["Systran/faster-whisper-tiny"]
    assert (dst / "models--Systran--faster-whisper-tiny" / "snapshots" / "rev1" / "model.bin").read_text() == "x"
    assert models.status()["whisper"]["tiny"] is True


def test_import_folder_rejects_empty(tmp_path, monkeypatch):
    import pytest
    from engine import models

    monkeypatch.setenv("ENGINE_MODELS_DIR", str(tmp_path / "dst"))
    with pytest.raises(RuntimeError):
        models.import_folder(tmp_path)


def test_changes_and_minutes_follow_language():
    import io
    from docx import Document
    from engine.export import to_changes, to_minutes

    segs = [{"start": 0, "end": 1, "speaker": "A", "text": "neu", "marked": True, "orig": {"text": "alt", "words": []}}]
    assert to_changes(segs, {}, {"lang": "de"}).startswith("1 geänderte Zeile von 1")
    d = Document(io.BytesIO(to_minutes(segs, {"A": "Anna"}, lang="fr")))
    assert "Décisions et actions" in "\n".join(p.text for p in d.paragraphs)


def test_docx_date_and_footer_are_localised():
    import io
    from datetime import date
    from engine.export import _long_date, to_docx

    assert _long_date(date(2026, 3, 5), "de") == "5. März 2026"
    assert _long_date(date(2026, 3, 5), "es") == "5 de marzo de 2026"
    assert to_docx(SEGS, NAMES, lang="de")[:2] == b"PK"


def test_language_list_matches_faster_whisper():
    from faster_whisper.tokenizer import _LANGUAGE_CODES
    from engine.models import WHISPER_LANGUAGES

    assert set(WHISPER_LANGUAGES) == set(_LANGUAGE_CODES)
    assert {"de", "en", "fr", "es"} <= set(WHISPER_LANGUAGES)


def test_overlap_is_marked_not_dropped():
    from engine.merge import assign_speakers, group_segments

    words = [{"start": 0.0, "end": 1.0, "word": " hi", "prob": 1}, {"start": 1.0, "end": 2.0, "word": " there", "prob": 1}]
    turns = [(0.0, 2.0, "A"), (1.0, 2.0, "B")]
    out = assign_speakers(words, turns)
    assert out[0]["speaker"] == "A" and "overlap" not in out[0]
    assert out[1]["overlap"] == ["B"] or out[1]["overlap"] == ["A"]
    seg = group_segments(out)
    assert any(s.get("overlap") for s in seg)


def test_cuda_choice_comes_from_ctranslate2(monkeypatch):
    import ctranslate2
    from engine import asr

    monkeypatch.setattr(ctranslate2, "get_cuda_device_count", lambda: 1)
    assert asr.pick_device("auto") == ("cuda", "float16")
    monkeypatch.setattr(ctranslate2, "get_cuda_device_count", lambda: 0)
    assert asr.pick_device("auto") == ("cpu", "int8")
    assert asr.pick_device("cpu") == ("cpu", "int8")


def test_clean_style_drops_hesitations_by_language_only():
    from engine.export import apply_style

    segs = [{"start": 0, "end": 2, "speaker": "A", "text": "Äh, ich glaube, ähm, das stimmt."}]
    out = apply_style(segs, {"style": "clean"}, "de")
    assert out[0]["text"] == "Ich glaube, das stimmt."
    # "er" is a German pronoun, so it must survive in German and only be dropped in English
    assert apply_style([{"start": 0, "end": 1, "speaker": "A", "text": "Er kommt."}], {"style": "clean"}, "de")[0]["text"] == "Er kommt."
    assert apply_style([{"start": 0, "end": 1, "speaker": "A", "text": "I, er, think so."}], {"style": "clean"}, "en")[0]["text"] == "I, think so."
    assert apply_style(segs, {"style": "clean"}, "xx") == segs  # unknown language: leave untouched


def test_verbatim_is_default_and_pause_marks_use_gaps():
    from engine.export import apply_style

    words = [{"start": 0.0, "end": 0.4, "word": " Ich"}, {"start": 1.6, "end": 2.0, "word": " weiß"}, {"start": 2.1, "end": 2.5, "word": " nicht"}]
    segs = [{"start": 0, "end": 2.5, "speaker": "A", "text": "Ich weiß nicht", "words": words}]
    assert apply_style(segs, {}, "de") is segs
    assert apply_style(segs, {"pauseMarks": True}, "de")[0]["text"] == "Ich (..) weiß nicht"


def test_text_export_can_drop_timestamps_and_flags_overlap():
    from engine.export import to_txt

    segs = [{"start": 3, "end": 4, "speaker": "A", "text": "hi", "overlap": True}]
    assert to_txt(segs, {}, {"timestamps": False}) == "A [overlap]: hi\n"
    assert to_txt(segs, {}, {"style": "clean"}).startswith("Edited copy")


def test_line_language_shows_only_when_it_differs():
    from engine.export import to_csv, to_txt

    segs = [{"start": 0, "end": 1, "speaker": "A", "text": "bonjour", "lang": "fr"}, {"start": 1, "end": 2, "speaker": "A", "text": "hello", "lang": "en"}]
    t = to_txt(segs, {}, {"fileLanguage": "en", "timestamps": False})
    assert t == "A [fr]: bonjour\nA: hello\n"
    assert to_csv(segs, {}).splitlines()[1].endswith(",bonjour,,fr,")


def test_group_segments_splits_when_the_language_changes():
    from engine.merge import group_segments

    w = lambda s, word, lang: {"start": s, "end": s + 0.5, "word": word, "speaker": "A", "lang": lang}
    segs = group_segments([w(0, " Hello", "en"), w(1, " Hallo", "de"), w(2, " Welt", "de")])
    assert [(s["lang"], s["text"]) for s in segs] == [("en", "Hello"), ("de", "Hallo Welt")]


def test_transcribe_turns_detects_language_per_turn_and_drops_slivers():
    import types
    from engine.asr import transcribe_turns

    class Fake:
        def __init__(self): self.calls = 0
        def transcribe(self, clip, **kw):
            self.calls += 1
            lang = "es" if self.calls == 1 else "fr"
            w = types.SimpleNamespace(start=0.2, end=0.6, word=" hola" if lang == "es" else " bonjour", probability=0.9)
            return [types.SimpleNamespace(words=[w], end=0.6)], types.SimpleNamespace(language=lang, language_probability=0.9)

    import numpy as np
    audio = np.zeros(16000 * 10, dtype="float32")
    turns = [(1.0, 2.5, "A"), (3.0, 3.1, "B"), (5.0, 6.5, "B")]
    words, dominant, info = transcribe_turns(Fake(), audio, 16000, turns, False, None, 0.0)
    assert [(w["word"], w["lang"]) for w in words] == [(" hola", "es"), (" bonjour", "fr")]
    assert info["languages"] == {"es": 1.5, "fr": 1.5}
    assert words[0]["start"] > 1.0 - 0.01  # time is shifted back into file time


def test_translation_is_exported_under_the_line():
    import io
    from docx import Document
    from engine.export import to_csv, to_docx, to_md, to_txt

    segs = [{"start": 0, "end": 1, "speaker": "A", "text": "bonjour", "lang": "fr", "translation": "hello"}]
    assert "A [fr]: bonjour\n    → hello" in to_txt(segs, {}, {"fileLanguage": "en", "timestamps": False})
    assert "→ hello" not in to_txt(segs, {}, {"translations": False})
    assert "> hello" in to_md(segs, {}, {})
    assert to_csv(segs, {}).splitlines()[1].endswith(",bonjour,,fr,hello")
    d = Document(io.BytesIO(to_docx(segs, {}, options={"fileLanguage": "en"})))
    assert any(p.text == "→ hello" for p in d.paragraphs)


def test_verbatim_prompt_is_in_the_recordings_language_and_after_the_vocabulary():
    from engine.asr import VERBATIM_PROMPTS, build_prompt

    assert build_prompt(None, False, "de") is None
    assert build_prompt("Müller GmbH", False, "de") == "Müller GmbH"
    p = build_prompt("Müller GmbH", True, "de")
    assert p.startswith("Müller GmbH ") and p.endswith(VERBATIM_PROMPTS["de"])
    assert build_prompt(None, True, "ja") is None  # no sample for other languages: nothing is invented


def test_transcribe_passes_the_verbatim_prompt_and_detects_the_language_first():
    import types
    import numpy as np
    from engine.asr import VERBATIM_PROMPTS, transcribe

    seen = {}

    class Fake:
        def detect_language(self, audio): return ("fr", 0.9, [])
        def transcribe(self, audio, **kw):
            seen.update(kw)
            return [], types.SimpleNamespace(language=kw["language"], language_probability=0.9)

    transcribe(np.zeros(16000, dtype="float32"), "small", None, "cpu", False, None, 0.0, 1.0, False, (Fake(), "cpu", "int8"), True)
    assert seen["language"] == "fr" and seen["initial_prompt"] == VERBATIM_PROMPTS["fr"]


def test_backend_choice_follows_the_rules(monkeypatch):
    import pytest
    from engine import asr, asr_mlx, models

    monkeypatch.setattr(asr_mlx, "available", lambda: True)
    monkeypatch.setattr(models, "_cached", lambda repo: True)
    assert asr.pick_backend("auto", "small", "auto", False) == "mlx"
    assert asr.pick_backend("auto", "small", "cpu", False) == "faster"      # the user asked for the CPU
    assert asr.pick_backend("auto", "small", "auto", True) == "faster"      # skip-silence needs faster-whisper's VAD
    assert asr.pick_backend("faster", "small", "auto", False) == "faster"
    monkeypatch.setattr(models, "_cached", lambda repo: False)
    assert asr.pick_backend("auto", "small", "auto", False) == "faster"      # not downloaded: fall back quietly
    with pytest.raises(RuntimeError):
        asr.pick_backend("mlx", "small", "auto", False)                      # explicitly asked for, not downloaded: say so
    monkeypatch.setattr(asr_mlx, "available", lambda: False)
    assert asr.pick_backend("auto", "small", "auto", False) == "faster"


def test_mlx_wrapper_returns_faster_whisper_shaped_results(monkeypatch):
    import sys
    import types
    import numpy as np
    from engine.asr_mlx import MlxModel

    calls = {}

    def fake_transcribe(audio, **kw):
        calls.update(kw)
        return {"segments": [{"start": 0.0, "end": 1.0, "text": " Hallo", "words": [{"word": " Hallo", "start": 0.0, "end": 0.9, "probability": 0.8}]}]}

    monkeypatch.setitem(sys.modules, "mlx_whisper", types.SimpleNamespace(transcribe=fake_transcribe))
    m = MlxModel("/models/x")
    monkeypatch.setattr(m, "detect_language", lambda audio, **k: ("de", 0.93, [("de", 0.93)]))
    segs, info = m.transcribe(np.zeros(16000, dtype="float32"), language=None, word_timestamps=True, vad_filter=True,
                              initial_prompt="Müller", condition_on_previous_text=False, multilingual=True, task="translate")
    assert info.language == "de" and info.language_probability == 0.93
    assert segs[0].words[0].word == " Hallo" and segs[0].words[0].probability == 0.8 and segs[0].end == 1.0
    assert calls["language"] == "de" and calls["task"] == "translate" and calls["initial_prompt"] == "Müller"
    assert "vad_filter" not in calls and "multilingual" not in calls  # not supported there, not passed on
