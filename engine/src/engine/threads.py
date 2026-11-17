"""How many processor threads the engine may use, so a weak computer stays usable while it works."""
import os


def thread_budget(cores: int | None = None) -> int:
    """Threads for speech and speaker models: every core on a small computer up to 4, then all but one (the app and Windows keep a core).

    On 8 or more cores the extra threads give little, so the count is capped at 8: more threads only add memory and heat.
    """
    n = cores if cores is not None else (os.cpu_count() or 2)
    if n <= 4:
        return max(1, n)
    return min(8, n - 1)
