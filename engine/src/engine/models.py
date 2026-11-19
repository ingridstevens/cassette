"""Model locations + downloads. All models live under ENGINE_MODELS_DIR; runtime is offline."""
import os
import sys
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
# Every repo the app downloads, pinned to one commit. Nothing is fetched or loaded from "main". Update a pin deliberately, in a reviewed PR:
# get the new commit from the model page or the HfApi model-info call, read the changes between the two commits on huggingface.co, and for the two
# pyannote .bin files (they are pickles, which can run code when loaded) copy the new sha256 from the file's page into SHA256 below.
# These were read from the Hugging Face API on 18 Nov 2026 (the commit each repo's main pointed to that day).
PINS: dict[str, str] = {
    "Systran/faster-whisper-tiny": "d90ca5fe260221311c53c58e660288d3deb8d356",
    "Systran/faster-whisper-base": "ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66",
    "Systran/faster-whisper-small": "536b0662742c02347bc0e980a01041f333bce120",
    "Systran/faster-whisper-medium": "08e178d48790749d25932bbc082711ddcfdfbc4f",
    "Systran/faster-whisper-large-v3": "edaa852ec7e145841d8ffdb056a99866b5f0a478",
    "mobiuslabsgmbh/faster-whisper-large-v3-turbo": "0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf",
    "mlx-community/whisper-tiny-mlx": "6caf9c55601caafbe6508a8b0d216bdf4783c4e8",
    "mlx-community/whisper-base-mlx": "1e3e249fb8d01c655324bd6841b1deadffd6d04c",
    "mlx-community/whisper-small-mlx": "45f3915923c7a79a5a5b5a7d909d39aeb0e5630e",
    "mlx-community/whisper-medium-mlx": "7fc08c4eac4c316526498f147dfdee6f6303f975",
    "mlx-community/whisper-large-v3-turbo": "a4aaeec0636e6fef84abdcbe3544cb2bf7e9f6fb",
    "mlx-community/whisper-large-v3-mlx": "49e6aa286ad60c14352c404340ded53710378a11",
    "mlx-community/parakeet-tdt-0.6b-v3": "ed2b7e8c15f9aaa0b5772e2efb986255eaef7e15",
    "pyannote/speaker-diarization-3.1": "84fd25912480287da0247647c3d2b4853cb3ee5d",
    "pyannote/segmentation-3.0": "e66f3d3b9eb0873085418a7b813d3b369bf160bb",
    "pyannote/wespeaker-voxceleb-resnet34-LM": "837717ddb9ff5507820346191109dc79c958d614",
    "Qwen/Qwen2.5-1.5B-Instruct-GGUF": "91cad51170dc346986eccefdc2dd33a9da36ead9",
    "bartowski/Qwen2.5-7B-Instruct-GGUF": "8911e8a47f92bac19d6f5c64a2e2095bd2f7d031",
    "tencent/Hy-MT2-1.8B-GGUF": "a0c709d9fac510f2c807aa3af52872340dc37a4a",
    "unsloth/Qwen3-1.7B-GGUF": "d7f544eead698dbd1f15126ef60b45a1e1933222",
    "unsloth/Qwen3-4B-Instruct-2507-GGUF": "a06e946bb6b655725eafa393f4a9745d460374c9",
    "unsloth/gemma-3-4b-it-GGUF": "5a3566e716d80f709ed7b79817eaf7733d2a1fce",
    "mlx-community/Hy-MT2-1.8B-4bit": "e5c6fe56c7b3bc77fae5ae92db31f2178f1e6912",
    "mlx-community/Qwen2.5-1.5B-Instruct-4bit": "8b403126fc14f14cfc99bb4cfa72ecbc129ea677",
    "mlx-community/Qwen2.5-7B-Instruct-4bit": "c26a38f6a37d0a51b4e9a1eb3026530fa35d9fed",
    "mlx-community/Qwen3-1.7B-4bit": "3b1b1768f8f8cf8351c712464f906e86c2b8269e",
    "mlx-community/Qwen3-4B-Instruct-2507-4bit": "50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b",
    "mlx-community/gemma-3-text-4b-it-4bit": "4f665a4c50ecfe4ecdc34056ab52fe3e3c4abf9e",
}
# The speaker-model checkpoints are PyTorch pickles; loading one can run code. They are checked against these hashes before they are loaded.
# The values are the LFS sha256 Hugging Face lists for each file at the pinned commit.
SHA256: dict[str, str] = {
    "pyannote/segmentation-3.0/pytorch_model.bin": "da85c29829d4002daedd676e012936488234d9255e65e86dfab9bec6b1729298",
    "pyannote/wespeaker-voxceleb-resnet34-LM/pytorch_model.bin": "366edf44f4c80889a3eb7a9d7bdf02c4aede3127f7dd15e274dcdb826b143c56",
}
CHANGED_MODEL_FILES = "The speaker model files have changed since they were checked. Delete and download them again."
LANGUAGES = ["de", "en", "fr", "es"]  # the four the app is tuned and tested for; pinned first in the picker
# Every language code Whisper understands (the same list faster-whisper ships; a test keeps them in sync).
WHISPER_LANGUAGES = ("af am ar as az ba be bg bn bo br bs ca cs cy da de el en es et eu fa fi fo fr gl gu ha haw he hi hr ht hu hy id is it ja jw ka kk km kn ko la lb ln lo lt lv mg mi mk ml mn mr ms mt my ne nl nn no oc pa pl ps pt ro ru sa sd si sk sl sn so sq sr su sv sw ta te tg th tk tl tr tt uk ur uz vi yi yo zh yue").split()


