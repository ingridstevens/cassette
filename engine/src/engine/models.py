"""Model locations + downloads. All models live under ENGINE_MODELS_DIR; runtime is offline."""
import os
from pathlib import Path

WHISPER_MODELS = {
    "tiny": "Systran/faster-whisper-tiny",
    "base": "Systran/faster-whisper-base",
    "small": "Systran/faster-whisper-small",
    "medium": "Systran/faster-whisper-medium",
    "large-v3-turbo": "mobiuslabsgmbh/faster-whisper-large-v3-turbo",
    "large-v3": "Systran/faster-whisper-large-v3",
}
# The same Whisper sizes converted for MLX (the Apple GPU). Not gated. Used only on Apple Silicon Macs.
MLX_MODELS = {
    "tiny": "mlx-community/whisper-tiny-mlx",
    "base": "mlx-community/whisper-base-mlx",
    "small": "mlx-community/whisper-small-mlx",
    "medium": "mlx-community/whisper-medium-mlx",
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
    "large-v3": "mlx-community/whisper-large-v3-mlx",
}
# Other speech engines, listed beside the Whisper sizes. Apple Silicon Macs only (MLX); each is one model.
PARAKEET_MODELS = {"parakeet-v3": "mlx-community/parakeet-tdt-0.6b-v3"}
DIARIZATION_REPOS = ["pyannote/speaker-diarization-3.1", "pyannote/segmentation-3.0", "pyannote/wespeaker-voxceleb-resnet34-LM"]
LANGUAGES = ["de", "en", "fr", "es"]  # the four the app is tuned and tested for; pinned first in the picker
# Every language code Whisper understands (the same list faster-whisper ships; a test keeps them in sync).
WHISPER_LANGUAGES = ("af am ar as az ba be bg bn bo br bs ca cs cy da de el en es et eu fa fi fo fr gl gu ha haw he hi hr ht hu hy id is it ja jw ka kk km kn ko la lb ln lo lt lv mg mi mk ml mn mr ms mt my ne nl nn no oc pa pl ps pt ro ru sa sd si sk sl sn so sq sr su sv sw ta te tg th tk tl tr tt uk ur uz vi yi yo zh yue").split()


