import multiprocessing
import sys

from .main import main

if __name__ == "__main__":
    # The app reads stdout as UTF-8 JSON lines. Windows pipes default to the legacy code page, which garbles or rejects non-Latin text.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    # A PyInstaller build on Windows starts worker processes by re-running engine.exe; without this each one would run the CLI again.
    multiprocessing.freeze_support()
    main()
