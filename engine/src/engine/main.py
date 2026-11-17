"""CLI entrypoint. Every command reports via JSON lines on stdout (see protocol.py)."""
import argparse
import json
import os
import sys
import tempfile
import time
import traceback
from pathlib import Path

from . import export as ex
from .models import WHISPER_LANGUAGES, WHISPER_MODELS
from .protocol import emit, log, partial, progress


def cmd_transcribe(a) -> None:
    from . import models
    from .asr import transcribe
    from .audio import decode
    from .diarize import diarize
    from .merge import assign_speakers, group_segments

    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "audio.wav"
        progress("decode", None, "Decoding audio")
        log(f"Input: {a.input}" + (f" (range {a.start or 0:.1f}s-{a.end}s)" if a.start or a.end else ""))
        decode(a.input, wav, a.start, a.end)
        from .audio import load_wav

        data, sr = load_wav(wav)
        offset, duration = a.start or 0.0, len(data) / sr
        log(f"Decoded to 16 kHz mono, {duration:.1f}s. Nothing leaves this computer.")
        from .asr import check_fit, is_mixed, load_detector, load_model, probe_languages, transcribe_turns, translate_clip

        t0 = time.time()
        loaded = load_model(a.model, a.device, a.backend, a.vad)
        model, dev, _compute = loaded
        seconds_load = time.time() - t0
        detector = load_detector(a.detect_model, a.model, a.device, model)
        if a.language == "auto" and not getattr(a, "accept_fit", False):
            # Before the slow parts: if this model is weak for what is spoken, stop here and let the app ask (the run starts again from scratch)
            have = {n: models._cached(r) for n, r in models.WHISPER_MODELS.items()}
            ask = check_fit(detector, data, sr, a.model, have)
            if ask:
                emit("fit", **ask)
                return
        turns = []
        speaker_info, seconds_speakers = {}, None
        if a.no_diarize:
            log("Speaker detection is OFF (Transcript only)")
        else:
            t0 = time.time()
            turns, speaker_info = diarize(wav, a.device, a.num_speakers, a.min_speakers, a.max_speakers, offset)
            seconds_speakers = round(time.time() - t0, 1)
        t0 = time.time() - seconds_load  # the time to write the words down includes loading the model
        mixed = False
        if a.language == "auto" and turns and a.mixed_languages != "off":
            if a.mixed_languages == "on":
                mixed = True
            else:
                found = probe_languages(detector, data, sr, turns, offset)
                mixed = is_mixed(found)
                log("Checked the language of each speaker: " + (", ".join(f"{k} {v:.0f}s" for k, v in found.items()) or "no confident result")
                    + (" · several languages found, switching to per-speaker detection" if mixed else " · one language, normal mode"))

        def on_words(got: list[dict]) -> None:  # the transcript grows on screen while the run goes on
            partial([{k: v for k, v in s.items() if k != "words"} for s in group_segments(assign_speakers(got, turns))])

        if mixed:
            log("Detecting the language separately for each speaker turn")
            words, lang, asr_info = transcribe_turns(model, data, sr, turns, a.vad, a.prompt, offset, a.verbatim, on_words, detector)
            asr_info["device"] = dev
        else:
            words, lang, asr_info = transcribe(data, a.model, None if a.language == "auto" else a.language,
                                               a.device, a.vad, a.prompt, offset, duration, a.mixed_languages == "on" and not turns, loaded, a.verbatim, on_words)
        seconds_transcribe = round(time.time() - t0, 1)
    progress("merge", None, "Assigning speakers")
    segments = group_segments(assign_speakers(words, turns))
    speakers = sorted({s["speaker"] for s in segments})
    translated = 0
    target = getattr(a, "translate_to", None) or ("en" if a.translate else None)
    from .llm import TRANSLATION_MODEL
    from .models import _llm_cached

    if target and (_llm_cached(TRANSLATION_MODEL) or target != "en"):
        # The translation model is used whenever it is downloaded; Whisper can only translate into English
        from .llm import LocalLLM
        from .translate import translate_segments

        if not _llm_cached(TRANSLATION_MODEL):
            raise RuntimeError("Translating into this language needs the translation model. Download it in Settings, Storage and models.")
        progress("translate", 0.0, "Loading the translation model")
        translator = LocalLLM(TRANSLATION_MODEL)
        translated = translate_segments(segments, target, lang, translator, lambda f: progress("translate", f, "Translating"))
        log(f"Translated {translated} line(s) into {target} with the translation model")
    elif target:
        for seg in segments:
            if (seg.get("lang") or lang) != "en":
                progress("translate", translated / max(len(segments), 1), "Translating to English")
                seg["translation"] = translate_clip(model, data, sr, seg["start"], seg["end"], offset, seg.get("lang") or lang)
                seg["translationLang"] = "en"
                translated += 1
        log(f"Translated {translated} line(s) to English")
    log(f"Done: {len(segments)} segments, speakers: {chr(44).join(speakers)}")
    meta = {
        "model": a.model, "device": asr_info.get("device"), "speakerDevice": speaker_info.get("device"),
        "secondsSpeakers": seconds_speakers, "languages": asr_info.get("languages"), "mixed": mixed, "translated": translated, "translateTo": target, "secondsTranscribe": seconds_transcribe, "languageProb": asr_info.get("languageProb"),
    }
    emit("done", language=lang, duration=duration + offset, speakers=speakers, segments=segments, meta=meta)


