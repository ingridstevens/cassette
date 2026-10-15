"""Finds the most quotable moments of a transcript with the local language model.

The model only chooses; it never writes the result. Every suggestion is matched back to the real words of the transcript
(so the text and the audio timing always come from the recording), and one that cannot be found there is dropped.
"""
import math
import re
from difflib import SequenceMatcher

from .llm import LANGUAGE_NAMES, LocalLLM, chunk_lines, extract_json

MIN_SECONDS, MAX_SECONDS = 1.5, 90.0
SYSTEM = (
    "You help a producer find soundbites in a transcript. A soundbite is a short, self-contained passage that is insightful, surprising, "
    "funny, emotional or decisive, and that makes sense without the rest of the conversation. Skip greetings, small talk and filler."
)


def _norm(word: str) -> str:
    return re.sub(r"[\W_]+", "", word.lower())


def locate(words: list[dict], quote: str) -> tuple[int, int] | None:
    """The first and last word (indexes into `words`) that the model's quote refers to, or None when it is not in this line.
    Tolerates the small changes models make when they copy: punctuation, capital letters, a dropped or changed word."""
    q = [t for t in (_norm(w) for w in quote.split()) if t]
    w = [_norm(x["word"]) for x in words]
    if len(q) < 3 or not any(w):
        return None
    for i in range(len(w) - len(q) + 1):
        if w[i:i + len(q)] == q:
            return i, i + len(q) - 1
    blocks = [b for b in SequenceMatcher(None, w, q, autojunk=False).get_matching_blocks() if b.size]
    if not blocks or sum(b.size for b in blocks) < 0.7 * len(q):
        return None
    return blocks[0].a, blocks[-1].a + blocks[-1].size - 1


def _line(i: int, seg: dict, names: dict) -> str:
    return f"[{i}] {names.get(seg['speaker'], seg['speaker'])}: {seg['text']}"


def _ask(llm: LocalLLM, lines: list[str], want: int, language: str) -> list[dict]:
    user = (
        "Transcript lines, each starting with its number in brackets:\n\n" + "\n".join(lines) + "\n\n"
        f"Pick up to {want} soundbites. For each one reply with the line number, the quote and a score from 1 (fine) to 10 (excellent). "
        "Rules: copy the quote word for word from ONE line (10 to 45 words, no changes, no shortening with dots); "
        f"give a reason of at most 12 words, written in {language}. "
        'Reply with a JSON list only, for example [{"line": 12, "quote": "…", "score": 8, "reason": "…"}]. Reply [] if nothing is worth quoting.'
    )
    def items(answer: str) -> list[dict] | None:
        data = extract_json(answer)
        return _as_items(data) if isinstance(data, list) else None

    found = items(llm.chat(SYSTEM, user, max_tokens=900))
    if found is None:  # small models sometimes answer in prose; asking once more for the JSON alone usually fixes it
        found = items(llm.chat(SYSTEM, user + "\n\nYour answer must be the JSON list and nothing else.", max_tokens=900))
    return found or []


def _as_items(data: list) -> list[dict] | None:
    """The suggestions in a parsed answer, or None when it holds none. Besides the asked-for objects, accepts the shapes small models
    drift into: rows like [line, quote, score, reason], or one flat list of those values. A prose answer such as "[3] Anna: …" parses
    as the list [3] and counts as none."""
    if not data:
        return []
    keys = ("line", "quote", "score", "reason")
    if any(isinstance(d, dict) for d in data):
        return [d for d in data if isinstance(d, dict)]
    rows = [d for d in data if isinstance(d, list)] or ([data[i:i + 4] for i in range(0, len(data), 4)] if len(data) % 4 == 0 else [data])
    out = [dict(zip(keys, r)) for r in rows if len(r) >= 2 and isinstance(r[1], str)]
    return out or None


def default_count(duration: float) -> int:
    return min(12, max(3, round(duration / 240)))


def find_highlights(segs: list[dict], names: dict, llm: LocalLLM, count: int | None = None, language: str = "en", on_progress=lambda f: None) -> list[dict]:
    """Up to `count` highlights, best first by score and then in the order they occur. Each is
    {start, end, text, speaker, score, reason}; `start`/`end` are seconds in the recording."""
    if not segs:
        return []
    duration = max(s["end"] for s in segs) - min(s["start"] for s in segs)
    count = count or default_count(duration)
    lang = LANGUAGE_NAMES.get(language[:2], "English")
    chunks = chunk_lines([_line(i, s, names) for i, s in enumerate(segs)])
    found: list[dict] = []
    for n, (first, lines) in enumerate(chunks):
        on_progress(n / len(chunks))
        for item in _ask(llm, lines, max(2, math.ceil(count / len(chunks)) + 1), lang):
            try:
                i = int(item["line"])
                seg = segs[i]
                span = locate(seg.get("words") or [], str(item["quote"]))
            except (KeyError, ValueError, TypeError, IndexError):
                continue
            if span is None:
                continue
            ws = seg["words"][span[0]:span[1] + 1]
            start, end = ws[0]["start"], ws[-1]["end"]
            if not MIN_SECONDS <= end - start <= MAX_SECONDS:
                continue
            try:
                score = float(item.get("score", 5))
            except (TypeError, ValueError):
                score = 5.0
            found.append({"start": start, "end": end, "text": "".join(w["word"] for w in ws).strip(), "speaker": seg["speaker"],
                          "score": max(1.0, min(10.0, score)), "reason": str(item.get("reason") or "").strip()[:160]})
    on_progress(1.0)
    chosen: list[dict] = []
    for h in sorted(found, key=lambda h: -h["score"]):  # best first; a passage found twice (overlapping chunks) is kept once
        if any(min(h["end"], c["end"]) - max(h["start"], c["start"]) > 0.3 * min(h["end"] - h["start"], c["end"] - c["start"]) for c in chosen):
            continue
        chosen.append(h)
        if len(chosen) == count:
            break
    return sorted(chosen, key=lambda h: h["start"])