def _default_models_dir() -> Path:
    new = Path.home() / ".cassette" / "models"
    old = Path.home() / ".local-transcriber" / "models"  # the app's earlier name; keep reading it if it exists
    return old if old.is_dir() and not new.exists() else new


def models_dir() -> Path:
    d = Path(os.environ.get("ENGINE_MODELS_DIR") or _default_models_dir())
    d.mkdir(parents=True, exist_ok=True)
    return d


def use_offline_cache() -> None:
    os.environ["HF_HUB_CACHE"] = str(models_dir())


def snapshot_dir(repo: str) -> Path:
    """Where the pinned commit of a repo lives in the models folder (it may not be downloaded)."""
    return models_dir() / ("models--" + repo.replace("/", "--")) / "snapshots" / PINS[repo]


def _cached(repo: str) -> bool:
    """Downloaded means the pinned commit is here. A copy at some other commit (an older install) counts as not downloaded, so it is fetched again."""
    snap = snapshot_dir(repo)
    return snap.is_dir() and any(snap.iterdir())


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


def moonshine_catalog() -> dict:
    from .asr_moonshine import catalog

    return catalog()


def _llm_cached(name: str) -> bool:
    """The language model counts as downloaded when its weights file is in the models folder (a GGUF repo holds many sizes of the same model)."""
    from .llm import repo_for

    repo, fname = repo_for(name)
    d = snapshot_dir(repo)
    return d.is_dir() and ((d / fname).exists() if fname else any(d.glob("*.safetensors")))


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


def _moonshine_cached(model_id: str) -> bool:
    from .asr_moonshine import cached

    return cached(model_id)


def moonshine_sizes() -> dict[str, int]:
    from .asr_moonshine import size_on_disk

    return {n: size_on_disk(n) for n in moonshine_catalog() if _moonshine_cached(n)}


def moonshine_status() -> dict:
    """The Moonshine models this computer can run, with sizes. They come from Moonshine's own server, not Hugging Face."""
    from .asr_moonshine import SOURCE

    cat = moonshine_catalog()
    return {"available": bool(cat), "source": SOURCE, "license": "MIT",
            "catalog": [{"id": n, "language": s["language"], "name": s["name"], "bytes": s["bytes"]} for n, s in cat.items()]}


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
        "moonshine": moonshine_status(),
        "sizes": {
            "whisper": {**{n: _size(r) for n, r in _speech_repos().items()}, **moonshine_sizes()},
            "diarization": sum(_size(r) for r in DIARIZATION_REPOS),
        },
        "whisper": {**{name: _cached(repo) for name, repo in _speech_repos().items()}, **{n: True for n in moonshine_catalog() if _moonshine_cached(n)}},
        "parakeetAvailable": parakeet_available(),
        "diarization": all(_cached(r) for r in DIARIZATION_REPOS),
    }