def cmd_live(a) -> None:
    """Live transcription of the microphone: raw 16 kHz mono 16-bit audio on stdin, `live` events on stdout until stdin closes."""
    from . import models
    from .asr import check_fit, load_model
    from .live import SAMPLE_RATE, run

    models.use_offline_cache()
    model, _dev, _compute = load_model(a.model, a.device, a.backend)
    log("Live transcription is ready. Nothing leaves this computer.")
    emit("ready")

    def on_first_audio(m, audio) -> None:  # once: is this model weak for what is being said? The final run after stopping asks about it again.
        if a.language == "auto":
            have = {n: models._cached(r) for n, r in models.WHISPER_MODELS.items()}
            ask = check_fit(m, audio, SAMPLE_RATE, a.model, have)
            if ask:
                emit("fit", **ask)

    def emit_live(confirmed: list[dict], tentative: list[dict], seconds: float) -> None:
        emit("live", confirmed=[{"start": w["start"], "end": w["end"], "word": w["word"]} for w in confirmed],
             tentative="".join(w["word"] for w in tentative), seconds=round(seconds, 1))

    run(model, SAMPLE_RATE, None if a.language == "auto" else a.language, a.step, sys.stdin.buffer, emit_live, on_first_audio)
    emit("done")


def cmd_translate(a) -> None:
    """English translation of one stretch of a recording (for the "Translate to English" action on a line)."""
    from .asr import load_model, translate_clip
    from .audio import decode, load_wav

    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "audio.wav"
        decode(a.input, wav, a.start, a.end)
        data, sr = load_wav(wav)
        model, _dev, _c = load_model(a.model, a.device, a.backend)
        text = translate_clip(model, data, sr, a.start or 0.0, (a.start or 0.0) + len(data) / sr, a.start or 0.0, None if a.language == "auto" else a.language)
    emit("done", text=text)


