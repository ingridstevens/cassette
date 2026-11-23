"""Transcript exporters. Segments: {start, end, speaker, text}; names maps speaker id -> display name."""
import csv
import io
import json


def _name(seg: dict, names: dict[str, str]) -> str:
    return names.get(seg["speaker"], seg["speaker"])


def _ts(sec: float, sep: str = ",", hours: bool = True) -> str:
    ms = round(sec * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


# ---- Words the exports write themselves (everything else is the user's own text) -----------------------------
_L = {
    "en": {"sharesHead": "Language share:", "time": "Time", "speakerCol": "Speaker", "translation": "Translation", "summary": "Summary", "topics": "Topics", "actions": "Action items", "owner": "Owner", "task": "Action", "due": "Due", "keyquotes": "Key quotes", "highlights": "Highlights", "nohighlights": "Nothing was highlighted. Select text in the transcript and choose Highlight.", "aisummary": "Written by a language model on this computer. Check it before you share it.", "aihighlight": "suggested by the language model", "speaker": "speaker", "speakers": "speakers", "participants": "Participants: ", "footer": "Made with Cassette  ·  page ",
           "cueUnsure": "wording unsure: {words}", "cueSpeaker": "speaker unconfirmed", "cueChecked": "checked by a person",
           "noteGap": "Gap of {length}: nothing was recorded between these two recordings.", "noteUnknown": "Possible gap: something may be missing between these two recordings, and nobody knows how much.", "noteOverlap": "The recordings overlap by {length}: some words may appear twice.", "noteTrial": "Not transcribed: everything after {at}. Only a sample was transcribed.",
           "attendees": "Attendees", "decisions": "Decisions and action items", "nomarks": "No lines were marked. Mark a line in the transcript to list it here.",
           "record": "Record", "minutes": "Meeting minutes", "edited1": "{n} edited line of {m}", "editedN": "{n} edited lines of {m}",
           "original": "original: ", "edited": "edited:   ",
           "cleannote": "Edited copy: hesitations such as “um” and “uh” were removed. This is not a verbatim record.", "pausenote": "Pauses are marked (.) about half a second, (..) about one second, (...) two seconds or more.", "overlap": "overlap",
           "months": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]},
    "de": {"sharesHead": "Sprachanteile:", "time": "Zeit", "speakerCol": "Sprecher", "translation": "Übersetzung", "summary": "Zusammenfassung", "topics": "Themen", "actions": "Aufgaben", "owner": "Verantwortlich", "task": "Aufgabe", "due": "Fällig bis", "keyquotes": "Zitate", "highlights": "Highlights", "nohighlights": "Nichts wurde hervorgehoben. Markiere Text im Transkript und wähle Hervorheben.", "aisummary": "Von einem Sprachmodell auf diesem Computer geschrieben. Bitte vor dem Weitergeben prüfen.", "aihighlight": "vom Sprachmodell vorgeschlagen", "speaker": "Sprecher", "speakers": "Sprecher", "participants": "Teilnehmende: ", "footer": "Erstellt mit Cassette  ·  Seite ",
           "cueUnsure": "Wortlaut unsicher: {words}", "cueSpeaker": "Sprecher unbestätigt", "cueChecked": "von einer Person geprüft",
           "noteGap": "Lücke von {length}: Zwischen diesen beiden Aufnahmen wurde nichts aufgenommen.", "noteUnknown": "Mögliche Lücke: Zwischen diesen beiden Aufnahmen fehlt möglicherweise etwas, und niemand weiß, wie viel.", "noteOverlap": "Die Aufnahmen überlappen sich um {length}: Einige Wörter können doppelt vorkommen.", "noteTrial": "Nicht transkribiert: alles nach {at}. Es wurde nur eine Probe transkribiert.",
           "attendees": "Teilnehmende", "decisions": "Beschlüsse und Aufgaben", "nomarks": "Es wurden keine Zeilen markiert. Markiere eine Zeile im Transkript, damit sie hier erscheint.",
           "record": "Protokoll", "minutes": "Besprechungsprotokoll", "edited1": "{n} geänderte Zeile von {m}", "editedN": "{n} geänderte Zeilen von {m}",
           "original": "Original:  ", "edited": "Geändert: ",
           "cleannote": "Bearbeitete Fassung: Füllwörter wie „äh“ und „ähm“ wurden entfernt. Das ist kein wörtliches Protokoll.", "pausenote": "Pausen sind markiert: (.) etwa eine halbe Sekunde, (..) etwa eine Sekunde, (...) zwei Sekunden oder mehr.", "overlap": "überlappend",
           "months": ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]},
    "fr": {"sharesHead": "Répartition des langues :", "time": "Temps", "speakerCol": "Locuteur", "translation": "Traduction", "summary": "Résumé", "topics": "Sujets", "actions": "Actions à mener", "owner": "Responsable", "task": "Action", "due": "Échéance", "keyquotes": "Citations clés", "highlights": "Moments forts", "nohighlights": "Rien n’a été mis en avant. Sélectionnez du texte dans la transcription et choisissez Mettre en avant.", "aisummary": "Rédigé par un modèle de langage sur cet ordinateur. Vérifiez-le avant de le partager.", "aihighlight": "proposé par le modèle de langage", "speaker": "locuteur", "speakers": "locuteurs", "participants": "Participants : ", "footer": "Créé avec Cassette  ·  page ",
           "cueUnsure": "formulation incertaine : {words}", "cueSpeaker": "locuteur non confirmé", "cueChecked": "vérifié par une personne",
           "noteGap": "Trou de {length} : rien n’a été enregistré entre ces deux enregistrements.", "noteUnknown": "Trou possible : il manque peut-être quelque chose entre ces deux enregistrements, et personne ne sait combien.", "noteOverlap": "Les enregistrements se chevauchent sur {length} : certains mots peuvent apparaître deux fois.", "noteTrial": "Non transcrit : tout ce qui suit {at}. Seul un échantillon a été transcrit.",
           "attendees": "Participants", "decisions": "Décisions et actions", "nomarks": "Aucune ligne n’a été marquée. Marquez une ligne dans la transcription pour qu’elle apparaisse ici.",
           "record": "Compte rendu", "minutes": "Compte rendu de réunion", "edited1": "{n} ligne modifiée sur {m}", "editedN": "{n} lignes modifiées sur {m}",
           "original": "original : ", "edited": "modifié :  ",
           "cleannote": "Version nettoyée : les hésitations comme « euh » ont été supprimées. Ce n’est pas une transcription littérale.", "pausenote": "Les pauses sont indiquées : (.) environ une demi-seconde, (..) environ une seconde, (...) deux secondes ou plus.", "overlap": "chevauchement",
           "months": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]},
    "es": {"sharesHead": "Reparto de idiomas:", "time": "Tiempo", "speakerCol": "Hablante", "translation": "Traducción", "summary": "Resumen", "topics": "Temas", "actions": "Tareas", "owner": "Responsable", "task": "Tarea", "due": "Fecha límite", "keyquotes": "Citas clave", "highlights": "Destacados", "nohighlights": "No se destacó nada. Selecciona texto en la transcripción y elige Destacar.", "aisummary": "Escrito por un modelo de lenguaje en este ordenador. Revísalo antes de compartirlo.", "aihighlight": "sugerido por el modelo de lenguaje", "speaker": "hablante", "speakers": "hablantes", "participants": "Participantes: ", "footer": "Creado con Cassette  ·  página ",
           "cueUnsure": "redacción dudosa: {words}", "cueSpeaker": "hablante sin confirmar", "cueChecked": "comprobado por una persona",
           "noteGap": "Hueco de {length}: no se grabó nada entre estas dos grabaciones.", "noteUnknown": "Posible hueco: puede faltar algo entre estas dos grabaciones, y nadie sabe cuánto.", "noteOverlap": "Las grabaciones se solapan {length}: algunas palabras pueden aparecer dos veces.", "noteTrial": "Sin transcribir: todo lo que sigue a {at}. Solo se transcribió una muestra.",
           "attendees": "Asistentes", "decisions": "Decisiones y tareas", "nomarks": "No se marcó ninguna línea. Marca una línea en la transcripción para que aparezca aquí.",
           "record": "Acta", "minutes": "Acta de la reunión", "edited1": "{n} línea editada de {m}", "editedN": "{n} líneas editadas de {m}",
           "original": "original: ", "edited": "editado:  ",
           "cleannote": "Copia editada: se quitaron las muletillas como «eh». No es una transcripción literal.", "pausenote": "Las pausas se marcan: (.) medio segundo aproximado, (..) un segundo aproximado, (...) dos segundos o más.", "overlap": "solapado",
           "months": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]},
}


