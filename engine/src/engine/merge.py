"""Pure logic: attach diarization speakers to ASR words and group into segments."""

Turn = tuple[float, float, str]


def _overlap(a0: float, a1: float, b0: float, b1: float) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def assign_speakers(words: list[dict], turns: list[Turn]) -> list[dict]:
    """Give each word the speaker with the largest time overlap (nearest turn if none)."""
    out = []
    for word in words:
        speaker = "SPEAKER_00"
        if turns:
            best = max(turns, key=lambda t: _overlap(word["start"], word["end"], t[0], t[1]))
            if _overlap(word["start"], word["end"], best[0], best[1]) > 0:
                speaker = best[2]
            else:
                mid = (word["start"] + word["end"]) / 2
                speaker = min(turns, key=lambda t: min(abs(mid - t[0]), abs(mid - t[1])))[2]
        item = {**word, "speaker": speaker}
        others = _overlapping(word, speaker, turns)
        if others:
            item["overlap"] = others
        out.append(item)
    return out


def _overlapping(word: dict, speaker: str, turns: list[Turn], min_share: float = 0.5) -> list[str]:
    """Other speakers who were talking during at least `min_share` of this word (overlapping speech)."""
    dur = max(word["end"] - word["start"], 0.01)
    found = {t[2] for t in turns if t[2] != speaker and _overlap(word["start"], word["end"], t[0], t[1]) >= min_share * dur}
    return sorted(found)


def group_segments(words: list[dict], max_gap: float = 2.0) -> list[dict]:
    """Group consecutive same-speaker words; split on speaker change or a pause > max_gap."""
    segments: list[dict] = []
    for word in words:
        cur = segments[-1] if segments else None
        if cur and cur["speaker"] == word["speaker"] and cur.get("lang") == word.get("lang") and word["start"] - cur["end"] <= max_gap:
            cur["words"].append(word)
            cur["end"] = word["end"]
        else:
            segments.append(
                {"start": word["start"], "end": word["end"], "speaker": word["speaker"], "words": [word],
                 **({"lang": word["lang"]} if word.get("lang") else {})}
            )
    for seg in segments:
        seg["text"] = "".join(w["word"] for w in seg["words"]).strip()
        if any(w.get("overlap") for w in seg["words"]):
            seg["overlap"] = True
    return segments