def cmd_models(a) -> None:
    from . import models

    models.use_offline_cache()
    if a.action == "status":
        emit("done", **models.status())
    elif a.action == "download":
        progress("download", None, f"Downloading {a.name}")
        if a.name == "diarization":
            models.download_diarization(a.token or os.environ.get("HF_TOKEN", ""))
        elif a.name.startswith("mlx-"):
            models.download_mlx(a.name[4:])
        elif a.name.startswith("llm-"):
            models.download_llm(a.name[4:])
        elif a.name.startswith("moonshine-"):
            from .asr_moonshine import download

            download(a.name)
        else:
            models.download_whisper(a.name)
        emit("done", **models.status())
    elif a.action == "import":
        report = models.folder_report(models.scan_folder(Path(a.name)))  # read before copying: it describes the folder, not our copy
        done = models.import_folder(Path(a.name))
        log(f"Imported {len(done)} model(s) from {a.name}")
        emit("done", imported=done, report=report, **models.status())
    elif a.action == "check":
        emit("done", **models.check_access(a.token or os.environ.get("HF_TOKEN", "")))
    elif a.action == "delete":
        kind = "diarization" if a.name == "diarization" else "mlx" if a.name.startswith("mlx-") else "llm" if a.name.startswith("llm-") else "moonshine" if a.name.startswith("moonshine-") else "whisper"
        models.delete(kind, a.name[4:] if kind in ("mlx", "llm") else a.name)
        emit("done", **models.status())


def cmd_export(a) -> None:
    data = json.loads(Path(a.transcript).read_text())
    if a.format == "combined-csv":
        Path(a.output).write_text(ex.to_combined_csv(data["projects"]), encoding="utf-8", newline="")
        emit("done", path=a.output)
        return
    names = data.get("speakers", {})
    opts = {**(data.get("options") or {}), "lang": data.get("lang"), "fileLanguage": data.get("language")}
    segs = data["segments"]
    if a.format in ("txt", "md", "csv", "docx", "minutes", "redacted"):
        segs = ex.apply_style(segs, opts, data.get("language"))
    if a.format == "docx":
        Path(a.output).write_bytes(ex.to_docx(segs, names, title=Path(a.output).stem, lang=data.get("lang"), options=opts))
    elif a.format == "minutes":
        Path(a.output).write_bytes(ex.to_minutes(segs, names, title=Path(a.output).stem, lang=data.get("lang"), summary=data.get("summary"), highlights=data.get("highlights")))
    elif a.format == "highlights":
        Path(a.output).write_bytes(ex.to_highlights_docx(segs, names, data.get("highlights"), title=Path(a.output).stem, lang=data.get("lang")))
    elif a.format == "quotes":
        Path(a.output).write_text(ex.to_quotes(segs, names, data.get("highlights")), encoding="utf-8", newline="")
    elif a.format == "edl":
        Path(a.output).write_text(ex.to_edl(segs, names, opts, title=Path(a.output).stem), encoding="utf-8", newline="")
    else:
        fn = {"txt": ex.to_txt, "srt": ex.to_srt, "vtt": ex.to_vtt, "md": ex.to_md, "json": ex.to_json, "csv": ex.to_csv, "chapters": ex.to_chapters,
              "redacted": ex.to_redacted, "changes": ex.to_changes}[a.format]
        text = fn(segs, names, opts) if a.format in ("srt", "vtt", "chapters", "changes", "txt", "md", "redacted") else fn(segs, names)
        Path(a.output).write_text(text, encoding="utf-8", newline="")
    emit("done", path=a.output)


def _transcript(path: str) -> tuple[list[dict], dict, str]:
    data = json.loads(Path(path).read_text())
    return data["segments"], data.get("speakers", {}), data.get("language") or "en"


def cmd_highlights(a) -> None:
    """Suggest the most quotable moments of a transcript with the local language model."""
    from .highlights import find_highlights
    from .llm import LocalLLM

    segs, names, language = _transcript(a.transcript)
    progress("highlights", None, "Loading the language model")
    llm = LocalLLM(a.model)
    log(f"Looking for highlights in {len(segs)} lines with the local language model. Nothing leaves this computer.")
    found = find_highlights(segs, names, llm, a.count, a.output_language or language, lambda f: progress("highlights", f, "Reading the transcript"))
    log(f"Found {len(found)} highlight(s)")
    emit("done", highlights=found)