def models_dir() -> Path:
    d = Path(os.environ.get("ENGINE_MODELS_DIR", Path.home() / ".local-transcriber" / "models"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def use_offline_cache() -> None:
    os.environ["HF_HUB_CACHE"] = str(models_dir())


def _cached(repo: str) -> bool:
    snaps = models_dir() / ("models--" + repo.replace("/", "--")) / "snapshots"
    return snaps.is_dir() and any(any(d.iterdir()) for d in snaps.iterdir() if d.is_dir())


def _size(repo: str) -> int:
    d = models_dir() / ("models--" + repo.replace("/", "--"))
    return sum(f.stat().st_size for f in (d / "blobs").glob("*")) if (d / "blobs").exists() else 0


def mlx_available() -> bool:
    from .asr_mlx import available

    return available()


def parakeet_available() -> bool:
    from .asr_parakeet import available

    return available()


def _speech_repos() -> dict[str, str]:
    """Every speech model this computer can run: the Whisper sizes, plus Parakeet where it is installed."""
    return {**WHISPER_MODELS, **(PARAKEET_MODELS if parakeet_available() else {})}


def _llm_cached(name: str) -> bool:
    """The language model counts as downloaded when its weights file is in the models folder (a GGUF repo holds many sizes of the same model)."""
    from .llm import repo_for

    repo, fname = repo_for(name)
    snaps = models_dir() / ("models--" + repo.replace("/", "--")) / "snapshots"
    if not snaps.is_dir():
        return False
    return any((d / fname).exists() if fname else any(d.glob("*.safetensors")) for d in snaps.iterdir() if d.is_dir())


def llm_status() -> dict:
    """Whether the local language model can run here, which size is downloaded, and how big each download is."""
    from .llm import DEFAULT_LLM, LLM_MODELS, backend

    be = backend()
    if be is None:
        return {"available": False}
    have = {n: _llm_cached(n) for n in LLM_MODELS}
    row = lambda n, m: {"id": n, "label": m["label"], "like": m["like"], "languages": m["languages"], "license": m["license"]}  # noqa: E731
    catalog = [row(n, m) for n, m in LLM_MODELS.items() if m.get("kind") != "translate" and (have[n] or not m.get("retired"))]
    translation = [row(n, m) for n, m in LLM_MODELS.items() if m.get("kind") == "translate"]
    return {"available": True, "backend": be, "default": DEFAULT_LLM, "catalog": catalog, "translation": translation,
            "models": have, "bytes": {n: m["bytes"][be] for n, m in LLM_MODELS.items()}}


def status() -> dict:
    from .fit import table

    mlx = mlx_available()
    return {
        "fit": table(),
        "llm": llm_status(),
        "mlxAvailable": mlx,
        "mlx": {name: _cached(repo) for name, repo in MLX_MODELS.items()} if mlx else {},
        "mlxSizes": {n: _size(r) for n, r in MLX_MODELS.items()} if mlx else {},
        "dir": str(models_dir()),
        "sizes": {
            "whisper": {n: _size(r) for n, r in _speech_repos().items()},
            "diarization": sum(_size(r) for r in DIARIZATION_REPOS),
        },
        "whisper": {name: _cached(repo) for name, repo in _speech_repos().items()},
        "parakeetAvailable": parakeet_available(),
        "diarization": all(_cached(r) for r in DIARIZATION_REPOS),
    }


def _fetch(repo: str, token: str | None, label: str, allow_patterns: list[str] | None = None) -> None:
    """snapshot_download with real byte progress, measured from the files growing on disk."""
    import fnmatch
    import threading

    from huggingface_hub import HfApi, snapshot_download

    from .protocol import progress

    blobs = models_dir() / ("models--" + repo.replace("/", "--")) / "blobs"
    try:
        info = HfApi().model_info(repo, files_metadata=True, token=token)
        total = sum(f.size or 0 for f in info.siblings if not allow_patterns or any(fnmatch.fnmatch(f.rfilename, p) for p in allow_patterns))
    except Exception:  # noqa: BLE001 - progress is best-effort; the download itself reports real errors
        total = 0
    stop = threading.Event()

    def watch() -> None:
        while not stop.wait(0.4):
            done = sum(f.stat().st_size for f in blobs.glob("*")) if blobs.exists() else 0
            if total:
                progress("download", min(done / total, 0.99), label, done=done, total=total)
            else:
                progress("download", None, label, done=done)

    t = threading.Thread(target=watch, daemon=True)
    t.start()
    try:
        snapshot_download(repo, cache_dir=models_dir(), token=token, allow_patterns=allow_patterns)
    finally:
        stop.set()
        t.join()


def download_whisper(name: str) -> None:
    from .protocol import log

    if name in PARAKEET_MODELS and not parakeet_available():
        raise RuntimeError("Parakeet needs a Mac with an Apple chip.")
    repo = _speech_repos()[name]
    log(f"Downloading {repo} from huggingface.co into {models_dir()}")
    _fetch(repo, None, name)
    log(f"Finished {repo}. It is stored locally and works offline from now on.")


def download_diarization(token: str) -> None:
    from .protocol import log

    for repo in DIARIZATION_REPOS:
        log(f"Downloading {repo} (token {'provided' if token else 'MISSING'})")
        _fetch(repo, token or None, repo.split("/")[1])
        log(f"Finished {repo}")


def download_mlx(name: str) -> None:
    if not mlx_available():
        raise RuntimeError("The Apple GPU engine needs a Mac with an Apple chip.")
    if name not in MLX_MODELS:
        raise RuntimeError(f"Unknown model size: {name}")
    _fetch(MLX_MODELS[name], None, "mlx-" + name)


def download_llm(name: str) -> None:
    from .llm import LLM_MODELS, backend, patterns_for, repo_for
    from .protocol import log

    if backend() is None:
        raise RuntimeError("The local language model is not installed on this computer.")
    if name not in LLM_MODELS:
        raise RuntimeError(f"Unknown language model: {name}")
    repo, _f = repo_for(name)
    log(f"Downloading {repo} from huggingface.co into {models_dir()}")
    _fetch(repo, None, "llm-" + name, patterns_for(name))
    log(f"Finished {repo}. It is stored locally and works offline from now on.")


def delete(kind: str, name: str | None = None) -> None:
    import shutil

    if kind == "llm":
        from .llm import repo_for

        shutil.rmtree(models_dir() / ("models--" + repo_for(name)[0].replace("/", "--")), ignore_errors=True)
        return
    repos = [MLX_MODELS[name]] if kind == "mlx" else [{**WHISPER_MODELS, **PARAKEET_MODELS}[name]] if kind == "whisper" else DIARIZATION_REPOS
    for r in repos:
        shutil.rmtree(models_dir() / ("models--" + r.replace("/", "--")), ignore_errors=True)


def import_folder(src: Path) -> list[str]:
    """Copy models from a folder someone else downloaded (Hugging Face cache layout) into our models folder.
    Only repos this app knows about are copied; a repo counts only if it has a snapshot with files in it.
    Returns the repo ids that were imported."""
    import shutil

    src = Path(src)
    root = src if any(src.glob("models--*")) else src / "models"
    known = list(WHISPER_MODELS.values()) + list(PARAKEET_MODELS.values()) + DIARIZATION_REPOS
    done: list[str] = []
    for repo in known:
        d = root / ("models--" + repo.replace("/", "--"))
        snaps = d / "snapshots"
        if not snaps.is_dir() or not any(any(s.iterdir()) for s in snaps.iterdir() if s.is_dir()):
            continue
        shutil.copytree(d, models_dir() / d.name, symlinks=True, dirs_exist_ok=True)
        done.append(repo)
    if not done:
        raise RuntimeError("That folder has no models this app can use. Pick the folder that contains the “models--…” folders.")
    return done


def check_access(token: str) -> dict:
    """Online check of a Hugging Face token: is it valid, which kind is it, whose is it, and may it read each speaker-model repo
    (False means the terms on that model page have not been accepted yet). The username lets the app show the profile address
    the model pages ask for."""
    from huggingface_hub import HfApi

    api = HfApi()
    try:
        who = api.whoami(token=token)
    except Exception:
        return {"valid": False, "kind": None, "username": None, "repos": {}}
    kind = ((who.get("auth") or {}).get("accessToken") or {}).get("role")
    repos = {}
    for r in DIARIZATION_REPOS:
        try:
            api.auth_check(r, token=token)
            repos[r] = True
        except Exception:
            repos[r] = False
    return {"valid": True, "kind": kind, "username": who.get("name") or None, "repos": repos}
