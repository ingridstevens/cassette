"""Highlights, summary and clip export. The language model is replaced by a fake that answers with canned text, so no model is needed."""
import io
import json
import subprocess
from pathlib import Path

from engine.highlights import find_highlights, locate
from engine.llm import chunk_lines, extract_json
from engine.summarize import parse_clock, snap_topics, summarize, topic_range


def seg(start, text, speaker="A", per=0.5):
    words = [{"start": start + i * per, "end": start + (i + 1) * per, "word": ("" if i == 0 else " ") + w} for i, w in enumerate(text.split())]
    return {"start": start, "end": words[-1]["end"], "speaker": speaker, "text": text, "words": words}


SEGS = [
    seg(0, "Welcome everybody to the show today."),
    seg(10, "Honestly the best thing we ever did was to stop planning and start shipping every single week.", "B"),
    seg(30, "We moved the launch to the fifth of May and Anna will write the announcement."),
]
NAMES = {"A": "Anna", "B": "Ben"}


class Fake:
    def __init__(self, *answers):
        self.answers = list(answers)
        self.prompts = []

    def chat(self, system, user, max_tokens=700, temperature=0.2):
        self.prompts.append(user)
        return self.answers.pop(0)


def test_extract_json_handles_prose_and_fences():
    assert extract_json('Sure! ```json\n[{"a": 1}]\n``` hope that helps') == [{"a": 1}]
    assert extract_json('Result: {"x": [1, 2]} done') == {"x": [1, 2]}
    assert extract_json("no json here") is None


def test_chunk_lines_overlaps_and_covers_everything():
    lines = [f"line {i} " + "x" * 40 for i in range(10)]
    chunks = chunk_lines(lines, budget=130, overlap=1)
    assert chunks[0][0] == 0 and len(chunks) > 1
    seen = {i + k for i, ls in chunks for k in range(len(ls))}
    assert seen == set(range(10))
    assert chunks[1][1][0] == chunks[0][1][-1]  # the last line of a chunk opens the next one


def test_locate_exact_and_forgiving():
    words = SEGS[1]["words"]
    assert locate(words, "the best thing we ever did") == (1, 6)
    assert locate(words, "The best thing, we ever did!") == (1, 6)
    assert locate(words, "the best thing we never did") == (1, 6)  # one word changed
    assert locate(words, "something the model made up entirely") is None


def test_highlights_use_real_words_and_timing():
    quote = "the best thing we ever did was to stop planning and start shipping"
    llm = Fake(json.dumps([{"line": 1, "quote": quote, "score": 9, "reason": "A clear lesson"}]))
    out = find_highlights(SEGS, NAMES, llm, count=3)
    assert len(out) == 1
    h = out[0]
    assert h["text"] == "the best thing we ever did was to stop planning and start shipping"
    assert h["speaker"] == "B" and h["start"] == 10.5 and h["reason"] == "A clear lesson"
    assert h["end"] == SEGS[1]["words"][13]["end"]


def test_highlights_drop_invented_quotes_and_duplicates_and_bad_lines():
    q = "the best thing we ever did was to stop planning"
    llm = Fake(json.dumps([
        {"line": 1, "quote": q, "score": 7, "reason": "a"},
        {"line": 1, "quote": q, "score": 9, "reason": "b"},  # the same passage twice: only the better one stays
        {"line": 0, "quote": "words that were never said in this line at all", "score": 10},
        {"line": 99, "quote": q, "score": 10},
        "not an object",
    ]))
    out = find_highlights(SEGS, NAMES, llm, count=5)
    assert [h["reason"] for h in out] == ["b"]


def test_highlights_survive_a_model_that_does_not_answer_in_json():
    assert find_highlights(SEGS, NAMES, Fake("I could not find anything.", "Still nothing."), count=3) == []


def test_highlights_accept_rows_instead_of_objects():
    q = "the best thing we ever did was to stop planning"
    for answer in ([1, q, 9, "honest"], [[1, q, 9, "honest"]]):
        out = find_highlights(SEGS, NAMES, Fake(json.dumps(answer)), count=3)
        assert [(h["speaker"], h["score"], h["reason"]) for h in out] == [("B", 9.0, "honest")]


def test_highlights_ask_once_more_when_the_answer_is_prose():
    llm = Fake("[1] Ben: the best thing we ever did was to stop planning\n9 - honest", json.dumps([{"line": 1, "quote": "the best thing we ever did was to stop planning", "score": 9}]))
    out = find_highlights(SEGS, NAMES, llm, count=3)
    assert [h["speaker"] for h in out] == ["B"] and "JSON list and nothing else" in llm.prompts[1]


