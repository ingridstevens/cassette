"""Issue #320: unsure wording, unconfirmed speaker, overlap, checked lines, recording gaps and the untranscribed rest in the text, Word and quote exports."""
import io

from docx import Document

from engine.export import to_docx, to_quotes, to_txt

NAMES = {"A": "Anna", "B": "Ben"}
SEGS = [
    {"start": 0.0, "end": 4.0, "speaker": "A", "text": "We ship on Friday."},
    {"start": 5.0, "end": 9.0, "speaker": "A", "text": "Brandt will send the invoice.", "unsure": ["Brandt"]},
    {"start": 9.0, "end": 12.0, "speaker": "B", "text": "Both talking at once.", "overlap": True},
    {"start": 300.0, "end": 304.0, "speaker": "B", "text": "Back after the break.", "unsure": ["break"]},
    {"start": 305.0, "end": 308.0, "speaker": "A", "text": "I listened to this one.", "heard": True, "unsure": ["listened"]},
]
OPTS = {
    "cues": True, "unconfirmedSpeakers": ["B"],
    "boundaries": [{"at": 300.0, "kind": "gap", "seconds": 125}],
    "untranscribed": [{"start": 400.0}],
}


def lines(text):
    return text.splitlines()


def test_each_cue_lands_on_its_line():
    out = lines(to_txt(SEGS, NAMES, OPTS))
    assert out[0] == "[00:00:00] Anna: We ship on Friday."  # nothing to say: no label
    assert out[1] == "[00:00:05] Anna [wording unsure: Brandt]: Brandt will send the invoice."
    assert "[00:00:09] Ben [overlap, speaker unconfirmed]: Both talking at once." in out
    assert "[00:05:00] [Gap of 2 min 5 s: nothing was recorded between these two recordings.]" in out
    i = out.index("[00:05:00] [Gap of 2 min 5 s: nothing was recorded between these two recordings.]")
    assert out[i + 1] == "[00:05:00] Ben [wording unsure: break, speaker unconfirmed]: Back after the break."
    assert out[i + 2] == "[00:05:05] Anna [checked by a person]: I listened to this one."
    assert out[-1] == "[00:06:40] [Not transcribed: everything after 6:40. Only a sample was transcribed.]"


def test_overlap_alone_does_not_claim_an_uncertain_speaker():
    out = to_txt([{"start": 0, "end": 2, "speaker": "A", "text": "Hi", "overlap": True}], NAMES, {"cues": True})
    assert "Anna [overlap]: Hi" in out
    assert "unconfirmed" not in out and "unsure" not in out


def test_clean_export_gains_no_labels():
    clean = [{"start": 0.0, "end": 2.0, "speaker": "A", "text": "Hello."}, {"start": 3.0, "end": 5.0, "speaker": "B", "text": "Hi."}]
    assert to_txt(clean, NAMES, {"cues": True, "unconfirmedSpeakers": [], "boundaries": [], "untranscribed": []}) == to_txt(clean, NAMES)
    assert to_txt(clean, NAMES, {"cues": True}) == "[00:00:00] Anna: Hello.\n[00:00:03] Ben: Hi.\n"


def test_without_the_option_nothing_is_added():
    assert "[wording" not in to_txt(SEGS, NAMES, {k: v for k, v in OPTS.items() if k != "cues"})


def test_unknown_gap_and_overlap_have_their_own_words():
    o = {"cues": True, "boundaries": [{"at": 5.0, "kind": "unknown"}, {"at": 300.0, "kind": "overlap", "seconds": 30}]}
    out = to_txt(SEGS, NAMES, o)
    assert "[Possible gap: something may be missing between these two recordings, and nobody knows how much.]" in out
    assert "[The recordings overlap by 30 s: some words may appear twice.]" in out
    assert "Gap of" not in out