def cmd_summarize(a) -> None:
    """Write a summary (topics, decisions, action items) of a transcript with the local language model."""
    from .llm import LocalLLM
    from .summarize import summarize

    segs, names, language = _transcript(a.transcript)
    progress("summarize", None, "Loading the language model")
    llm = LocalLLM(a.model)
    log(f"Summarising {len(segs)} lines with the local language model. Nothing leaves this computer.")
    emit("done", summary=summarize(segs, names, llm, a.output_language or language, lambda f: progress("summarize", f, "Writing the summary")))


def cmd_ask(a) -> None:
    """Answer a question about a transcript with the local language model, naming the lines the answer is based on."""
    from .ask import ask
    from .llm import LocalLLM

    data = json.loads(Path(a.transcript).read_text())
    segs, names, language = data["segments"], data.get("speakers", {}), data.get("language") or "en"
    progress("ask", None, "Loading the language model")
    llm = LocalLLM(a.model)
    log(f"Answering a question about {len(segs)} lines with the local language model. Nothing leaves this computer.")
    emit("done", answer=ask(segs, names, str(data.get("question") or ""), llm, language, data.get("history"), lambda f: progress("ask", f, "Reading the transcript")))


def cmd_export_clips(a) -> None:
    from .audio import export_clips

    clips = json.loads(Path(a.clips).read_text())
    paths = export_clips(a.input, a.output, clips, a.format, a.pad, lambda f: progress("clips", f, "Cutting the clips"))
    log(f"Wrote {len(paths)} audio clip(s)")
    emit("done", paths=paths)