def _tr(lang: str | None) -> dict:
    return _L.get((lang or "en")[:2], _L["en"])


def _long_date(d, lang: str | None) -> str:
    L = _tr(lang)
    m = L["months"][d.month - 1]
    code = (lang or "en")[:2]
    if code == "de":
        return f"{d.day}. {m} {d.year}"
    if code == "fr":
        return f"{d.day} {m} {d.year}"
    if code == "es":
        return f"{d.day} de {m} de {d.year}"
    return f"{d.day:02d} {m} {d.year}"


# ---- Transcript style (applied when exporting; the stored transcript is never changed) -------------------------
_FILLERS = {
    "de": ["äh", "ähm", "öh", "öhm", "hm", "hmm"],
    "en": ["uh", "um", "uhm", "er", "erm", "hm", "hmm"],
    "fr": ["euh", "heu", "hum", "hmm"],
    "es": ["eh", "em", "mmm", "hmm"],
}


def _with_pauses(seg: dict) -> str:
    """Text rebuilt from the word timings with (.) (..) (...) where the speaker paused. Edited lines keep their text."""
    words = seg.get("words") or []
    if len(words) < 2 or seg.get("orig") or seg.get("edited"):
        return seg["text"]
    out = [words[0]["word"]]
    for prev, w in zip(words, words[1:]):
        gap = w["start"] - prev["end"]
        mark = "(...)" if gap >= 2.0 else "(..)" if gap >= 1.0 else "(.)" if gap >= 0.5 else ""
        out.append((" " + mark if mark else "") + w["word"])
    return "".join(out).strip()


def _drop_fillers(text: str, language: str | None) -> str:
    import re

    words = _FILLERS.get((language or "")[:2])
    if not words:
        return text
    pat = re.compile(r"(?<![\w'’-])(?:" + "|".join(map(re.escape, words)) + r")(?![\w'’-])[,.…]*\s*", re.IGNORECASE)
    starts = bool(pat.match(text.lstrip()))
    out = pat.sub("", text)
    out = re.sub(r"\s+([,.!?;:])", r"\1", re.sub(r"\s{2,}", " ", out)).strip()
    if starts and out:
        out = out[0].upper() + out[1:]
    return out


def apply_style(segs, options: dict | None = None, language: str | None = None):
    """Verbatim (default) leaves the text alone; `style: clean` drops hesitations; `pauseMarks` adds (.) (..) (...)."""
    o = options or {}
    clean, pauses = o.get("style") == "clean", bool(o.get("pauseMarks"))
    if not clean and not pauses:
        return segs
    out = []
    for s in segs:
        text = _with_pauses(s) if pauses else s["text"]
        if clean:
            text = _drop_fillers(text, language)
        if clean and not text:
            continue
        out.append({**s, "text": text})
    return out


def style_note(options: dict | None, lang: str | None) -> str:
    o = options or {}
    L = _tr(lang)
    return " ".join(x for x in (L["cleannote"] if o.get("style") == "clean" else "", L["pausenote"] if o.get("pauseMarks") else "") if x)


def _flag(seg: dict, lang: str | None, options: dict | None = None) -> str:
    """` [fr, overlap]`: the line's own language (only when it differs from the recording's) and overlapping speech."""
    parts = []
    own = seg.get("lang")
    if own and own != (options or {}).get("fileLanguage"):
        parts.append(own)
    if seg.get("overlap"):
        parts.append(_tr(lang)["overlap"])
    parts += cue_labels(seg, lang, options)
    return f" [{', '.join(parts)}]" if parts else ""


def cue_labels(seg: dict, lang: str | None, options: dict | None = None) -> list[str]:
    """What a reader without the audio needs to know about one line, one label per cue, each its own words:
    `checked by a person` (the user listened to the line and vouches for it), else `wording unsure: ...` (words the model doubted and nobody confirmed)
    and `speaker unconfirmed` (a speaker brought in by an added recording that nobody matched or named). Overlapping speech is a cue of its own (see `_flag`)
    and never says anything about the speaker. Only when `options.cues` is on, and a line with nothing to say gets nothing."""
    o = options or {}
    if not o.get("cues"):
        return []
    L = _tr(lang)
    if seg.get("heard"):
        return [L["cueChecked"]]
    out = []
    words = [w for w in (seg.get("unsure") or []) if w]
    if words:
        out.append(L["cueUnsure"].format(words=", ".join(words)))
    if seg.get("speaker") in (o.get("unconfirmedSpeakers") or []):
        out.append(L["cueSpeaker"])
    return out


def _length(sec: float) -> str:
    sec = max(0.0, float(sec))
    if sec < 60:
        return f"{round(sec * 10) / 10:g} s"
    return f"{int(sec // 60)} min {round(sec % 60)} s"