def test_notes_without_timestamps_and_in_german():
    out = to_txt(SEGS, NAMES, {**OPTS, "timestamps": False, "lang": "de"})
    assert "[Lücke von 2 min 5 s: Zwischen diesen beiden Aufnahmen wurde nichts aufgenommen.]" in out
    assert "Anna [Wortlaut unsicher: Brandt]: " in out
    assert "[von einer Person geprüft]" in out


def test_word_export_has_the_same_cues_as_plain_text():
    doc = Document(io.BytesIO(to_docx(SEGS, NAMES, title="T", options=OPTS)))
    text = "\n".join(p.text for p in doc.paragraphs)
    assert "Anna   00:00:05 [wording unsure: Brandt]" in text
    assert "wording unsure: break, speaker unconfirmed" in text
    assert "overlap, speaker unconfirmed" in text
    assert "checked by a person" in text
    assert "Gap of 2 min 5 s: nothing was recorded between these two recordings." in text
    assert text.rstrip().endswith("Only a sample was transcribed.")
    # the gap note sits before the line that follows it
    assert text.index("Gap of") < text.index("Back after the break.")


def test_word_export_of_a_clean_file_has_no_cue_text():
    clean = [{"start": 0.0, "end": 2.0, "speaker": "A", "text": "Hello."}]
    text = "\n".join(p.text for p in Document(io.BytesIO(to_docx(clean, NAMES, title="T", options={"cues": True}))).paragraphs)
    assert text == "\n".join(p.text for p in Document(io.BytesIO(to_docx(clean, NAMES, title="T"))).paragraphs)
    assert "[" not in text


def test_quotes_carry_the_cues_of_their_line():
    hl = [{"start": 5.0, "end": 7.0, "text": "Brandt will send", "speaker": "A"}, {"start": 0.0, "end": 2.0, "text": "We ship", "speaker": "A"}]
    out = to_quotes(SEGS, NAMES, hl, OPTS)
    assert "“We ship”\n— Anna, 0:00\n" in out + "\n"
    assert "“Brandt will send”\n— Anna, 0:05 [wording unsure: Brandt]" in out
    # an unsure word outside the quoted words is not mentioned
    out2 = to_quotes(SEGS, NAMES, [{"start": 5.0, "end": 6.0, "text": "will send", "speaker": "A"}], OPTS)
    assert "unsure" not in out2
    assert "unsure" not in to_quotes(SEGS, NAMES, hl)


def test_checked_line_wins_over_other_doubts():
    out = to_txt([{"start": 0, "end": 1, "speaker": "B", "text": "x", "heard": True, "unsure": ["x"]}], NAMES, OPTS)
    assert "Ben [checked by a person]: x" in out and "unsure" not in out and "unconfirmed" not in out


def _run(tmp_path, fmt, extra=None):
    import argparse
    import json

    from engine import main

    t, out = tmp_path / "t.json", tmp_path / f"out.{fmt}"
    t.write_text(json.dumps({"segments": SEGS, "speakers": NAMES, "language": "en", "lang": "en", "highlights": [], **(extra or {})}))
    main.cmd_export(argparse.Namespace(transcript=str(t), output=str(out), format=fmt, key_output=None))
    return out


def test_export_command_reads_the_cue_fields_for_text_word_and_quotes_only(tmp_path):
    extra = {"unconfirmedSpeakers": ["B"], "boundaries": OPTS["boundaries"], "untranscribed": OPTS["untranscribed"]}
    txt = _run(tmp_path, "txt", extra).read_text()
    assert "Gap of 2 min 5 s" in txt and "Ben [overlap, speaker unconfirmed]" in txt
    assert _run(tmp_path, "docx", extra).read_bytes()[:2] == b"PK"
    for fmt in ("srt", "md", "csv", "json"):
        body = _run(tmp_path, fmt, extra).read_text()
        assert "unconfirmed" not in body and "Gap of" not in body and "wording unsure" not in body
    assert "speaker unconfirmed" not in _run(tmp_path, "txt", {"unconfirmedSpeakers": "B"}).read_text()  # a field of the wrong shape is ignored