def _fetch(repo: str, token: str | None, label: str, allow_patterns: list[str] | None = None) -> None:
    """snapshot_download with real byte progress, measured from the files growing on disk."""
    import fnmatch
    import shutil
    import threading

    from huggingface_hub import HfApi, snapshot_download

    from .protocol import progress

    blobs = models_dir() / ("models--" + repo.replace("/", "--")) / "blobs"
    snaps = blobs.parent / "snapshots"
    if snaps.is_dir() and any(snaps.iterdir()) and not snapshot_dir(repo).exists():
        shutil.rmtree(blobs.parent, ignore_errors=True)  # an older install at another commit: replace it with the pinned one
    try:
        info = HfApi().model_info(repo, revision=PINS[repo], files_metadata=True, token=token)
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
        snapshot_download(repo, revision=PINS[repo], cache_dir=models_dir(), token=token, allow_patterns=allow_patterns)
    finally:
        stop.set()
        t.join()


def _sha256(path: Path) -> str:
    import hashlib

    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# What "verified" can mean offline. The Hugging Face cache names every file after its checksum: a SHA-256 for large files (LFS) and a git SHA-1 for
# small ones. So each file can be re-hashed and compared with its own name, with no network. Two files have a second, stronger check: the
# SHA-256 pinned in this app (SHA256 above). Nothing here proves the files are what the model's authors published; it finds damaged,
# cut-short and swapped files, and installs of another version.
_HEX = {64: "sha256", 40: "sha1"}


def _git_sha1(path: Path) -> str:
    import hashlib

    h = hashlib.sha1(b"blob %d\0" % path.stat().st_size)  # noqa: S324 - git's own object name, used only to compare with the cache's file name
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _verify_repo(repo: str, patterns: list[str] | None = None) -> dict:
    """Check one repo against its pinned commit and its recorded checksums, locally. Returns
    {"state": "ok" | "damaged" | "other_version" | "missing", "how": "pinned" | "recorded" | "present", "bad": [snapshot paths to repair]}.
    how: "pinned" = at least one file was also compared with a SHA-256 built into this app; "recorded" = every file matched the checksum in its
    cache file name; "present" = some file had no checksum to compare with, so only its presence was checked."""
    import fnmatch
    import os

    folder = models_dir() / ("models--" + repo.replace("/", "--"))
    if not folder.exists():
        return {"state": "missing", "how": "present", "bad": []}
    snap = snapshot_dir(repo)
    if not (snap.is_dir() and any(snap.iterdir())):
        return {"state": "other_version", "how": "present", "bad": []}
    bad: list[str] = []
    files = 0
    pinned = False
    unchecked = False
    for root, _dirs, names in os.walk(snap):
        for n in names:
            p = Path(root) / n
            rel = p.relative_to(snap).as_posix()
            if patterns and not any(fnmatch.fnmatch(rel, g) for g in patterns):
                continue
            files += 1
            try:
                if not p.exists():  # a link whose file is gone
                    bad.append(str(p))
                    continue
                want = p.resolve().name  # the cache stores the file under its checksum
                kind = _HEX.get(len(want)) if all(c in "0123456789abcdef" for c in want) else None
                got = _sha256(p) if kind == "sha256" else _git_sha1(p) if kind == "sha1" else None
                if kind is None:
                    unchecked = True
                elif got != want:
                    bad.append(str(p))
                    continue
                if f"{repo}/{rel}" in SHA256:
                    pinned = True
                    if (got if kind == "sha256" else _sha256(p)) != SHA256[f"{repo}/{rel}"]:
                        bad.append(str(p))
            except OSError:
                bad.append(str(p))
    if patterns and files == 0:  # the file this model needs is not in the pinned snapshot
        return {"state": "damaged", "how": "present", "bad": []}
    return {"state": "damaged" if bad else "ok", "how": "pinned" if pinned else "present" if unchecked else "recorded", "bad": bad}


