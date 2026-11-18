"""Pinned model revisions and hash checks. No downloads: everything here uses local fixture files."""
import hashlib

import pytest


def test_every_repo_the_app_downloads_has_a_pinned_commit():
    import re

    from engine import llm, models

    repos = set(models.WHISPER_MODELS.values()) | set(models.MLX_MODELS.values()) | set(models.PARAKEET_MODELS.values()) | set(models.DIARIZATION_REPOS)
    for spec in llm.LLM_MODELS.values():
        repos |= {spec["mlx"], spec["gguf"][0]}
    assert repos <= set(models.PINS), sorted(repos - set(models.PINS))
    assert all(re.fullmatch(r"[0-9a-f]{40}", sha) for sha in models.PINS.values())
    assert all(re.fullmatch(r"[0-9a-f]{64}", h) for h in models.SHA256.values())


def test_download_passes_the_pinned_revision(tmp_path, monkeypatch):
    import huggingface_hub

    from engine import models

    monkeypatch.setenv("ENGINE_MODELS_DIR", str(tmp_path))
    seen = {}
    monkeypatch.setattr(huggingface_hub.HfApi, "model_info", lambda self, repo, **kw: seen.setdefault("info", kw) and type("I", (), {"siblings": []})())
    monkeypatch.setattr(huggingface_hub, "snapshot_download", lambda repo, **kw: seen.setdefault("dl", kw))
    models._fetch("Systran/faster-whisper-tiny", None, "tiny")
    assert seen["info"]["revision"] == seen["dl"]["revision"] == models.PINS["Systran/faster-whisper-tiny"]


def test_a_copy_at_another_commit_counts_as_not_downloaded_and_is_replaced(tmp_path, monkeypatch):
    import huggingface_hub

    from engine import models

    monkeypatch.setenv("ENGINE_MODELS_DIR", str(tmp_path))
    repo = "Systran/faster-whisper-tiny"
    old = tmp_path / "models--Systran--faster-whisper-tiny" / "snapshots" / "oldsha"
    old.mkdir(parents=True)
    (old / "model.bin").write_bytes(b"x")
    assert not models._cached(repo)
    monkeypatch.setattr(huggingface_hub.HfApi, "model_info", lambda self, *a, **k: type("I", (), {"siblings": []})())
    monkeypatch.setattr(huggingface_hub, "snapshot_download", lambda *a, **k: None)
    models._fetch(repo, None, "tiny")
    assert not old.exists()
    pinned = models.snapshot_dir(repo)
    pinned.mkdir(parents=True)
    (pinned / "model.bin").write_bytes(b"x")
    assert models._cached(repo)


def _diarization_fixture(tmp_path, monkeypatch, seg=b"segmentation weights", emb=b"embedding weights"):
    import yaml

    from engine import models

    monkeypatch.setenv("ENGINE_MODELS_DIR", str(tmp_path))
    monkeypatch.setattr(models, "SHA256", {"pyannote/segmentation-3.0/pytorch_model.bin": hashlib.sha256(b"segmentation weights").hexdigest(),
                                            "pyannote/wespeaker-voxceleb-resnet34-LM/pytorch_model.bin": hashlib.sha256(b"embedding weights").hexdigest()})
    for repo in models.DIARIZATION_REPOS:
        models.snapshot_dir(repo).mkdir(parents=True)
    (models.snapshot_dir("pyannote/segmentation-3.0") / "pytorch_model.bin").write_bytes(seg)
    (models.snapshot_dir("pyannote/wespeaker-voxceleb-resnet34-LM") / "pytorch_model.bin").write_bytes(emb)
    cfg = {"version": "3.1.0", "pipeline": {"name": "pyannote.audio.pipelines.SpeakerDiarization",
                                           "params": {"clustering": "AgglomerativeClustering", "embedding": "pyannote/wespeaker-voxceleb-resnet34-LM",
                                                      "segmentation": "pyannote/segmentation-3.0"}}}
    (models.snapshot_dir("pyannote/speaker-diarization-3.1") / "config.yaml").write_text(yaml.safe_dump(cfg))
    return models


def test_diarization_config_points_at_the_pinned_local_files(tmp_path, monkeypatch):
    import yaml

    models = _diarization_fixture(tmp_path, monkeypatch)
    out = yaml.safe_load(models.diarization_config().read_text())
    params = out["pipeline"]["params"]
    assert params["segmentation"] == str(models.snapshot_dir("pyannote/segmentation-3.0") / "pytorch_model.bin")
    assert params["embedding"] == str(models.snapshot_dir("pyannote/wespeaker-voxceleb-resnet34-LM") / "pytorch_model.bin")
    assert params["clustering"] == "AgglomerativeClustering"


@pytest.mark.parametrize("which", ["seg", "emb"])
def test_a_modified_checkpoint_is_refused(tmp_path, monkeypatch, which):
    models = _diarization_fixture(tmp_path, monkeypatch, **{which: b"tampered"})
    with pytest.raises(RuntimeError, match="The speaker model files have changed since they were checked. Delete and download them again."):
        models.diarization_config()
    assert not (tmp_path / "cassette-diarization.yaml").exists()


def test_diarization_config_needs_the_pinned_download(tmp_path, monkeypatch):
    from engine import models

    monkeypatch.setenv("ENGINE_MODELS_DIR", str(tmp_path))
    with pytest.raises(RuntimeError, match="not available"):
        models.diarization_config()