def cmd_clip(a) -> None:
    from .audio import clip

    clip(a.input, a.output, a.start, a.end)
    emit("done", path=a.output)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="engine")
    sub = p.add_subparsers(dest="cmd", required=True)

    t = sub.add_parser("transcribe")
    t.add_argument("input")
    t.add_argument("--model", default="small")
    t.add_argument("--language", default="auto", choices=["auto", *WHISPER_LANGUAGES])
    t.add_argument("--detect-model", choices=[*WHISPER_MODELS, "same"], default="tiny",
                   help="Whisper size that only finds out which language is spoken (default tiny: fast, and the answer is a few letters). 'same' uses --model. Falls back to --model when not downloaded.")
    t.add_argument("--num-speakers", type=int)
    t.add_argument("--min-speakers", type=int)
    t.add_argument("--max-speakers", type=int)
    t.add_argument("--start", type=float)
    t.add_argument("--end", type=float)
    t.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda", "mps"])
    t.add_argument("--vad", action="store_true", help="skip silence")
    t.add_argument("--backend", default="auto", choices=["auto", "faster", "mlx"], help="auto: the Apple GPU engine (MLX) when it is installed and downloaded, otherwise faster-whisper")
    t.add_argument("--prompt", help="custom vocabulary / initial prompt")
    t.add_argument("--no-diarize", action="store_true")
    t.add_argument("--mixed-languages", choices=["auto", "on", "off"], default="auto",
                   help="auto: check each speaker's language and switch to per-speaker detection when several are found")
    t.add_argument("--verbatim", action="store_true", help="nudge Whisper to write hesitations (um, äh) down instead of leaving them out")
    t.add_argument("--translate", action="store_true", help="add an English translation to lines in other languages")
    t.add_argument("--translate-to", help="add a translation into this language code to lines in other languages (English also works without the translation model)")
    t.add_argument("--accept-fit", action="store_true", help="do not stop to suggest a better model when this one is weak for the language heard at the start")
    t.set_defaults(fn=cmd_transcribe)

    lv = sub.add_parser("live")
    lv.add_argument("--model", default="small")
    lv.add_argument("--language", default="auto", choices=["auto", *WHISPER_LANGUAGES])
    lv.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda", "mps"])
    lv.add_argument("--backend", default="auto", choices=["auto", "faster", "mlx"])
    lv.add_argument("--step", type=float, default=2.0, help="seconds of new audio between updates")
    lv.set_defaults(fn=cmd_live)

    tr = sub.add_parser("translate")
    tr.add_argument("input")
    tr.add_argument("--start", type=float, required=True)
    tr.add_argument("--end", type=float, required=True)
    tr.add_argument("--model", default="small")
    tr.add_argument("--language", default="auto")
    tr.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda", "mps"])
    tr.add_argument("--backend", default="auto", choices=["auto", "faster", "mlx"])
    tr.set_defaults(fn=cmd_translate)

    m = sub.add_parser("models")
    m.add_argument("action", choices=["status", "download", "delete", "import", "check"])
    m.add_argument("name", nargs="?", help="whisper size or 'diarization'")
    m.add_argument("--token", help="Hugging Face token (diarization download only)")
    m.set_defaults(fn=cmd_models)

    e = sub.add_parser("export")
    e.add_argument("transcript")
    e.add_argument("output")
    e.add_argument("--format", required=True, choices=["txt", "srt", "vtt", "md", "json", "csv", "docx", "chapters", "edl", "minutes", "highlights", "redacted", "quotes", "changes", "combined-csv"])
    e.set_defaults(fn=cmd_export)

    h = sub.add_parser("highlights")
    h.add_argument("transcript")
    h.add_argument("--model", default="qwen3-4b", help="language model id, as listed by `models status` (default: qwen3-4b)")
    h.add_argument("--count", type=int, help="how many highlights (default: by length of the recording)")
    h.add_argument("--output-language", help="language of the reasons (default: the recording's language)")
    h.set_defaults(fn=cmd_highlights)

    sm = sub.add_parser("summarize")
    sm.add_argument("transcript")
    sm.add_argument("--model", default="qwen3-4b", help="language model id, as listed by `models status` (default: qwen3-4b)")
    sm.add_argument("--output-language", help="language of the summary (default: the recording's language)")
    sm.set_defaults(fn=cmd_summarize)

    ak = sub.add_parser("ask")
    ak.add_argument("transcript", help="JSON file: the transcript plus a `question` (and optionally the earlier `history` as {q, a} pairs)")
    ak.add_argument("--model", default="qwen3-4b", help="language model id, as listed by `models status` (default: qwen3-4b)")
    ak.set_defaults(fn=cmd_ask)

    ec = sub.add_parser("export-clips")
    ec.add_argument("input")
    ec.add_argument("output", help="folder to write the clips into")
    ec.add_argument("--clips", required=True, help="JSON file: a list of {start, end, speaker}")
    ec.add_argument("--format", choices=["mp3", "wav", "m4a"], default="mp3")
    ec.add_argument("--pad", type=float, default=0.3, help="seconds of room before and after each clip")
    ec.set_defaults(fn=cmd_export_clips)

    c = sub.add_parser("clip")
    c.add_argument("input")
    c.add_argument("output")
    c.add_argument("--start", type=float, required=True)
    c.add_argument("--end", type=float, required=True)
    c.set_defaults(fn=cmd_clip)
    return p


def configure_hub(cmd: str) -> None:
    """huggingface_hub reads these once at import time, so set them before anything imports it."""
    from .models import models_dir

    os.environ["HF_HUB_CACHE"] = str(models_dir())
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"  # unsupported ops fall back to CPU instead of crashing
    os.environ["PYANNOTE_CACHE"] = str(models_dir())  # pyannote loads its sub-models from here, not HF_HUB_CACHE
    if cmd in ("transcribe", "live", "highlights", "summarize", "ask"):  # inference never touches the network
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        # pyannote 3.x checkpoints predate torch>=2.6 weights_only loading; they are the official, hash-pinned downloads
        os.environ["TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD"] = "1"


def main() -> None:
    args = build_parser().parse_args()
    configure_hub(args.cmd)
    try:
        args.fn(args)
    except Exception as exc:  # noqa: BLE001 - surfaced to UI as an error event
        emit("error", message=str(exc), detail=traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
