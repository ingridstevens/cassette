"""Meeting summary with the local language model: a short summary, topics with times, decisions and action items.

Long recordings are summarised in pieces first and the notes are then combined (map and reduce), so the model never has to read more than a few pages at once.
"""
import re

from .llm import LANGUAGE_NAMES, LocalLLM, chunk_lines, extract_json

SYSTEM = (
    "You write accurate minutes of a conversation from its transcript. Use only what was said. Never invent names, numbers, dates, decisions or tasks. "
    "If something is not in the transcript, leave it out."
)


def _clock(sec: float) -> str:
    t = int(sec)
    return f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60}:{t % 60:02d}"


def parse_clock(text: str) -> float | None:
    m = re.fullmatch(r"\s*(?:(\d+):)?(\d{1,3}):(\d{2})\s*", str(text))
    return int(m.group(1) or 0) * 3600 + int(m.group(2)) * 60 + int(m.group(3)) if m else None


def _lines(segs: list[dict], names: dict) -> list[str]:
    return [f"[{_clock(s['start'])}] {names.get(s['speaker'], s['speaker'])}: {s['text']}" for s in segs]


def max_topics(duration: float) -> int:
    """About one topic per two minutes, so a short clip isn't cut into a topic every few seconds."""
    return max(1, min(8, round(duration / 120)))


def topic_range(duration: float) -> str:
    most = max_topics(duration)
    return "exactly 1" if most == 1 else f"between 2 and {most}"


def snap_topics(topics: list[dict], segs: list[dict]) -> list[dict]:
    """Moves each topic to the start of the line its time falls in (models round times or make them up), and keeps one topic per line."""
    out: list[dict] = []
    for tp in sorted(topics, key=lambda t: t["start"]):
        seg = next((s for s in reversed(segs) if s["start"] <= tp["start"] + 0.5), segs[0])
        if not any(o["start"] == seg["start"] for o in out):
            out.append({"start": float(seg["start"]), "title": tp["title"]})
    return out


def _texts(items, key: str | None = None) -> list[str]:
    out = []
    for x in items if isinstance(items, list) else []:
        v = x.get(key) if isinstance(x, dict) and key else x
        if isinstance(v, str) and v.strip():
            out.append(v.strip())
    return out


def summarize(segs: list[dict], names: dict, llm: LocalLLM, language: str = "en", on_progress=lambda f: None) -> dict:
    """{summary: str, topics: [{start, title}], decisions: [str], actions: [{text, owner}]}"""
    if not segs:
        return {"summary": "", "topics": [], "decisions": [], "actions": []}
    lang = LANGUAGE_NAMES.get(language[:2], "English")
    duration = max(s["end"] for s in segs)
    chunks = chunk_lines(_lines(segs, names), budget=7000, overlap=0)
    if len(chunks) == 1:
        material = "Transcript:\n" + "\n".join(chunks[0][1])
    else:
        notes = []
        for n, (_i, lines) in enumerate(chunks):
            on_progress(n / (len(chunks) + 1))
            notes.append(f"Part {n + 1}:\n" + llm.chat(
                SYSTEM, "Transcript part, lines start with their time:\n\n" + "\n".join(lines) + "\n\n"
                f"Write notes on this part in {lang}: the topics discussed (keep the time of each), the decisions made and the tasks agreed with who does them. "
                "Short bullet points, at most 150 words.", max_tokens=450))
        material = "Notes on the parts of the conversation, in order:\n\n" + "\n\n".join(notes)
    on_progress(len(chunks) / (len(chunks) + 1))
    user = (
        material + "\n\n"
        f"Write the minutes in {lang}. Reply with JSON only, in exactly this shape:\n"
        '{"summary": "3 to 5 sentences on what the conversation was about and where it ended up", '
        '"topics": [{"time": "m:ss", "title": "short title"}], '
        '"decisions": ["a decision that was made"], '
        '"actions": [{"text": "a task that was agreed", "owner": "the person responsible, or null"}]}\n'
        f"The recording is {_clock(duration)} long. Use {topic_range(duration)} topics, each with the time it starts, taken from the transcript. "
        "Use empty lists when there are no decisions or tasks."
    )
    raw = llm.chat(SYSTEM, user, max_tokens=1100)
    data = extract_json(raw)
    on_progress(1.0)
    if not isinstance(data, dict):  # the model did not answer in JSON: keep its words as the summary rather than failing
        return {"summary": raw.strip(), "topics": [], "decisions": [], "actions": []}
    topics = []
    for x in data.get("topics") if isinstance(data.get("topics"), list) else []:
        at = parse_clock(x.get("time", "")) if isinstance(x, dict) else None
        title = str(x.get("title", "")).strip() if isinstance(x, dict) else ""
        if at is not None and at <= duration + 1 and title:
            topics.append({"start": float(at), "title": title[:120]})
    actions = []
    for x in data.get("actions") if isinstance(data.get("actions"), list) else []:
        text = (x.get("text") if isinstance(x, dict) else x) or ""
        owner = x.get("owner") if isinstance(x, dict) else None
        if isinstance(text, str) and text.strip():
            actions.append({"text": text.strip(), "owner": owner.strip() if isinstance(owner, str) and owner.strip().lower() not in ("", "null", "none", "n/a") else None})
    return {"summary": str(data.get("summary") or "").strip(), "topics": snap_topics(topics, segs)[:max_topics(duration)], "decisions": _texts(data.get("decisions")), "actions": actions}