def _model_repos(name: str) -> list[tuple[str, list[str] | None]] | None:
    """The repos (and file patterns) behind a model name as the app knows it; None for models that do not come from Hugging Face (Moonshine)."""
    if name == "diarization":
        return [(r, None) for r in DIARIZATION_REPOS]
    if name.startswith("mlx-") and name[4:] in MLX_MODELS:
        return [(MLX_MODELS[name[4:]], None)]
    if name.startswith("llm-"):
        from .llm import LLM_MODELS, backend, patterns_for, repo_for

        if name[4:] not in LLM_MODELS or backend() is None:
            return None
        return [(repo_for(name[4:])[0], patterns_for(name[4:]))]
    both = {**WHISPER_MODELS, **PARAKEET_MODELS}
    return [(both[name], None)] if name in both else None


def verify_names() -> list[str]:
    from .llm import LLM_MODELS, backend

    return [*WHISPER_MODELS, *PARAKEET_MODELS, *("mlx-" + n for n in MLX_MODELS), "diarization", *(("llm-" + n for n in LLM_MODELS) if backend() else ())]


def verify(name: str | None = None) -> list[dict]:
    """Check downloaded models without the network. One row per model: {"id", "state", "how"}; state is ok, damaged, other_version or missing.
    Progress events say which model is being read, since hashing a large model takes a while."""
    from .protocol import progress

    names = [name] if name else verify_names()
    rows = []
    for i, n in enumerate(names):
        repos = _model_repos(n)
        if repos is None:
            continue
        progress("verify", i / len(names), n)
        results = [_verify_repo(r, g) for r, g in repos]
        order = ["damaged", "other_version", "missing", "ok"]
        state = min((r["state"] for r in results), key=order.index)
        if state == "missing" and any(r["state"] != "missing" for r in results):
            state = "damaged"  # some speaker repos are there and some are not
        how = "pinned" if any(r["how"] == "pinned" for r in results) else "present" if any(r["how"] == "present" for r in results) else "recorded"
        rows.append({"id": n, "state": state, "how": how})
    return rows


def remove_damaged(name: str) -> None:
    """The first step of a repair: remove only the files that failed the check (the link in the pinned snapshot and the file it points to), so the
    download that follows fetches them again. Nothing else in the models folder is touched."""
    for repo, patterns in _model_repos(name) or []:
        res = _verify_repo(repo, patterns)
        blobs = (models_dir() / ("models--" + repo.replace("/", "--")) / "blobs").resolve()
        for s in res["bad"]:
            p = Path(s)
            target = p.resolve()
            p.unlink(missing_ok=True)
            if target != p and target.parent == blobs:
                target.unlink(missing_ok=True)