def test_highlights_are_limited_to_count_and_sorted_by_time():
    llm = Fake(json.dumps([
        {"line": 2, "quote": "We moved the launch to the fifth of May", "score": 5},
        {"line": 1, "quote": "the best thing we ever did was to stop planning", "score": 9},
    ]))
    assert [h["speaker"] for h in find_highlights(SEGS, NAMES, llm, count=2)] == ["B", "A"]
    llm = Fake(json.dumps([
        {"line": 2, "quote": "We moved the launch to the fifth of May", "score": 5},
        {"line": 1, "quote": "the best thing we ever did was to stop planning", "score": 9},
    ]))
    assert [h["speaker"] for h in find_highlights(SEGS, NAMES, llm, count=1)] == ["B"]


def test_summary_parses_topics_decisions_actions():
    answer = json.dumps({"summary": "They talked about shipping.", "topics": [{"time": "0:10", "title": "Shipping weekly"}, {"time": "9:99:99", "title": "bad"}, {"time": "0:30", "title": "Launch"}],
                         "decisions": [{"text": "Launch on 5 May", "at": "0:29"}, "Plain string", {"text": "Off the end", "at": "59:00"}, ""],
                         "actions": [{"text": "Write the announcement", "owner": "Anna", "at": "0:31"}, {"text": "Book a room", "owner": "null"}]})
    s = summarize(SEGS, NAMES, Fake(answer), "en")
    assert s["summary"] == "They talked about shipping."
    assert s["topics"] == [{"start": 10.0, "title": "Shipping weekly"}]  # a 37-second recording gets one topic, however many the model wrote
    assert s["decisions"] == [{"text": "Launch on 5 May", "line": 2}, {"text": "Plain string", "line": None}, {"text": "Off the end", "line": None}]
    assert s["actions"] == [{"line": 2, "text": "Write the announcement", "owner": "Anna"}, {"line": None, "text": "Book a room", "owner": None}]


def test_topics_snap_to_the_line_they_fall_in_once_per_line():
    topics = [{"start": 0.0, "title": "Intro"}, {"start": 5.0, "title": "Weather"}, {"start": 15.0, "title": "Shipping"}, {"start": 20.0, "title": "Again"}, {"start": 31.0, "title": "Launch"}]
    assert snap_topics(topics, SEGS) == [{"start": 0.0, "title": "Intro"}, {"start": 10.0, "title": "Shipping"}, {"start": 30.0, "title": "Launch"}]


def test_short_recordings_ask_for_fewer_topics():
    assert topic_range(30) == "exactly 1"
    assert topic_range(600) == "between 2 and 5"
    assert topic_range(3 * 3600) == "between 2 and 8"


def test_summary_of_a_long_recording_summarises_the_parts_first():
    long = [seg(i * 60, "word " * 400) for i in range(5)]  # about 2000 characters each: several chunks
    chunks = len(chunk_lines([f"[0:00] A: {s['text']}" for s in long], budget=7000, overlap=0))
    assert chunks > 1
    llm = Fake(*(["- notes"] * chunks + [json.dumps({"summary": "S", "topics": [], "decisions": [], "actions": []})]))
    assert summarize(long, {}, llm, "en")["summary"] == "S"
    assert "Notes on the parts" in llm.prompts[-1]


def test_summary_keeps_plain_text_when_the_model_skips_json():
    s = summarize(SEGS, NAMES, Fake("They talked about shipping."), "en")
    assert s["summary"] == "They talked about shipping." and s["topics"] == []


def test_parse_clock():
    assert parse_clock("1:05") == 65 and parse_clock("1:02:03") == 3723 and parse_clock("soon") is None


def test_quotes_merge_highlights_and_marked_lines():
    from engine.export import quote_list, to_highlights_docx, to_quotes

    segs = [dict(s) for s in SEGS]
    segs[1]["marked"] = True  # holds a highlight of its own, so only the finer quote is listed
    segs[2]["marked"] = True
    hl = [{"start": 10.5, "end": 13.0, "text": "the best thing we ever did", "speaker": "B", "ai": True, "reason": "Lesson"}]
    q = quote_list(segs, hl)
    assert [x["text"] for x in q] == ["the best thing we ever did", SEGS[2]["text"]]
    text = to_quotes(segs, NAMES, hl)
    assert "“the best thing we ever did”\n— Ben, 0:10" in text and "— Anna, 0:30" in text
    assert to_quotes([], NAMES, None) == ""
    from docx import Document

    d = Document(io.BytesIO(to_highlights_docx(segs, NAMES, hl, title="Show")))
    assert any("the best thing we ever did" in p.text for p in d.paragraphs) and any("Lesson" in p.text for p in d.paragraphs)


