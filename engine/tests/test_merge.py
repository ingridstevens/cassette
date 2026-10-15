from engine.merge import assign_speakers

TURNS = [(0.0, 5.0, "SPEAKER_00"), (5.0, 10.0, "SPEAKER_01")]


def w(start, end, word):
    return {"start": start, "end": end, "word": word}


def test_words_get_speaker_by_max_overlap():
    words = [w(0.1, 0.5, "Hallo"), w(5.2, 5.6, "Hi"), w(4.8, 5.4, "edge")]
    out = assign_speakers(words, TURNS)
    assert [x["speaker"] for x in out] == ["SPEAKER_00", "SPEAKER_01", "SPEAKER_01"]


def test_word_in_gap_goes_to_nearest_turn():
    turns = [(0.0, 2.0, "A"), (6.0, 8.0, "B")]
    out = assign_speakers([w(2.5, 2.9, "x"), w(5.2, 5.6, "y")], turns)
    assert [x["speaker"] for x in out] == ["A", "B"]


def test_no_turns_gives_single_speaker():
    out = assign_speakers([w(0, 1, "a")], [])
    assert out[0]["speaker"] == "SPEAKER_00"


def test_group_into_segments_splits_on_speaker_change_and_long_pause():
    from engine.merge import group_segments

    words = assign_speakers(
        [w(0, .4, " Hallo"), w(.5, .9, " Welt"), w(5.1, 5.5, " Hi"), w(9.5, 9.9, " again")],
        TURNS,
    )
    segs = group_segments(words, max_gap=2.0)
    assert [(s["speaker"], s["text"]) for s in segs] == [
        ("SPEAKER_00", "Hallo Welt"),
        ("SPEAKER_01", "Hi"),
        ("SPEAKER_01", "again"),
    ]
    assert segs[0]["start"] == 0 and segs[0]["end"] == .9
