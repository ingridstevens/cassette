## What and why

<!-- One or two sentences. Link the issue: "Fixes #123". -->

## How it was checked

- [ ] `npm run typecheck` and `npm run i18n:check` (in `app/`)
- [ ] `uv run pytest -q` (in `engine/`) if the engine changed
- [ ] Looked at it in the running app (screenshot for visual changes)
- [ ] New or changed UI text is in the dictionaries (de, fr, es, ar, fa)
- [ ] Nothing new talks to the network (see `engine/tests/test_network_surface.py`)
