"""Lint gate: `ruff check` must pass. CI runs `uv run pytest`, so this is how the engine lint fails the build."""
import subprocess
import sys
from pathlib import Path


def test_ruff_check_is_clean():
    root = Path(__file__).resolve().parent.parent
    r = subprocess.run([sys.executable, "-m", "ruff", "check", "."], cwd=root, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