def test_minutes_include_summary_and_key_quotes():
    from docx import Document

    from engine.export import to_minutes

    summary = {"summary": "They talked about shipping.", "topics": [{"start": 10, "title": "Shipping"}], "decisions": [{"text": "Launch on 5 May", "line": 2}, "Old saved decision"], "actions": [{"text": "Write the announcement", "owner": "Anna", "line": 2}, {"text": "Old action", "owner": None}]}
    hl = [{"start": 10.5, "end": 13.0, "text": "the best thing we ever did", "speaker": "B"}]
    d = Document(io.BytesIO(to_minutes(SEGS, NAMES, summary=summary, highlights=hl)))
    text = "\n".join(p.text for p in d.paragraphs)
    for needle in ("Summary", "They talked about shipping.", "0:10  Shipping", "[0:30] Launch on 5 May", "Old saved decision", "Key quotes", "the best thing we ever did"):
        assert needle in text
    cells = [c.text for r in d.tables[0].rows for c in r.cells]  # action items are a table now (owner, action, due)
    assert "[0:30] Write the announcement" in cells and "Anna" in cells and "Old action" in cells


def test_export_clips_one_file_per_clip(tmp_path):
    import wave

    from engine.audio import export_clips, ffmpeg_exe

    src = tmp_path / "in.wav"
    with wave.open(str(src), "wb") as f:
        f.setnchannels(1), f.setsampwidth(2), f.setframerate(16000)
        f.writeframes(b"\x00\x00" * 16000 * 12)
    clips = [{"start": 2.0, "end": 4.0, "speaker": "Anna/Ben: ?"}, {"start": 7.5, "end": 9.0}]
    for fmt in ("wav", "mp3", "m4a"):
        out = tmp_path / fmt
        paths = export_clips(str(src), str(out), clips, fmt)
        assert [Path(p).name for p in paths] == [f"01 - Anna Ben - 0m02s.{fmt}", f"02 - 0m07s.{fmt}"]
        info = subprocess.run([ffmpeg_exe(), "-i", paths[0]], capture_output=True, text=True).stderr
        assert "Duration: 00:00:02.6" in info or "Duration: 00:00:02.7" in info or "Duration: 00:00:02.5" in info  # 2 s plus 0.3 s of room on each side


def test_retired_language_models_are_listed_only_for_people_who_have_them(tmp_path, monkeypatch):
    from engine import llm, models

    monkeypatch.setenv("ENGINE_MODELS_DIR", str(tmp_path))
    monkeypatch.setattr(llm, "backend", lambda: "mlx")
    ids = lambda: [m["id"] for m in models.llm_status()["catalog"]]  # noqa: E731
    assert "small" not in ids() and models.llm_status()["default"] in ids()
    snap = tmp_path / ("models--" + llm.repo_for("small", "mlx")[0].replace("/", "--")) / "snapshots" / models.PINS[llm.repo_for("small", "mlx")[0]]
    snap.mkdir(parents=True)
    (snap / "model.safetensors").write_bytes(b"x")
    assert "small" in ids()


def test_ask_picks_lines_and_drops_unshown_sources():
    from engine.ask import ask, select_lines

    llm = Fake('{"answer": "Anna writes the announcement.", "lines": [2, 7, "x", 2]}')
    out = ask(SEGS, NAMES, "Who writes the announcement?", llm)
    assert out == {"text": "Anna writes the announcement.", "sources": [2], "used": 3, "total": 3}
    assert "Anna: We moved the launch" in llm.prompts[0]

    many = [seg(i * 10, f"filler talk number {i} about nothing") for i in range(400)] + [seg(5000, "The budget for the garden is nine thousand euros.", "B")]
    picked = select_lines(many, NAMES, "What is the garden budget?")
    assert 400 in picked and len(picked) < 100

    prose = ask(SEGS, NAMES, "anything?", Fake("I would say no."))
    assert prose["text"] == "I would say no." and prose["sources"] == []
