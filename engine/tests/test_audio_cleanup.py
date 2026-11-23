"""Audio cleanup: the ffmpeg filter chain is built by pure functions, and only touches the decoded temporary copy."""
import wave
from pathlib import Path

import numpy as np
import pytest

from engine.audio import cleanup_filter, decode_command, estimate_cleanup, level_stats


def test_off_adds_no_filter():
    assert cleanup_filter(None) is None
    assert cleanup_filter("off") is None
    assert "-af" not in decode_command("in.m4a", Path("out.wav"))
    assert "-af" not in decode_command("in.m4a", Path("out.wav"), cleanup="off")


def test_level_uses_loudnorm_only():
    assert cleanup_filter("level") == "loudnorm=I=-16:TP=-1.5:LRA=11"


def test_denoise_cuts_rumble_then_reduces_noise():
    assert cleanup_filter("denoise") == "highpass=f=80,afftdn=nr=12:nf=-40"


def test_both_denoises_before_levelling():
    chain = cleanup_filter("both")
    assert chain.split(",")[:2] == ["highpass=f=80", "afftdn=nr=12:nf=-40"]
    assert chain.endswith("loudnorm=I=-16:TP=-1.5:LRA=11")


def test_unknown_mode_is_refused():
    with pytest.raises(ValueError):
        cleanup_filter("afftdn=nr=99")


def test_command_reads_the_original_and_writes_only_the_temporary_copy():
    cmd = decode_command("/rec/in.m4a", Path("/tmp/x/audio.wav"), 5.0, 20.0, "both")
    assert cmd[cmd.index("-i") + 1] == "/rec/in.m4a"
    assert cmd[-1] == str(Path("/tmp/x/audio.wav"))
    assert cmd[cmd.index("-af") + 1] == cleanup_filter("both")
    assert cmd.index("-af") > cmd.index("-i")  # an output filter, applied after the input is opened
    assert cmd.count("/rec/in.m4a") == 1


# --- before/after estimate ---

def test_level_stats_separates_speech_from_background():
    sr = 16000
    rng = np.random.default_rng(0)
    quiet = rng.normal(0, 0.003, sr * 5)
    loud = rng.normal(0, 0.1, sr * 5)
    s = level_stats(np.concatenate([quiet, loud]).astype(np.float32), sr)
    assert s["speech_db"] > s["noise_floor_db"] + 20
    assert s["gap_db"] == pytest.approx(s["speech_db"] - s["noise_floor_db"], abs=0.11)


def test_level_stats_too_short_is_none():
    assert level_stats(np.zeros(100, dtype=np.float32), 16000) is None


def test_estimate_refuses_off_and_unknown_modes():
    for mode in (None, "off", "afftdn=nr=99"):
        with pytest.raises(ValueError):
            estimate_cleanup("in.wav", mode)


def test_estimate_runs_on_a_temporary_copy_and_leaves_the_original(tmp_path):
    pytest.importorskip("imageio_ffmpeg")
    sr = 16000
    t = np.arange(sr * 6) / sr
    tone = np.where((t % 2) < 1, 0.02 * np.sin(2 * np.pi * 220 * t), 0.0)  # quiet "speech" in bursts
    sig = tone + np.random.default_rng(1).normal(0, 0.002, len(t))
    src = tmp_path / "in.wav"
    with wave.open(str(src), "wb") as f:
        f.setnchannels(1), f.setsampwidth(2), f.setframerate(sr)
        f.writeframes((np.clip(sig, -1, 1) * 32767).astype("<i2").tobytes())
    before_bytes = src.read_bytes()
    r = estimate_cleanup(str(src), "level")
    assert r["before"] and r["after"] and r["seconds"] > 5
    assert r["after"]["speech_db"] > r["before"]["speech_db"]  # evening out the volume raises a quiet recording
    assert src.read_bytes() == before_bytes
