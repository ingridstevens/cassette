import time

from .protocol import log, progress


def pick_device(pref: str = "auto") -> tuple[str, str]:
    """Whisper runs on ctranslate2, so ask it (not torch) whether an NVIDIA GPU is usable."""
    if pref in ("auto", "cuda"):
        try:
            import ctranslate2

            if ctranslate2.get_cuda_device_count() > 0:
                return "cuda", "float16"
        except Exception:  # no CUDA runtime installed: fall back quietly
            pass
    return "cpu", "int8"


# A short disfluent sample nudges Whisper to write hesitations down instead of tidying them away. It is a nudge, not a guarantee.
VERBATIM_PROMPTS = {
    "en": "Umm, let me think like, hmm... Okay, here's what I'm, like, thinking.",
    "de": "Ähm, also, äh, ich muss mal überlegen, hmm... Okay, also, ähm, ich denke, ja.",
    "fr": "Euh, alors, euh, je réfléchis, hum... Bon, alors, euh, je pense que, ben, oui.",
    "es": "Eh, bueno, este, déjame pensar, mmm... Vale, entonces, eh, yo creo que, pues, sí.",
}


def build_prompt(user_prompt: str | None, verbatim: bool, language: str | None) -> str | None:
    """The user's vocabulary first, then (for verbatim) the sample in the recording's language. None when neither applies."""
    parts = [user_prompt or ""]
    if verbatim and language in VERBATIM_PROMPTS:
        parts.append(VERBATIM_PROMPTS[language])
    return " ".join(p for p in parts if p).strip() or None


def transcribe(audio, model_name: str, language: str | None, device: str, vad: bool,
               prompt: str | None, offset: float, duration: float, multilingual: bool = False, loaded=None, verbatim: bool = False,
               on_words=None):
    """Returns (words, detected_language, info). Word times are shifted by `offset`.
    `info` = {"device": whisper device used, "languageProb": detection confidence 0..1}.
    `loaded` is a (model, device, compute) tuple from load_model(), to avoid loading twice.
    `on_words(words)` is called with each segment's words as soon as the segment is written down."""
    model, dev, _compute = loaded or load_model(model_name, device)
    t0 = time.time()
    if verbatim and not language:  # the sample must be in the right language, so find it first
        language = model.detect_language(audio)[0]
        log(f"Language for the hesitation prompt: {language}")
    segments, info = model.transcribe(
        audio, language=language, word_timestamps=True, vad_filter=vad,
        initial_prompt=build_prompt(prompt, verbatim, language), condition_on_previous_text=False, multilingual=multilingual,
    )
    log(f"Language: {info.language} (confidence {info.language_probability:.0%})"
        + (" — forced by you" if language else " — auto-detected")
        + (" · re-detected for every chunk" if multilingual and not language else ""))
    words = []
    for seg in segments:
        got = [{"start": w.start + offset, "end": w.end + offset, "word": w.word, "prob": round(w.probability, 3)} for w in seg.words or []]
        words.extend(got)
        if got and on_words:
            on_words(got)
        progress("transcribe", min(seg.end / max(duration, 0.1), 1.0))
    log(f"Transcribed {len(words)} words in {time.time() - t0:.1f}s ({duration / max(time.time() - t0, 0.1):.1f}× realtime)")
    return words, info.language, {"device": dev, "languageProb": round(float(info.language_probability), 3)}


def pick_backend(pref: str, model_name: str, device: str, vad: bool) -> str:
    """"mlx" (Apple GPU) or "faster" (faster-whisper). Automatic uses the Apple GPU only when it can do the job:
    an Apple Silicon Mac, that size downloaded for it, no CPU-only choice, and no "skip silence" (which MLX lacks)."""
    from . import models
    from .asr_mlx import available

    cached = available() and models._cached(models.MLX_MODELS[model_name])
    if pref == "faster":
        return "faster"
    if pref == "mlx":
        if not available():
            raise RuntimeError("The Apple GPU engine needs a Mac with an Apple chip.")
        if not cached:
            raise RuntimeError(f"The Apple GPU version of “{model_name}” is not downloaded yet. Download it in Settings, Performance.")
        return "mlx"
    return "mlx" if cached and device != "cpu" and not vad else "faster"


