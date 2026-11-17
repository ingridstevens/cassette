import time

from .protocol import log, progress


def pick_torch_device(pref: str = "auto") -> str:
    """auto: CUDA > Apple GPU (MPS) > CPU. Explicit choices fall back to CPU if unavailable."""
    import torch

    mps = getattr(torch.backends, "mps", None)
    has_mps = bool(mps and mps.is_available())
    if pref == "cpu":
        return "cpu"
    if pref in ("auto", "cuda") and torch.cuda.is_available():
        return "cuda"
    if pref in ("auto", "mps") and has_mps:
        return "mps"
    if pref != "auto":
        log(f"{pref} requested but not available on this machine; using CPU", "warn")
    return "cpu"


def diarize(wav_path, device: str, num_speakers: int | None, min_speakers: int | None,
            max_speakers: int | None, offset: float):
    """Returns (turns, info): turns are (start, end, speaker) shifted by `offset`; info = {"device": torch device used}."""
    import torch
    from pyannote.audio import Pipeline

    from .audio import load_wav
    from .models import models_dir

    progress("diarize", 0.0, "Loading speaker model")
    pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", cache_dir=str(models_dir()))
    if pipeline is None:
        raise RuntimeError("Speaker model not available. Download it in Settings (needs Hugging Face token).")
    dev = pick_torch_device(device)
    if dev == "cpu":
        from .threads import thread_budget

        torch.set_num_threads(thread_budget())
    pipeline.to(torch.device(dev))

    data, sr = load_wav(wav_path)
    log(f"Speaker model loaded (device={dev}, offline); analysing {len(data) / sr:.0f}s of audio")
    t0 = time.time()

    def hook(step_name, step_artifact, file=None, total=None, completed=None):
        if total:
            progress("diarize", (completed or 0) / total, step_name)

    result = pipeline(
        {"waveform": torch.from_numpy(data).unsqueeze(0), "sample_rate": sr},
        num_speakers=num_speakers, min_speakers=min_speakers, max_speakers=max_speakers, hook=hook,
    )
    turns = [(t.start + offset, t.end + offset, spk) for t, _, spk in result.itertracks(yield_label=True)]
    n = len({s for _, _, s in turns})
    progress("diarize", 1.0, f"Found {n} speaker" + ("" if n == 1 else "s"))
    log(f"Found {n} speaker(s) in {len(turns)} turns ({time.time() - t0:.1f}s)")
    return turns, {"device": dev}
