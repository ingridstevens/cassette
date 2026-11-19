"""Audio cleanup: the ffmpeg filter chain is built by pure functions, and only touches the decoded temporary copy."""
from pathlib import Path

import pytest

from engine.audio import cleanup_filter, decode_command


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
    assert cmd[-1] == "/tmp/x/audio.wav"
    assert cmd[cmd.index("-af") + 1] == cleanup_filter("both")
    assert cmd.index("-af") > cmd.index("-i")  # an output filter, applied after the input is opened
    assert cmd.count("/rec/in.m4a") == 1
