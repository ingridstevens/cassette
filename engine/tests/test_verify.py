"""Verify and repair: local fixture folders in the Hugging Face cache layout, no network."""
import hashlib

import pytest

REPO = "Systran/faster-whisper-tiny"


def _put(tmp_path, repo, files: dict[str, bytes], lfs=("model.bin",)):
    """Write files the way huggingface_hub does: blobs named by checksum, snapshot entries linking to them."""
    from engine import models

    snap = models.snapshot_dir(repo)
    blobs = snap.parents[1] / "blobs"
    blobs.mkdir(parents=True, exist_ok=True)
    for rel, data in files.items():
        name = hashlib.sha256(data).hexdigest() if rel in lfs else hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()
        (blobs / name).write_bytes(data)
        (snap / rel).parent.mkdir(parents=True, exist_ok=True)
        (snap / rel).symlink_to(blobs / name)
    return snap


@pytest.fixture(autouse=True)
def folder(tmp_path, monkeypatch):
    monkeypatch.setenv("ENGINE_MODELS_DIR", str(tmp_path))
    from engine import protocol

    monkeypatch.setattr(protocol, "progress", lambda *a, **k: None)
    return tmp_path


def _row(name):
    from engine import models

    return models.verify(name)[0]


def test_intact_missing_and_other_version(folder):
    _put(folder, REPO, {"model.bin": b"weights", "config.json": b"{}"})
    assert _row("tiny") == {"id": "tiny", "state": "ok", "how": "recorded"}
    assert _row("base")["state"] == "missing"
    old = folder / "models--Systran--faster-whisper-base" / "snapshots" / "oldsha"
    old.mkdir(parents=True)
    (old / "model.bin").write_bytes(b"x")
    assert _row("base")["state"] == "other_version"


def test_a_changed_or_cut_short_file_is_damaged(folder):
    snap = _put(folder, REPO, {"model.bin": b"weights", "config.json": b"{}"})
    (snap / "model.bin").resolve().write_bytes(b"weight")  # one byte short
    assert _row("tiny")["state"] == "damaged"


def test_a_small_git_file_is_checked_too_and_a_dangling_link_is_damaged(folder):
    snap = _put(folder, REPO, {"model.bin": b"weights", "config.json": b"{}"})
    (snap / "config.json").resolve().write_bytes(b"{ }")
    assert _row("tiny")["state"] == "damaged"
    (snap / "config.json").resolve().unlink()
    assert _row("tiny")["state"] == "damaged"


def test_the_speaker_checkpoints_are_also_compared_with_the_pinned_sha256(folder, monkeypatch):
    from engine import models

    pipe, seg, wes = models.DIARIZATION_REPOS
    _put(folder, pipe, {"config.yaml": b"a: 1"})
    _put(folder, seg, {"pytorch_model.bin": b"ckpt"}, lfs=("pytorch_model.bin",))
    _put(folder, wes, {"pytorch_model.bin": b"ckpt2"}, lfs=("pytorch_model.bin",))
    # The file's name matches its content, but not the hash this app pins: a consistent cache cannot hide a swapped checkpoint.
    assert _row("diarization")["state"] == "damaged"
    monkeypatch.setitem(models.SHA256, f"{seg}/pytorch_model.bin", hashlib.sha256(b"ckpt").hexdigest())
    monkeypatch.setitem(models.SHA256, f"{wes}/pytorch_model.bin", hashlib.sha256(b"ckpt2").hexdigest())
    assert _row("diarization") == {"id": "diarization", "state": "ok", "how": "pinned"}


def test_repair_removes_only_the_damaged_file_then_downloads_the_pinned_version(folder, monkeypatch):
    from engine import models

    snap = _put(folder, REPO, {"model.bin": b"weights", "config.json": b"{}"})
    other = _put(folder, "Systran/faster-whisper-base", {"model.bin": b"base"})
    (snap / "model.bin").resolve().write_bytes(b"broken")
    models.remove_damaged("tiny")
    assert not (snap / "model.bin").exists() and not (snap / "model.bin").is_symlink()
    assert (snap / "config.json").exists()  # the intact file stays
    assert (other / "model.bin").read_bytes() == b"base"  # other models are never touched
    assert len(list((snap.parents[1] / "blobs").iterdir())) == 1
    seen = {}
    import huggingface_hub

    monkeypatch.setattr(huggingface_hub.HfApi, "model_info", lambda self, *a, **k: type("I", (), {"siblings": []})())
    monkeypatch.setattr(huggingface_hub, "snapshot_download", lambda repo, **kw: seen.update(kw))
    models.download_whisper("tiny")
    assert seen["revision"] == models.PINS[REPO]


def test_repair_leaves_a_healthy_model_alone(folder):
    from engine import models

    snap = _put(folder, REPO, {"model.bin": b"weights"})
    models.remove_damaged("tiny")
    assert (snap / "model.bin").read_bytes() == b"weights"


def test_language_model_checks_only_its_own_file(folder, monkeypatch):
    from engine import llm, models

    monkeypatch.setattr(llm, "backend", lambda: "gguf")
    repo, fname = llm.repo_for("qwen3-4b", "gguf")
    _put(folder, repo, {fname: b"gguf", "Other-Q8_0.gguf": b"other"}, lfs=(fname, "Other-Q8_0.gguf"))
    (models.snapshot_dir(repo) / "Other-Q8_0.gguf").resolve().write_bytes(b"damaged but not ours")
    assert _row("llm-qwen3-4b")["state"] == "ok"