def boundary_notes(segs, lang: str | None, options: dict | None = None) -> tuple[dict[int, list[tuple[float, str]]], list[tuple[float, str]]]:
    """Notes about the recording itself, placed where the reader meets them: a gap, an unknown gap or an overlap between two recordings,
    and the stretch nobody transcribed. Each goes before the first line that starts at or after its moment; those with no line after them
    come last. Returns (index of line -> [(moment, note)], the same for the end). Nothing is said unless `options.cues` is on and the project has such a thing."""
    o = options or {}
    if not o.get("cues"):
        return {}, []
    L = _tr(lang)
    items: list[tuple[float, str]] = []
    for b in o.get("boundaries") or []:
        kind, sec = b.get("kind"), b.get("seconds") or 0
        if kind == "gap" and sec > 0:
            items.append((b["at"], L["noteGap"].format(length=_length(sec))))
        elif kind == "overlap" and sec > 0:
            items.append((b["at"], L["noteOverlap"].format(length=_length(sec))))
        elif kind == "unknown":
            items.append((b["at"], L["noteUnknown"]))
    for r in o.get("untranscribed") or []:
        items.append((r["start"], L["noteTrial"].format(at=_clock(r["start"]))))
    before: dict[int, list[tuple[float, str]]] = {}
    tail: list[tuple[float, str]] = []
    for at, text in sorted(items, key=lambda x: x[0]):
        idx = next((i for i, s in enumerate(segs) if s["start"] >= at), None)
        if idx is None:
            tail.append((at, text))
        else:
            before.setdefault(idx, []).append((at, text))
    return before, tail


def _trans_txt(seg: dict, options: dict | None) -> str:
    """English translation, on its own line under the text (left out when the user turned translations off)."""
    return f"\n    → {seg['translation']}" if seg.get("translation") and (options or {}).get("translations", True) else ""


def _note_line(note: tuple[float, str], stamp: bool) -> str:
    return (f"[{_ts(note[0])[:8]}] " if stamp else "") + f"[{note[1]}]"


def to_txt(segs, names=None, options=None):
    names = names or {}
    o = options or {}
    stamp = o.get("timestamps", True)
    note = style_note(o, o.get("lang"))
    before, tail = boundary_notes(segs, o.get("lang"), o)
    lines = []
    for i, s in enumerate(segs):
        lines += [_note_line(n, stamp) for n in before.get(i, [])]
        lines.append((f"[{_ts(s['start'])[:8]}] " if stamp else "") + f"{_name(s, names)}{_flag(s, o.get('lang'), o)}: {s['text']}" + _trans_txt(s, o))
    lines += [_note_line(n, stamp) for n in tail]
    body = "\n".join(lines) + "\n"
    return (note + "\n\n" if note else "") + body + (f"\n{o['stampText']}\n" if o.get("stampText") else "")


def _opt(options: dict | None, key: str, default):
    v = (options or {}).get(key)
    return default if v is None else v


def _wrap(tokens: list[str], max_chars: int, max_lines: int, first_prefix: int = 0) -> list[str] | None:
    """Break words into at most max_lines lines of at most max_chars; None if they do not fit.
    Two lines are balanced so the second is not a stub. A single word longer than max_chars stays whole."""
    def width(ws: list[str], pre: int) -> int:
        return pre + len(" ".join(ws))

    if width(tokens, first_prefix) <= max_chars or max_lines <= 1:
        return [" ".join(tokens)] if width(tokens, first_prefix) <= max_chars or len(tokens) == 1 else None
    best = None
    for k in range(1, len(tokens)):
        w1, w2 = width(tokens[:k], first_prefix), width(tokens[k:], 0)
        if w1 > max_chars and k > 1:
            break
        if w2 > max_chars and k < len(tokens) - 1 and w1 <= max_chars:
            continue
        if max(w1, w2) <= max_chars and (best is None or max(w1, w2) < best[0]):
            best = (max(w1, w2), k)
    if best is None:
        return None
    return [" ".join(tokens[: best[1]]), " ".join(tokens[best[1]:])]


