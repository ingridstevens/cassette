"""The engine stops by itself when the app that started it is gone (issue #63)."""
import os

import pytest

from engine import main as engine_main


class _Exited(Exception):
    pass


def test_exits_when_reparented(monkeypatch):
    parents = iter([100, 100, 1])  # first call records the parent, then it changes
    monkeypatch.setattr(os, "getppid", lambda: next(parents))
    monkeypatch.setattr(engine_main.time, "sleep", lambda _s: None)

    def fake_exit(code):
        raise _Exited(code)

    monkeypatch.setattr(os, "_exit", fake_exit)
    with pytest.raises(_Exited) as info:
        engine_main._exit_with_parent()
    assert info.value.args == (1,)
