"""The `peaks` command: a waveform and the duration, computed from a streamed ffmpeg decode."""
import json
import wave

import numpy as np
import pytest

from engine import main as m
from engine.audio import peaks


def _wav(path, seconds, rate=16000, loud_at=None):
    x = np.zeros(int(seconds * rate), dtype=np.int16)
    if loud_at is not None:
        i = int(loud_at * rate)
        x[i: i + rate // 10] = 16384  # 0.1 s at half scale
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes(x.tobytes())


def test_peaks_find_the_loud_part_and_the_duration(tmp_path):
    src = tmp_path / "a.wav"
    _wav(src, 10.0, loud_at=5.0)
    values, duration = peaks(str(src), 100)
    assert duration == pytest.approx(10.0, abs=0.05)
    assert len(values) == 100
    assert all(0.0 <= v <= 1.0 for v in values)
    assert max(values) == pytest.approx(0.5, abs=0.08)
    assert values.index(max(values)) in (49, 50)  # 5 s of 10 s
    assert values[0] == 0.0


def test_fewer_points_than_asked_for_a_very_short_file(tmp_path):
    src = tmp_path / "s.wav"
    _wav(src, 0.5)
    values, duration = peaks(str(src), 8000)
    assert 0 < len(values) <= 8000 and duration == pytest.approx(0.5, abs=0.05)


def test_unreadable_file_is_an_error(tmp_path):
    src = tmp_path / "bad.wav"
    src.write_bytes(b"not audio")
    with pytest.raises(RuntimeError):
        peaks(str(src), 100)


def test_command_emits_done_with_peaks_and_duration(tmp_path, capsys):
    src = tmp_path / "c.wav"
    _wav(src, 3.0, loud_at=1.0)
    a = m.build_parser().parse_args(["peaks", str(src), "--points", "200"])
    a.fn(a)
    event = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert event["type"] == "done" and len(event["peaks"]) == 200 and event["duration"] == pytest.approx(3.0, abs=0.05)


def test_points_are_limited():
    for bad in ("0", "99", "20001", "x"):
        with pytest.raises(SystemExit):
            m.build_parser().parse_args(["peaks", "x.wav", "--points", bad])