def _whisper_helper(device: str):
    """The smallest downloaded Whisper size, for the things Parakeet cannot do (finding the language, translating). None when there is none."""
    from . import models

    for name in ("tiny", "base", "small", "medium", "large-v3-turbo", "large-v3"):
        if models._cached(models.WHISPER_MODELS[name]):
            return load_model(name, device, "faster")[0]
    return None


def load_model(model_name: str, device: str, backend: str = "faster", vad: bool = False):
    """Load a downloaded speech model (offline). Returns (model, device, compute type)."""
    import sys

    from .models import PARAKEET_MODELS

    if model_name.startswith("moonshine-"):
        from .asr_moonshine import MoonshineModel, available, cached, catalog

        if not available() or model_name not in catalog():
            raise RuntimeError("This Moonshine model is not available on this computer.")
        if not cached(model_name):
            raise RuntimeError("This Moonshine model is not downloaded yet. Download it in Settings, Storage and models.")
        progress("transcribe", 0.0, f"Loading {model_name}")
        log(f"Speech model {model_name} loaded (Moonshine, offline)")
        return MoonshineModel(model_name, helper=_whisper_helper(device)), "cpu", "int8"

    if model_name in PARAKEET_MODELS:
        from huggingface_hub import snapshot_download

        from .asr_parakeet import ParakeetModel, available
        from .models import models_dir

        if not available():
            raise RuntimeError("Parakeet needs a Mac with an Apple chip.")
        progress("transcribe", 0.0, f"Loading {model_name} on the Apple GPU")
        path = snapshot_download(PARAKEET_MODELS[model_name], cache_dir=models_dir(), local_files_only=True)
        log(f"Speech model {model_name} loaded from {path} (Apple GPU engine, MLX, offline)")
        if vad:
            log("“Skip silence” is not available with Parakeet and is ignored")
        return ParakeetModel(path, helper=_whisper_helper(device)), "mps", "bfloat16"

    use = pick_backend(backend, model_name, device, vad) if backend != "faster" else "faster"
    if use == "mlx":
        from huggingface_hub import snapshot_download

        from .asr_mlx import MlxModel
        from .models import MLX_MODELS, models_dir

        progress("transcribe", 0.0, f"Loading {model_name} on the Apple GPU")
        path = snapshot_download(MLX_MODELS[model_name], cache_dir=models_dir(), local_files_only=True)
        log(f"Whisper model {model_name} loaded from {path} (Apple GPU engine, MLX, offline)")
        if vad:
            log("“Skip silence” is not available on the Apple GPU engine and is ignored")
        return MlxModel(path), "mps", "float16"

    from faster_whisper import WhisperModel
    from huggingface_hub import snapshot_download

    from .models import WHISPER_MODELS, models_dir

    dev, compute = pick_device(device)
    if sys.platform == "darwin" and device in ("auto", "mps"):
        log("Whisper runs on the CPU on Mac (its engine has no Apple GPU backend); speaker detection can use the Apple GPU")
    progress("transcribe", 0.0, f"Loading {model_name} on {dev}")
    path = snapshot_download(WHISPER_MODELS[model_name], cache_dir=models_dir(), local_files_only=True)
    log(f"Whisper model {model_name} loaded from {path} (device={dev}, compute={compute}, offline)")
    return WhisperModel(path, device=dev, compute_type=compute), dev, compute


FIT_SECONDS = 30.0     # the start of the recording used to find its language (one pass, about a second)
FIT_CONFIDENCE = 0.6   # below this the language is a guess (music, silence, noise), so nothing is said about the model


def check_fit(model, audio, sr: int, model_name: str, have: dict[str, bool] | None = None) -> dict | None:
    """Is `model_name` weak for the language heard at the start of `audio`? Returns what the app needs to ask the user
    ({language, probability, model, level: "weak" | "poor", suggested}), or None when the model is fine, the language is unclear, or no better model exists."""
    from .fit import fit, suggest

    lang, prob, _all = model.detect_language(audio[: int(FIT_SECONDS * sr)])
    if prob < FIT_CONFIDENCE:
        return None
    level = fit(model_name, lang)
    better = suggest(model_name, lang, have)
    if level == "good" or better is None:
        return None
    log(f"Language heard at the start: {lang} ({prob:.0%}). “{model_name}” is {level} for it; “{better}” would do better.")
    return {"language": lang, "probability": round(float(prob), 3), "model": model_name, "level": level, "suggested": better,
            "have": {m: bool(v) for m, v in (have or {}).items()}}