def _cues(segs, names, options, inline_speaker: bool):
    """Subtitle cues as (start, end, lines). Built from words when present, else one cue per segment."""
    max_chars = max(10, int(_opt(options, "maxChars", 42)))
    max_lines = max(1, int(_opt(options, "maxLines", 2)))
    show = bool(_opt(options, "speakerNames", True))
    offset = float(_opt(options, "offsetSeconds", 0))
    max_dur = max(0.5, float(_opt(options, "maxDuration", 7.0)))
    min_dur = min(max(0.0, float(_opt(options, "minDuration", 1.0))), max_dur)
    gap = max(0.0, float(_opt(options, "minGap", 0.083)))
    raw: list[tuple[float, float, list[str], str | None]] = []  # start, end, lines, speaker label for first cue
    for seg in segs:
        label = _name(seg, names) if show else None
        words = [w for w in (seg.get("words") or []) if str(w.get("word", "")).strip()]
        if not words:
            # No word timings: a cue longer than max_dur is cut into equal parts at word boundaries.
            toks = seg["text"].split()
            parts = max(1, min(len(toks), -(-int(max(0.0, seg["end"] - seg["start"]) * 1000) // int(max_dur * 1000))))
            if parts == 1:
                raw.append((seg["start"], seg["end"], seg["text"].split("\n"), label))
                continue
            step, size = (seg["end"] - seg["start"]) / parts, -(-len(toks) // parts)
            for k in range(parts):
                chunk = toks[k * size:(k + 1) * size]
                if chunk:
                    raw.append((seg["start"] + k * step, seg["start"] + (k + 1) * step, [" ".join(chunk)], label if k == 0 else None))
            continue
        i, first = 0, True
        while i < len(words):
            pre = len(label) + 2 if (first and label and inline_speaker) else 0
            j, lines = i + 1, None
            lines = _wrap([words[i]["word"].strip()], max_chars, max_lines, pre)
            while j < len(words) and words[j]["end"] - words[i]["start"] <= max_dur:
                trial = _wrap([w["word"].strip() for w in words[i:j + 1]], max_chars, max_lines, pre)
                if trial is None:
                    break
                lines, j = trial, j + 1
            chunk = words[i:j]
            raw.append((chunk[0]["start"], chunk[-1]["end"], lines or [chunk[0]["word"].strip()], label if first else None))
            first, i = False, j
    out = []
    for n, (st, en, lines, who) in enumerate(raw):
        nxt = raw[n + 1][0] if n + 1 < len(raw) else None
        if nxt is not None and nxt - gap > st:
            en = min(en, nxt - gap)  # keep a gap before the next cue (and never overlap it)
        if en - st < min_dur:
            en = st + min_dur if nxt is None else max(en, min(st + min_dur, nxt - gap if nxt - gap > st else nxt))
        en = min(en, st + max_dur)
        st, en = st + offset, en + offset
        if en <= 0:
            continue
        st = max(0.0, st)
        if who and inline_speaker:
            lines = [f"{who}: {lines[0]}"] + lines[1:]
        out.append((st, max(en, st + 0.001), lines, who))
    return out


def to_srt(segs, names=None, options=None):
    names = names or {}
    return "\n".join(
        f"{i}\n{_ts(st)} --> {_ts(en)}\n" + "\n".join(lines) + "\n"
        for i, (st, en, lines, _) in enumerate(_cues(segs, names, options, True), 1)
    )


def _vtt_text(s: str) -> str:
    """WebVTT cue text: & < > are markup, so spoken text such as "R&D" or "a < b" must be escaped or players show a broken cue."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def to_vtt(segs, names=None, options=None):
    names = names or {}
    body = "\n".join(
        f"{_ts(st, '.')} --> {_ts(en, '.')}\n" + (f"<v {_vtt_text(who)}>" if who else "") + "\n".join(_vtt_text(l) for l in lines) + "\n"
        for st, en, lines, who in _cues(segs, names, options, False)
    )
    return "WEBVTT\n\n" + body


def _clock(sec: float) -> str:
    t = int(sec)
    h, m, s = t // 3600, t % 3600 // 60, t % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def to_chapters(segs, names=None, options=None):
    """YouTube/podcast chapter list, one 'm:ss Title' per line. YouTube needs the first chapter at 0:00."""
    chaps = [(max(0.0, s["start"]), str(s["chapter"]).strip()) for s in segs if str(s.get("chapter") or "").strip()]
    if not chaps:
        return ""
    if int(chaps[0][0]) != 0:
        chaps.insert(0, (0.0, "Intro"))
    return "\n".join(f"{_clock(t)} {title}" for t, title in chaps) + "\n"


def _rate(fps) -> tuple[int, float, bool]:
    """(timebase, real frames per second, fractional?) for a frame rate: 29.97 counts 30 frames a "second" but runs at 30000/1001."""
    fps = float(fps) or 25.0
    base = max(1, round(fps))
    frac = abs(fps - base) > 0.001 and base in (24, 30, 60)
    return base, (base * 1000 / 1001 if frac else float(base)), frac


def _drop_per_minute(base: int) -> int:
    """Frame numbers skipped at the start of every minute but each tenth in drop-frame timecode (2 for 29.97, 4 for 59.94)."""
    return 2 if base == 30 else 4


def _timecode(sec: float, fps, start_frames: int, drop: bool = False) -> str:
    base, real, _ = _rate(fps)
    n = round(max(0.0, sec) * real) + start_frames
    if drop:
        d = _drop_per_minute(base)
        tens, rest = divmod(n, base * 600 - 9 * d)
        n += 9 * d * tens + (d * ((rest - d) // (base * 60 - d)) if rest > d else 0)
    f = n % base
    t = n // base
    return f"{t // 3600:02d}:{t % 3600 // 60:02d}:{t % 60:02d}{';' if drop else ':'}{f:02d}"


def _tc_frames(tc: str, fps, drop: bool = False) -> int:
    base, _, _ = _rate(fps)
    try:
        h, m, s, f = (int(x) for x in tc.replace(";", ":").split(":"))
    except ValueError:
        h, m, s, f = 1, 0, 0, 0
    n = ((h * 60 + m) * 60 + s) * base + f
    if drop:
        minutes = h * 60 + m
        n -= _drop_per_minute(base) * (minutes - minutes // 10)
    return n


def to_edl(segs, names=None, options=None, title="Transcript"):
    """DaVinci Resolve marker EDL (CMX3600 events with Resolve marker comments). Handles 23.976/29.97/59.94 and drop-frame."""
    names = names or {}
    fps = float(_opt(options, "fps", 25)) or 25.0
    drop = bool(_opt(options, "dropFrame", False)) and _rate(fps)[2] and _rate(fps)[0] in (30, 60)
    start = _tc_frames(str(_opt(options, "startTimecode", "01:00:00:00")), fps, drop)
    offset = float(_opt(options, "offsetSeconds", 0))
    real = _rate(fps)[1]
    marks: list[tuple[float, str]] = [(s["start"], str(s["chapter"]).strip()) for s in segs if str(s.get("chapter") or "").strip()]
    if not marks:
        prev = None
        for s in segs:
            if s["speaker"] != prev:
                who = _name(s, names)
                marks.append((s["start"], f"{who}: {' '.join(s['text'].split()[:6])}"))
            prev = s["speaker"]
    clean = lambda t: " ".join(t.replace("|", "/").split())[:80]
    lines = [f"TITLE: {clean(title)}", "FCM: DROP FRAME" if drop else "FCM: NON-DROP FRAME", ""]
    for n, (t, name) in enumerate(marks, 1):
        a = _timecode(t + offset, fps, start, drop)
        b = _timecode(t + offset + 1 / real, fps, start, drop)
        lines.append(f"{n:03d}  001      V     C        {a} {b} {a} {b}")
        lines.append(f" |C:ResolveColorBlue |M:{clean(name)} |D:1")
        lines.append("")
    return "\n".join(lines)


def _md_highlights(segs, names, highlights, stamp: bool) -> str:
    """A "Highlights" section of block quotes for the copied Markdown. Empty unless highlights are passed, so the .md file export is unchanged."""
    if highlights is None:
        return ""
    quotes = quote_list(segs, highlights)
    if not quotes:
        return ""
    return "\n## Highlights\n\n" + "\n\n".join(f"> {q['text']}\n>\n> — {names.get(q['speaker'], q['speaker'])}" + (f", {_clock(q['start'])}" if stamp else "") for q in quotes) + "\n"


def to_md(segs, names=None, options=None):
    names = names or {}
    o = options or {}
    stamp = o.get("timestamps", True)
    note = style_note(o, o.get("lang"))
    body = "\n\n".join(f"**{_name(s, names)}**{_flag(s, o.get('lang'), o)}" + (f" _{_ts(s['start'])[:8]}_" if stamp else "") + f"\n{s['text']}" + (f"\n\n> {s['translation']}" if s.get("translation") and o.get("translations", True) else "") for s in segs) + "\n"
    return (f"_{note}_\n\n" if note else "") + body + _md_highlights(segs, names, o.get("highlights"), stamp) + (f"\n_{o['stampText']}_\n" if o.get("stampText") else "")


JSON_SCHEMA = 1  # bump when a key is renamed or removed; adding keys does not change it


def provenance(data: dict) -> dict:
    """What a JSON export says about how it was made, so it can be cited and compared: the format version, the app and engine versions,
    the language and the run's model and devices. No date and no file paths, so the same transcript always exports to the same bytes."""
    try:
        from importlib.metadata import version

        engine = version("engine")
    except Exception:
        engine = None
    run = data.get("meta") or {}
    keep = ("model", "device", "speakerDevice", "languageProb", "languages", "mixed", "translated", "secondsSpeakers", "secondsTranscribe")
    segs = data.get("segments") or []
    return {
        "schema": JSON_SCHEMA, "app": data.get("app"), "engine": engine, "language": data.get("language"),
        "lines": len(segs), "edited_lines": sum(1 for s in segs if s.get("edited")),
        **{k: run[k] for k in keep if k in run},
    }


def stamp_text(data: dict) -> str:
    """One line saying which versions and settings made an export, built from the same fields as the JSON's `meta` (schema, app, engine, language,
    model) so the two always agree. Fixed English wording, like the JSON keys. No date, no path, no name: the same transcript gives the same line."""
    m = provenance(data)
    parts = [("export format", m["schema"]), ("engine", m["engine"]), ("language", m["language"]), ("model", m.get("model"))]
    inner = ", ".join(f"{k} {v}" for k, v in parts if v)
    return "Cassette" + (f" {m['app']}" if m.get("app") else "") + (f" ({inner})" if inner else "")


def to_json(segs, names=None, meta=None):
    names = names or {}
    return json.dumps(
        {"meta": meta or {}, "speakers": names,
         "segments": [{**s, "speaker_name": _name(s, names)} for s in segs]},
        ensure_ascii=False, indent=2,
    )


_FORMULA = ("=", "+", "-", "@", "\t", "\r")


def _xl(v) -> str:
    """Excel runs a cell that starts with = + - @ as a formula: a leading ' makes it plain text."""
    s = str(v)
    return "'" + s if s[:1] in _FORMULA else s


def to_csv(segs, names=None, options=None):
    """Spreadsheet-friendly: seconds for sorting, h:mm:ss for reading. CRLF per RFC 4180.
    With the "excel" option: a UTF-8 BOM (so Excel on Windows reads ä/é/ñ) and no cell that Excel would run as a formula."""
    excel = bool(_opt(options, "excel", False))
    cell = _xl if excel else str
    names = names or {}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["start_seconds", "end_seconds", "start", "end", "speaker", "text", "overlap", "language", "translation"])
    for s in segs:
        w.writerow([f"{s['start']:.2f}", f"{s['end']:.2f}", _ts(s["start"])[:8], _ts(s["end"])[:8], cell(_name(s, names)), cell(s["text"]), "yes" if s.get("overlap") else "", s.get("lang", ""), cell(s.get("translation", ""))])
    if (options or {}).get("stampText"):  # a last row, nothing before it moves: only the text column is filled, and a "#" marks it as a note
        w.writerow(["", "", "", "", "#", cell(options["stampText"]), "", "", ""])
    return ("\ufeff" if excel else "") + buf.getvalue()


def language_shares(segs, file_language: str | None = None) -> list[dict]:
    """Seconds and percent of speech per language, from the tags the lines already carry (a line without its own tag has the recording's language).
    Nothing is detected here. Most spoken language first; percents are whole numbers that add up to 100."""
    secs: dict[str, float] = {}
    for s in segs:
        code = s.get("lang") or file_language
        if code:
            secs[code] = secs.get(code, 0.0) + max(0.0, s["end"] - s["start"])
    total = sum(secs.values())
    if total <= 0:
        return []
    rows = sorted(secs.items(), key=lambda kv: (-kv[1], kv[0]))
    pct = [int(v / total * 100) for _, v in rows]
    for i in sorted(range(len(rows)), key=lambda i: -(rows[i][1] / total * 100 - pct[i]))[: 100 - sum(pct)]:  # largest remainders get the missing points
        pct[i] += 1
    return [{"lang": c, "seconds": v, "percent": p} for (c, v), p in zip(rows, pct)]


def shares_text(shares: list[dict]) -> str:
    """`DE 12:30 (63%), EN 7:30 (37%)`"""
    return ", ".join(f"{x['lang'].upper()} {_clock(x['seconds'])} ({x['percent']}%)" for x in shares)


def to_language_shares(segs, names=None, options=None):
    """A small text file: one line per language with its minutes and percent of the speech. Holds no speaker names and no transcript text."""
    shares = language_shares(segs, (options or {}).get("fileLanguage"))
    head = _tr((options or {}).get("lang"))["sharesHead"]
    return head + "\n" + "\n".join(f"{x['lang'].upper()}\t{_clock(x['seconds'])}\t{x['percent']}%" for x in shares) + "\n"


# Speaker colours, in the same order as the app (bright for rules and bars, darker for text so it stays readable).
_BRIGHT = ["ff5f8a", "ff9a52", "a87bff", "4fb3ff", "2fc9a0", "f2b134", "e46bd6", "8a8fb0"]
_DARK = ["c2285c", "b85a14", "6a45e8", "1d6fb5", "12806a", "9a6b00", "a3329a", "5b6078"]
_INK, _MUTED, _SERIF, _SANS = "2a2040", "6b6085", "Georgia", "Helvetica Neue"


def _font(run, name, size=None, bold=None, color=None, italic=None):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor

    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.append(fonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        fonts.set(qn(attr), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic
    if color:
        run.font.color.rgb = RGBColor.from_string(color.upper())


def _border(paragraph, side, color, size=18, space=8):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    ppr = paragraph._p.get_or_add_pPr()
    borders = ppr.find(qn("w:pBdr"))
    if borders is None:
        borders = OxmlElement("w:pBdr")
        ppr.append(borders)
    el = OxmlElement(f"w:{side}")
    for k, v in (("val", "single"), ("sz", str(size)), ("space", str(space)), ("color", color)):
        el.set(qn(f"w:{k}"), v)
    borders.append(el)


def _shade(paragraph, fill):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    ppr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    for k, v in (("val", "clear"), ("color", "auto"), ("fill", fill)):
        shd.set(qn(f"w:{k}"), v)
    ppr.append(shd)


def _a11y(doc, title: str | None, lang: str | None) -> None:
    """What assistive technology reads first: the document title (Word's File > Info, and what a screen reader says on opening) and the
    document language (so a screen reader picks the right voice and Word does not spell-check in the wrong language)."""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    if title:
        doc.core_properties.title = title
    code = (lang or "en").strip()[:2].lower() or "en"
    doc.core_properties.language = code
    rpr = doc.styles.element.find(qn("w:docDefaults")).find(qn("w:rPrDefault")).find(qn("w:rPr"))
    el = rpr.find(qn("w:lang"))
    if el is None:
        el = OxmlElement("w:lang")
        rpr.append(el)
    el.set(qn("w:val"), code)


def _page_number_footer(section, lang=None, stamp=None):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if stamp:
        _font(p.add_run(stamp), _SANS, 8, color=_MUTED)
        p = section.footer.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(_tr(lang)["footer"])
    _font(r, _SANS, 8.5, color=_MUTED)
    r2 = p.add_run()
    _font(r2, _SANS, 8.5, color=_MUTED)
    for kind, text in (("begin", None), (None, " PAGE "), ("end", None)):
        if kind:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), kind)
        else:
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = text
        r2._r.append(el)


def to_docx(segs, names=None, title="Transcript", lang=None, options=None) -> bytes:
    """A designed Word page: title block, who-talked bars, a coloured rule per speaker, chapter bands, page footer."""
    from datetime import date

    from docx import Document
    from docx.shared import Cm, Pt

    names = names or {}
    # speaker order (and so colour) follows the app: the order of the names given, then order of appearance
    order = list(names.keys())
    for sg in segs:
        if sg["speaker"] not in order:
            order.append(sg["speaker"])
    idx = {sp: i % len(_BRIGHT) for i, sp in enumerate(order)}
    talk = {}
    for sg in segs:
        talk[sg["speaker"]] = talk.get(sg["speaker"], 0.0) + max(0.0, sg["end"] - sg["start"])
    total = sum(talk.values()) or 1.0
    present = [sp for sp in order if sp in talk]

    doc = Document()
    _a11y(doc, title, lang)
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = Cm(2.4)
    sec.top_margin, sec.bottom_margin = Cm(2.2), Cm(2.0)
    normal = doc.styles["Normal"]
    normal.font.name = _SERIF
    normal.font.size = Pt(11.5)
    _page_number_footer(sec, lang, (options or {}).get("stampText"))

    # title block (the Title style, so it is announced as the title and appears in the navigation pane)
    p = doc.add_paragraph(style="Title")
    p.paragraph_format.space_after = Pt(2)
    _font(p.add_run(title), _SERIF, 28, True, _INK)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(14)
    _border(p, "bottom", _BRIGHT[0], 18, 10)
    _font(p.add_run(_long_date(date.today(), lang)), _SANS, 10, color=_MUTED)
    _font(p.add_run(f"   ·   {len(present)} {_tr(lang)['speaker' if len(present) == 1 else 'speakers']}"), _SANS, 10, color=_MUTED)

    # who talked: a coloured block bar per speaker
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    _font(p.add_run(_tr(lang)["participants"] + ", ".join(_name({"speaker": sp}, names) for sp in present)), _SANS, 9, color=_MUTED)
    for sp in present:
        share = talk[sp] / total
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(1)
        p.paragraph_format.left_indent = Cm(0.1)
        _font(p.add_run("● "), _SANS, 10, color=_BRIGHT[idx[sp]])
        _font(p.add_run(_name({"speaker": sp}, names).ljust(1)), _SANS, 10.5, True, _DARK[idx[sp]])
        _font(p.add_run("   " + "█" * max(1, round(share * 24))), _SANS, 9, color=_BRIGHT[idx[sp]])
        _font(p.add_run(f"  {round(share * 100)}%"), _SANS, 9.5, color=_MUTED)
    note = style_note(options, lang)
    if note:
        p = doc.add_paragraph()
        _font(p.add_run(note), _SANS, 8.5, color=_MUTED, italic=True)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)
    stamp = (options or {}).get("timestamps", True)

    # the conversation
    before, tail = boundary_notes(segs, lang, options)

    def note(n):  # a shaded line of plain words (a gap, an overlap, the untranscribed rest), never colour alone
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(4)
        _shade(p, "FFF4D6")
        _font(p.add_run((f"{_ts(n[0])[:8]}   " if stamp else "") + n[1]), _SANS, 9.5, True, _INK, italic=True)

    for si, sg in enumerate(segs):
        sp = sg["speaker"]
        for n in before.get(si, []):
            note(n)
        if sg.get("chapter"):
            c = doc.add_paragraph(style="Heading 2")  # chapters are real headings: a screen reader can jump between them
            c.paragraph_format.space_before = Pt(16)
            c.paragraph_format.space_after = Pt(6)
            c.paragraph_format.keep_with_next = True
            _shade(c, "F1ECFB")
            _font(c.add_run(f"  {_ts(sg['start'])[:8]}   " if stamp else "  "), _SANS, 9, color=_MUTED)
            _font(c.add_run(sg["chapter"]), _SANS, 13, True, _INK)
        head = doc.add_paragraph()
        head.paragraph_format.space_before = Pt(9)
        head.paragraph_format.space_after = Pt(1)
        head.paragraph_format.left_indent = Cm(0.45)
        head.paragraph_format.keep_with_next = True
        _border(head, "left", _BRIGHT[idx[sp]], 24, 8)
        _font(head.add_run(_name(sg, names)), _SANS, 11, True, _DARK[idx[sp]])
        _font(head.add_run((f"   {_ts(sg['start'])[:8]}" if stamp else "") + _flag(sg, lang, options)), _SANS, 8.5, color=_MUTED)
        body = doc.add_paragraph()
        body.paragraph_format.left_indent = Cm(0.45)
        body.paragraph_format.space_after = Pt(4)
        body.paragraph_format.line_spacing = 1.35
        _border(body, "left", _BRIGHT[idx[sp]], 24, 8)
        _font(body.add_run(sg["text"]), _SERIF, 11.5, color=_INK)
        if sg.get("translation") and (options or {}).get("translations", True):
            tr = doc.add_paragraph()
            tr.paragraph_format.left_indent = Cm(0.45)
            tr.paragraph_format.space_after = Pt(2)
            _font(tr.add_run("→ " + sg["translation"]), _SERIF, 10.5, color=_MUTED, italic=True)
    for n in tail:
        note(n)

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def to_bilingual_docx(segs, names=None, title="Transcript", lang=None, options=None) -> bytes:
    """The original and its translation side by side: a table with time, speaker, original and translation, and a line with the language shares.
    A line with no translation leaves that cell empty. Speaker names are the real ones, so this format is not offered for the anonymised export."""
    from docx import Document
    from docx.shared import Cm

    names = names or {}
    L = _tr(lang)
    o = options or {}
    stamp = o.get("timestamps", True)
    doc = Document()
    _a11y(doc, title, lang)
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = Cm(1.8)
    _page_number_footer(sec, lang, o.get("stampText"))
    p = doc.add_paragraph(style="Title")
    _font(p.add_run(title), _SERIF, 22, True, _INK)
    shares = language_shares(segs, o.get("fileLanguage"))
    if shares:
        p = doc.add_paragraph()
        _font(p.add_run(L["sharesHead"] + " " + shares_text(shares)), _SANS, 9.5, color=_MUTED)
    note = style_note(o, lang)
    if note:
        _font(doc.add_paragraph().add_run(note), _SANS, 8.5, color=_MUTED, italic=True)
    cols = ([L["time"]] if stamp else []) + [L["speakerCol"], L["original"].strip(" :").capitalize(), L["translation"]]
    table = doc.add_table(rows=1, cols=len(cols))
    table.style = "Table Grid"
    for i, c in enumerate(cols):
        _font(table.rows[0].cells[i].paragraphs[0].add_run(c), _SANS, 9.5, True, _INK)
    from docx.oxml import OxmlElement
    table.rows[0]._tr.get_or_add_trPr().append(OxmlElement("w:tblHeader"))  # screen readers read the column name with each cell
    for sg in segs:
        cells = table.add_row().cells
        vals = ([_ts(sg["start"])[:8]] if stamp else []) + [_name(sg, names) + _flag(sg, lang, o), sg["text"], sg.get("translation") or ""]
        for i, v in enumerate(vals):
            _font(cells[i].paragraphs[0].add_run(v), _SANS if i < len(vals) - 2 else _SERIF, 9 if i < len(vals) - 2 else 10.5, color=_MUTED if i < len(vals) - 2 else _INK, italic=(i == len(vals) - 1))
    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def to_bilingual_srt(segs, names=None, options=None):
    """Subtitles with both lines: each cue shows the original, and the translation (when the line has one) under it."""
    names = names or {}
    max_chars = max(10, int(_opt(options, "maxChars", 42)))
    max_lines = max(1, int(_opt(options, "maxLines", 2)))
    gap = max(0.0, float(_opt(options, "minGap", 0.083)))
    cues = []
    for seg in segs:
        mine = _cues([seg], names, options, True)
        tr = (seg.get("translation") or "").strip()
        if tr and mine:
            extra = _wrap(tr.split(), max_chars, max_lines) or [tr]
            st, en, lines, who = mine[-1]
            mine[-1] = (st, en, lines + extra, who)
        cues.extend(mine)
    cues.sort(key=lambda c: c[0])
    fixed = []
    for n, (st, en, lines, who) in enumerate(cues):
        if n + 1 < len(cues) and cues[n + 1][0] - gap > st:
            en = min(en, cues[n + 1][0] - gap)
        fixed.append((st, max(en, st + 0.001), lines))
    return "\n".join(f"{i}\n{_ts(st)} --> {_ts(en)}\n" + "\n".join(lines) + "\n" for i, (st, en, lines) in enumerate(fixed, 1))


# ---- Extra formats -------------------------------------------------------------------------------------------

def _redaction_map(segs, names) -> dict[str, str]:
    """Speaker id -> P01, P02… in order of first appearance."""
    order: list[str] = []
    for s in segs:
        if s["speaker"] not in order:
            order.append(s["speaker"])
    return {sp: f"P{i + 1:02d}" for i, sp in enumerate(order)}


def _name_pattern(names: dict[str, str]):
    """One pattern for every typed name and each part of it (first and last name), on word boundaries.
    Returns (pattern, owner) where owner maps a lower-case match to the typed name it came from; (None, {}) when there are no names."""
    import re
    owner: dict[str, str] = {}
    for n in (v.strip() for v in names.values() if v and v.strip()):
        owner.setdefault(n.lower(), n)
        for p in re.split(r"[\s-]+", n):
            if len(p) >= 2:
                owner.setdefault(p.lower(), n)
    if not owner:
        return None, {}
    alts = "|".join(re.escape(p) for p in sorted(owner, key=len, reverse=True))
    return re.compile(rf"(?<!\w)(?:{alts})(?!\w)", re.IGNORECASE), owner  # \w is Unicode-aware in Python 3


def _scrub(text: str, pat) -> tuple[str, int]:
    return pat.subn("[name]", text) if pat else (text, 0)


def to_redacted(segs, names=None, options=None):
    """Plain text with every speaker name replaced by P01, P02… and any name the user typed removed from the text."""
    names = names or {}
    codes = _redaction_map(segs, names)
    pat, _ = _name_pattern(names)

    def scrub(t: str) -> str:
        return _scrub(t, pat)[0]

    stamp = (options or {}).get("timestamps", True)
    return "\n".join((f"[{_ts(s['start'])[:8]}] " if stamp else "") + f"{codes[s['speaker']]}: {scrub(s['text'])}" for s in segs) + "\n"


def _sentence_words(text: str):
    """Words of each sentence, in order; the first word of a sentence is skipped by the caller (it is capitalised anyway)."""
    import re

    for sentence in re.split(r"(?<=[.!?…])\s+", text):
        yield re.findall(r"[^\W\d_]+(?:[-'’][^\W\d_]+)*", sentence)


def redaction_report(segs, names=None, language: str | None = None) -> tuple[str, str]:
    """After an anonymised export: (report, key). The report is safe to give to a reviewer: counts and the words that might still be names,
    never a real name. The key maps P01, P02… to the speakers' names and counts the removals; keep it apart from the data."""
    import re
    from collections import Counter

    names = names or {}
    codes = _redaction_map(segs, names)
    pat, owner = _name_pattern(names)
    removed = Counter()
    candidates: Counter = Counter()
    for s in segs:
        text = s["text"]
        if pat:
            for m in pat.finditer(text):
                removed[owner[m.group(0).lower()]] += 1
            text = _scrub(text, pat)[0]
        for words in _sentence_words(text):
            for w in words[1:]:
                if len(w) >= 3 and w[0].isupper() and not re.match(r"I['’]", w):  # not the English "I'm", "I've"
                    candidates[w] += 1
    german = (language or "").lower().startswith("de")
    lines = [
        "Anonymisation report",
        "",
        f"Speakers replaced by codes: {len(codes)} ({', '.join(codes.values()) or 'none'})",
        f"Names you gave to speakers, removed from the text: {sum(removed.values())} time(s) in {len(removed)} name(s)",
        "",
        "Words that start with a capital letter inside a sentence and are still in the exported text.",
        "They may be names of people, places or organisations. Check them by hand.",
    ]
    if german:
        lines.append("German writes every noun with a capital letter, so this list is long for German.")
    listed = [f"  {w}  ({n}x)" for w, n in sorted(candidates.items(), key=lambda kv: (-kv[1], kv[0]))] or ["  (none found)"]
    lines += ["", *listed, "",
              "What this report cannot tell you:",
              "- It looks only for capitalised words. A name that is not capitalised, or one at the start of a sentence, is not listed.",
              "- It only removes names you gave to speakers. Other names spoken in the recording stay in the text.",
              "- It is a help for checking, not proof that the text is anonymous.", ""]
    key = ["Key for the anonymised export. Keep this file apart from the data.", ""]
    key += [f"{code} = {names.get(sp) or sp}" for sp, code in codes.items()]
    key += ["", "Removed from the text:"] + [f"  {n}: {c}x" for n, c in removed.most_common()] + [""]
    return "\n".join(lines), "\n".join(key)


def quote_list(segs, highlights=None):
    """Everything worth quoting, in the order it occurs: each highlight, plus each marked line that holds no highlight of its own.
    Entries are {start, end, text, speaker, reason, ai}."""
    hl = [h for h in (highlights or []) if h.get("text")]
    out = [{"start": h["start"], "end": h["end"], "text": h["text"], "speaker": h.get("speaker", ""), "reason": h.get("reason") or "", "ai": bool(h.get("ai"))} for h in hl]
    for s in segs:
        if s.get("marked") and not any(min(h["end"], s["end"]) > max(h["start"], s["start"]) for h in hl):
            out.append({"start": s["start"], "end": s["end"], "text": s["text"], "speaker": s["speaker"], "reason": "", "ai": False})
    return sorted(out, key=lambda q: q["start"])


def _quote_cues(q: dict, segs, lang: str | None, options: dict | None) -> str:
    """` [wording unsure: ...]` for a quote: the cues of the line it comes from, limited to the unsure words the quote actually contains."""
    if not (options or {}).get("cues"):
        return ""
    best, share = None, 0.0
    for s in segs:
        ov = min(q["end"], s["end"]) - max(q["start"], s["start"])
        if ov > share:
            best, share = s, ov
    if best is None:
        return ""
    text = q["text"].lower()
    mine = {**best, "unsure": [w for w in (best.get("unsure") or []) if w.lower() in text]}
    labels = cue_labels(mine, lang, options)
    return f" [{', '.join(labels)}]" if labels else ""


def to_quotes(segs, names=None, highlights=None, options=None):
    """The highlights and the marked lines, as quotes with speaker and time (and, when the cues are on, what a reader should know about the line each came from)."""
    names = names or {}
    o = options or {}
    quotes = quote_list(segs, highlights)
    return "\n\n".join(f"“{q['text']}”\n— {names.get(q['speaker'], q['speaker'])}, {_clock(q['start'])}{_quote_cues(q, segs, o.get('lang'), o)}" for q in quotes) + ("\n" if quotes else "")


def to_highlights_docx(segs, names=None, highlights=None, title=None, lang=None) -> bytes:
    """Word document with the highlights as a list of quotes, each with speaker, time and (for suggestions) the reason."""
    from docx import Document
    from docx.shared import Pt

    names = names or {}
    L = _tr(lang)
    doc = Document()
    _a11y(doc, title or L["highlights"], lang)
    doc.add_heading(title or L["highlights"], 0)
    quotes = quote_list(segs, highlights)
    if not quotes:
        doc.add_paragraph(L["nohighlights"])
    for q in quotes:
        p = doc.add_paragraph()
        p.add_run(f"“{q['text']}”").italic = True
        who = doc.add_paragraph()
        r = who.add_run(f"— {names.get(q['speaker'], q['speaker'])}, {_clock(q['start'])}" + (f"  ·  {q['reason']}" if q["reason"] else ""))
        r.font.size = Pt(9)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def to_changes(segs, names=None, options=None):
    """Original (as heard by the model) versus edited text, for every line the user changed."""
    names = names or {}
    L = _tr((options or {}).get("lang"))
    out = []
    for s in segs:
        o = s.get("orig")
        if not o or o.get("text") == s["text"]:
            continue
        out.append(f"[{_ts(s['start'])[:8]}] {_name(s, names)}\n  - {L['original']}{o['text']}\n  + {L['edited']}{s['text']}")
    n = len(out)
    head = L["edited1" if n == 1 else "editedN"].format(n=n, m=len(segs)) + "\n\n"
    return head + "\n\n".join(out) + ("\n" if out else "")


def to_combined_csv(items, options=None):
    """items: [{"name": project name, "segments": [...], "speakers": {...}}] → one spreadsheet across projects."""
    excel = bool(_opt(options, "excel", False))
    cell = _xl if excel else str
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["project", "start_seconds", "end_seconds", "start", "end", "speaker", "text"])
    for it in items:
        names = it.get("speakers") or {}
        for s in it["segments"]:
            w.writerow([cell(it["name"]), f"{s['start']:.2f}", f"{s['end']:.2f}", _ts(s["start"])[:8], _ts(s["end"])[:8], cell(_name(s, names)), cell(s["text"])])
    return ("\ufeff" if excel else "") + buf.getvalue()


def _with_time(item, segs) -> str:
    """Text of a summary item with the time of its source line in front; older summaries (plain strings, no line) print as they are."""
    text = item if isinstance(item, str) else item.get("text", "")
    line = None if isinstance(item, str) else item.get("line")
    return f"[{_clock(segs[line]['start'])}] {text}" if isinstance(line, int) and 0 <= line < len(segs) else text


def to_minutes(segs, names=None, title=None, lang=None, summary=None, highlights=None, stamp=None) -> bytes:
    """Word document laid out as minutes: attendees, decisions and action items (lines the user marked), then the record."""
    from docx import Document
    from docx.shared import Pt

    names = names or {}
    L = _tr(lang)
    doc = Document()
    _a11y(doc, title or L["minutes"], lang)
    doc.add_heading(title or L["minutes"], 0)
    people = []
    for s in segs:
        n = _name(s, names)
        if n not in people:
            people.append(n)
    doc.add_heading(L["attendees"], 2)
    doc.add_paragraph(", ".join(people) or "—")
    summary = summary or {}
    if summary.get("summary"):
        doc.add_heading(L["summary"], 2)
        doc.add_paragraph(summary["summary"])
        note = doc.add_paragraph(L["aisummary"])
        note.runs[0].italic = True
        note.runs[0].font.size = Pt(9)
    if summary.get("topics"):
        doc.add_heading(L["topics"], 2)
        for t in summary["topics"]:
            doc.add_paragraph(f"{_clock(t['start'])}  {t['title']}", style="List Bullet")
    marked = [s for s in segs if s.get("marked")]
    decisions = summary.get("decisions") or []
    doc.add_heading(L["decisions"], 2)
    if marked or decisions:
        for s in marked:
            doc.add_paragraph(f"{s['text']} ({_name(s, names)}, {_clock(s['start'])})", style="List Bullet")
        for d in decisions:
            doc.add_paragraph(_with_time(d, segs), style="List Bullet")
    else:
        doc.add_paragraph(L["nomarks"])
    if summary.get("actions"):
        doc.add_heading(L["actions"], 2)
        table = doc.add_table(rows=1, cols=3)  # owner, action, and an empty due column to fill in (no date is invented)
        table.style = "Table Grid"
        for cell, text in zip(table.rows[0].cells, (L["owner"], L["task"], L["due"])):
            cell.text = text
            cell.paragraphs[0].runs[0].bold = True
        # Word's "header row" flag: screen readers then announce the column name with each cell
        from docx.oxml import OxmlElement
        trPr = table.rows[0]._tr.get_or_add_trPr()
        trPr.append(OxmlElement("w:tblHeader"))
        for a in summary["actions"]:
            row = table.add_row().cells
            row[0].text = a.get("owner") or "—"
            row[1].text = _with_time(a, segs)
            row[2].text = ""
    quotes = quote_list([], highlights)
    if quotes:
        doc.add_heading(L["keyquotes"], 2)
        for q in quotes:
            doc.add_paragraph(f"“{q['text']}” — {names.get(q['speaker'], q['speaker'])}, {_clock(q['start'])}", style="List Bullet")
    doc.add_heading(L["record"], 2)
    for s in segs:
        if s.get("chapter"):
            doc.add_heading(s["chapter"], 3)
        p = doc.add_paragraph()
        r = p.add_run(f"{_name(s, names)}  {_clock(s['start'])}  ")
        r.bold = True
        r.font.size = Pt(9)
        p.add_run(s["text"])
    if stamp:  # the optional version line, last
        note = doc.add_paragraph(stamp)
        note.runs[0].italic = True
        note.runs[0].font.size = Pt(8)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