def diarization_config() -> Path:
    """Check the speaker-model checkpoints against SHA256, then write a pipeline config that points at the pinned local files, so
    pyannote never looks a model up by name (which would mean "main"). Raises RuntimeError if a file is missing or has changed."""
    import yaml

    snap = {r: snapshot_dir(r) for r in DIARIZATION_REPOS}
    files = {"pyannote/segmentation-3.0": snap["pyannote/segmentation-3.0"] / "pytorch_model.bin",
             "pyannote/wespeaker-voxceleb-resnet34-LM": snap["pyannote/wespeaker-voxceleb-resnet34-LM"] / "pytorch_model.bin"}
    for repo, path in files.items():
        if not path.is_file():
            raise RuntimeError("Speaker model not available. Download it in Settings (needs Hugging Face token).")
        if _sha256(path) != SHA256[f"{repo}/pytorch_model.bin"]:
            raise RuntimeError(CHANGED_MODEL_FILES)
    cfg_path = snap["pyannote/speaker-diarization-3.1"] / "config.yaml"
    if not cfg_path.is_file():
        raise RuntimeError("Speaker model not available. Download it in Settings (needs Hugging Face token).")
    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    cfg["pipeline"]["params"]["segmentation"] = str(files["pyannote/segmentation-3.0"])
    cfg["pipeline"]["params"]["embedding"] = str(files["pyannote/wespeaker-voxceleb-resnet34-LM"])
    out = models_dir() / "cassette-diarization.yaml"
    out.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    return out


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

    if kind == "moonshine":
        from .asr_moonshine import delete as delete_moonshine

        return delete_moonshine(name)

    if kind == "llm":
        from .llm import repo_for

        shutil.rmtree(models_dir() / ("models--" + repo_for(name)[0].replace("/", "--")), ignore_errors=True)
        return
    repos = [MLX_MODELS[name]] if kind == "mlx" else [{**WHISPER_MODELS, **PARAKEET_MODELS}[name]] if kind == "whisper" else DIARIZATION_REPOS
    for r in repos:
        shutil.rmtree(models_dir() / ("models--" + r.replace("/", "--")), ignore_errors=True)


def _models_root(src: Path) -> Path:
    src = Path(src)
    return src if any(src.glob("models--*")) else src / "models"


def scan_folder(src: Path) -> dict[str, str]:
    """For every repo this app knows: "ready" (a snapshot with files), "incomplete" (the folder is there but empty or has no snapshot of the pinned
    version, for example a copy that stopped halfway, a sync tool that cut it short, or models downloaded at another version) or "missing" (not in the folder at all)."""
    root = _models_root(src)
    out: dict[str, str] = {}
    for repo in list(WHISPER_MODELS.values()) + list(PARAKEET_MODELS.values()) + DIARIZATION_REPOS:
        d = root / ("models--" + repo.replace("/", "--"))
        if not d.exists():
            out[repo] = "missing"
            continue
        snap = d / "snapshots" / PINS[repo]  # only the pinned commit counts; a copy at another commit would not be used
        ok = snap.is_dir() and any(snap.iterdir())
        out[repo] = "ready" if ok else "incomplete"
    return out


def folder_report(scan: dict[str, str]) -> list[dict]:
    """What the app shows after choosing a models folder, one row per model the user can recognise (the three speaker repos count as one):
    {"id": "small" | "parakeet-v3" | "diarization", "state": "imported" | "incomplete" | "missing"}."""
    rows = []
    for name, repo in {**WHISPER_MODELS, **PARAKEET_MODELS}.items():
        rows.append({"id": name, "state": {"ready": "imported", "incomplete": "incomplete", "missing": "missing"}[scan[repo]]})
    states = [scan[r] for r in DIARIZATION_REPOS]
    rows.append({"id": "diarization", "state": "imported" if all(x == "ready" for x in states) else "missing" if all(x == "missing" for x in states) else "incomplete"})
    return rows


def import_folder(src: Path) -> list[str]:
    """Copy models from a folder someone else downloaded (Hugging Face cache layout) into our models folder.
    Only repos this app knows about are copied; a repo counts only if it has a snapshot of the pinned version with files in it.
    Returns the repo ids that were imported."""
    import shutil

    root = _models_root(src)
    scan = scan_folder(src)
    done: list[str] = []
    for repo, state in scan.items():
        if state != "ready":
            continue
        d = root / ("models--" + repo.replace("/", "--"))
        # Keep the cache's symlinks (one copy of each blob) except on Windows, where creating them needs a privilege most accounts lack.
        shutil.copytree(d, models_dir() / d.name, symlinks=sys.platform != "win32", dirs_exist_ok=True)
        done.append(repo)
    if not done:
        if any(v == "incomplete" for v in scan.values()):
            raise RuntimeError("The models in that folder look incomplete (a copy that stopped halfway?). Ask whoever shared it to copy the whole folder again.")
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
