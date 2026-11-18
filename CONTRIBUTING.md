# Contributing

Contributions are welcome. By contributing you agree that your work is released under the same
[Unlicense](LICENSE) (public domain) as the project, and that you have the right to do so.

## Dev setup

```bash
cd engine && uv sync          # Python engine (Python 3.10-3.12)
cd app && npm i               # Electron + React
cd app && npm run dev         # Vite + Electron; needs `uv` on PATH
```

## Layout

- `app/src/` React UI; `app/electron/` main process (`main.ts`), preload bridge, engine client.
- `engine/src/engine/` Python engine: `asr.py` (faster-whisper), `diarize.py` (pyannote), `merge.py`,
  `export.py` (all export formats), `models.py` (downloads), `protocol.py`.
- `docs/screenshots/` images used by the README.

## Tests and build

```bash
cd engine && uv run pytest -q
cd app && npx tsc --noEmit && npm run build
cd app && npm run e2e         # Playwright in Chromium against the dev mock (downloads the browser on first run)
```

The end-to-end tests live in `app/e2e/`, a workspace of its own (like `app/lint/`), so the browser tooling stays out
of the app's installs. They use role and label selectors against `src/dev-mock.ts`; add a flow there when you add one.

## Engine protocol

1. The main process spawns the engine CLI (`python -m engine <command> ...`).
2. The engine writes one JSON object per line to stdout; stdout is reserved for events.
3. Every event has a `type`: `progress` (stage, fraction, message), `log` (level, message), `error`, plus result events.
4. Anything else (library noise, tracebacks) goes to stderr.
5. Cancelling a job kills the process; the engine holds no state between runs.
6. Add new event types in `protocol.py` and handle them in `electron/engine-client.ts`.

## Personas

Ten simulated users in [`docs/personas/`](docs/personas/README.md) vote on proposed features and test the app
(`/persona-vote` in Claude Code). Before a larger change, run a vote or check their veto conditions; see
[Testing with personas](docs/testing.md).

## Style

- System fonts only: no web fonts, no CDNs, no remote URLs in HTML/CSS/JS (the production CSP blocks them).
- Accessibility: use real controls (`button`, `input`, `select`, not clickable `div`s), keep visible focus
  styles, label every control, never rely on colour alone.
- Keep the app offline after model download; do not add network calls or telemetry without discussion.
- Do not commit models, tokens or personal audio.