MIN_TURN = 0.35   # seconds: shorter speaker turns are skipped; Whisper invents words ("Thank you.") on slivers of audio
TURN_PAD = 0.15   # seconds of context added on each side of a turn


def transcribe_turns(model, audio, sr: int, turns, vad: bool, prompt: str | None, offset: float, verbatim: bool = False, on_words=None):
    """Mixed-language recordings: transcribe every speaker turn on its own, detecting its language each time.
    `turns` are (start, end, speaker) in file time; `audio` starts at `offset`.
    Returns (words, dominant_language, {"languageProb": ..., "languages": {code: seconds}}). Every word carries `lang`."""
    words, seconds, probs = [], {}, []
    todo = [t for t in turns if t[1] - t[0] >= MIN_TURN]
    skipped = len(turns) - len(todo)
    total = len(audio) / sr
    for n, (a, b, _spk) in enumerate(todo):
        lo, hi = max(0.0, a - offset - TURN_PAD), min(total, b - offset + TURN_PAD)
        clip = audio[int(lo * sr): int(hi * sr)]
        lang = model.detect_language(clip)[0] if verbatim else None
        segments, info = model.transcribe(clip, language=lang, word_timestamps=True, vad_filter=vad,
                                          initial_prompt=build_prompt(prompt, verbatim, lang), condition_on_previous_text=False)
        got = 0
        turn_words = []
        for seg in segments:
            for w in seg.words or []:
                ws, we = w.start + lo + offset, w.end + lo + offset
                if we < a or ws > b:  # context padding only: belongs to the neighbouring turn
                    continue
                words.append({"start": ws, "end": we, "word": w.word, "prob": round(w.probability, 3), "lang": info.language})
                turn_words.append(words[-1])
                got += 1
        if turn_words and on_words:
            on_words(turn_words)
        if got:
            seconds[info.language] = seconds.get(info.language, 0.0) + (b - a)
            probs.append(float(info.language_probability))
        progress("transcribe", (n + 1) / max(len(todo), 1))
    if skipped:
        log(f"Skipped {skipped} speaker turn(s) shorter than {MIN_TURN} s")
    words.sort(key=lambda w: w["start"])
    dominant = max(seconds, key=seconds.get) if seconds else "en"
    log("Languages by speaking time: " + ", ".join(f"{k} {v:.0f}s" for k, v in sorted(seconds.items(), key=lambda kv: -kv[1])))
    return words, dominant, {"languageProb": round(sum(probs) / len(probs), 3) if probs else None, "languages": {k: round(v, 1) for k, v in seconds.items()}}


PROBE_TURNS = 10      # how many of the longest speaker turns are checked to decide whether a recording mixes languages
PROBE_SECONDS = 15.0  # at most this much of each turn is used for the check
PROBE_CONFIDENCE = 0.75
PROBE_MIN_SECONDS = 1.0  # a language must cover at least this much checked speech to count


def probe_languages(model, audio, sr: int, turns, offset: float) -> dict[str, float]:
    """Quick language ID of the longest speaker turns. Returns {language: seconds of checked speech}, confident detections only."""
    found: dict[str, float] = {}
    longest = sorted((t for t in turns if t[1] - t[0] >= MIN_TURN), key=lambda t: t[0] - t[1])[:PROBE_TURNS]
    for a, b, _spk in longest:
        lo = max(0.0, a - offset)
        hi = min(len(audio) / sr, lo + min(b - a, PROBE_SECONDS))
        clip = audio[int(lo * sr): int(hi * sr)]
        lang, prob, _all = model.detect_language(clip)
        if prob >= PROBE_CONFIDENCE:
            found[lang] = found.get(lang, 0.0) + (hi - lo)
    return found


def is_mixed(found: dict[str, float]) -> bool:
    """Two or more languages, each with enough confident speech (so one misdetected sliver does not flip the mode)."""
    return sum(1 for v in found.values() if v >= PROBE_MIN_SECONDS) >= 2


def translate_clip(model, audio, sr: int, start: float, end: float, offset: float, language: str | None) -> str:
    """English translation of audio[start:end] (file time). Whisper can only translate into English."""
    lo, hi = max(0.0, start - offset - TURN_PAD), min(len(audio) / sr, end - offset + TURN_PAD)
    clip = audio[int(lo * sr): int(hi * sr)]
    segments, _info = model.transcribe(clip, language=language, task="translate", condition_on_previous_text=False)
    return " ".join(seg.text.strip() for seg in segments).strip()
