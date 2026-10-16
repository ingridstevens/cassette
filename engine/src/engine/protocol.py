"""JSON-lines protocol: one event per stdout line. stdout is reserved for events only."""
import json
import sys


def emit(type_: str, **fields) -> None:
    sys.stdout.write(json.dumps({"type": type_, **fields}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def progress(stage: str, fraction: float | None = None, message: str = "", **extra) -> None:
    """`extra` carries raw numbers (e.g. done/total bytes) so the app can format them for the user's operating system."""
    emit("progress", stage=stage, fraction=fraction, message=message, **extra)


def log(message: str, level: str = "info") -> None:
    emit("log", level=level, message=message)


def partial(segments: list[dict]) -> None:
    """Lines that were just written down, before the run is finished, so the app can show the transcript growing.
    Speakers are known here (speaker detection runs first). The final `done` event replaces all of them."""
    emit("partial", segments=segments)
