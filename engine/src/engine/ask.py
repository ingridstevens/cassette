"""Answers a question about one transcript with the local language model.

The model only sees the lines of this transcript (all of them when they fit, otherwise the ones that best match the question, with their
neighbours) and must point to the lines it used. The line numbers it names are checked against what it was shown, and a number that was not
shown is dropped, so every source the app displays is a real line of the recording.
"""
import math
import re

from .llm import LANGUAGE_NAMES, LocalLLM, extract_json
from .summarize import _clock

BUDGET = 7000  # characters of transcript the model reads at once
SYSTEM = (
    "You answer questions about one conversation, using only its transcript. Never use outside knowledge and never invent names, numbers, dates or quotes. "
    "If the transcript does not answer the question, say so plainly. Be short and concrete."
)


def _text(i: int, seg: dict, names: dict) -> str:
    return f"{names.get(seg['speaker'], seg['speaker'])}: {seg['text']}"


def _words(text: str) -> list[str]:
    return [w for w in re.findall(r"\w+", text.lower()) if len(w) >= 3]


def select_lines(segs: list[dict], names: dict, question: str, budget: int = BUDGET) -> list[int]:
    """Indexes of the lines to show the model, in order. Everything when it fits; otherwise the lines sharing the most (rare) words
    with the question, each with the line before and after it, until the budget is used."""
    sizes = [len(_text(i, s, names)) + 12 for i, s in enumerate(segs)]
    if sum(sizes) <= budget:
        return list(range(len(segs)))
    docs = [set(_words(_text(i, s, names))) for i, s in enumerate(segs)]
    df: dict[str, int] = {}
    for d in docs:
        for w in d:
            df[w] = df.get(w, 0) + 1
    q = set(_words(question))
    scores = [sum(math.log(1 + len(segs) / df[w]) for w in q & d) for d in docs]
    ranked = [i for i in sorted(range(len(segs)), key=lambda i: -scores[i]) if scores[i] > 0]
    if not ranked:  # nothing matches by words (a question like "what is this about"): sample the recording evenly
        step = max(1, math.ceil(sum(sizes) / budget))
        ranked = list(range(0, len(segs), step))
    chosen: set[int] = set()
    used = 0
    for i in ranked:
        group = [j for j in (i - 1, i, i + 1) if 0 <= j < len(segs) and j not in chosen]
        cost = sum(sizes[j] for j in group)
        if used + cost > budget:
            if used:
                continue
            group, cost = [i], sizes[i]
        chosen.update(group)
        used += cost
    return sorted(chosen)


def ask(segs: list[dict], names: dict, question: str, llm: LocalLLM, language: str = "en", history: list[dict] | None = None, on_progress=lambda f: None) -> dict:
    """{text: str, sources: [line index], used: int, total: int}"""
    if not segs:
        return {"text": "", "sources": [], "used": 0, "total": 0}
    lang = LANGUAGE_NAMES.get(language[:2], "English")
    shown = select_lines(segs, names, question)
    on_progress(0.2)
    lines = [f"[{i}] ({_clock(segs[i]['start'])}) {_text(i, segs[i], names)}" for i in shown]
    earlier = ""
    if history:  # the last few exchanges, so "and what did she say about it?" can be understood
        earlier = "Earlier in this chat:\n" + "\n".join(f"Question: {h['q']}\nAnswer: {h['a']}" for h in history[-3:]) + "\n\n"
    user = (
        "Transcript lines, each starting with its number in brackets and its time:\n\n" + "\n".join(lines) + "\n\n"
        + earlier + f"Question: {question}\n\n"
        f"Answer in the language of the question (the recording is in {lang}). Reply with JSON only, in exactly this shape:\n"
        '{"answer": "your answer, plain text; use lines starting with \\"- \\" for a list", "lines": [numbers of the transcript lines your answer is based on]}\n'
        'If the transcript does not contain the answer, reply {"answer": "The transcript does not say.", "lines": []} (in the language of the question).'
    )
    raw = llm.chat(SYSTEM, user, max_tokens=800)
    on_progress(1.0)
    data = extract_json(raw)
    if not isinstance(data, dict) or not isinstance(data.get("answer"), str):  # not JSON: keep the model's words, without sources
        return {"text": raw.strip(), "sources": [], "used": len(shown), "total": len(segs)}
    ok = set(shown)
    sources: list[int] = []
    for n in data.get("lines") if isinstance(data.get("lines"), list) else []:
        try:
            i = int(n)
        except (TypeError, ValueError):
            continue
        if i in ok and i not in sources:
            sources.append(i)
    return {"text": data["answer"].strip(), "sources": sorted(sources)[:12], "used": len(shown), "total": len(segs)}
