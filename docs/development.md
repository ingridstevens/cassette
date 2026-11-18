# Development

See also [CONTRIBUTING](../CONTRIBUTING.md) for the quick setup and rules.

## How it fits together

```
Electron main process (app/electron)         Python engine (engine/)
  - windows, menus, secure storage             - ffmpeg: decode / trim to 16 kHz mono
  - IPC handlers (files, models, export)       - faster-whisper: words with timings, language
  - spawns the engine, one process per job ──▶ - pyannote 3.1: who speaks when
                                               - merge words with speakers, group into lines
React UI (app/src), in the renderer           - export formats, model downloads
  - projects, queue, transcript, inspector
  - talks to main only through window.api (preload)
```

The engine is a command-line program. In development the app runs `uv run python -m engine …`; packaged builds
run a PyInstaller binary.

## Engine commands

```
python -m engine transcribe <file> --model small --language auto [--num-speakers N] [--start s --end s]
                                   [--min-speakers N --max-speakers N] [--device auto|cpu|cuda|mps] [--vad] [--prompt "words"]
                                   [--no-diarize] [--mixed-languages auto|on|off] [--translate]   # --language accepts auto or any Whisper code
python -m engine transcribe … [--backend auto|faster|mlx]   # speech engine: auto = Apple GPU (MLX) when installed and downloaded
python -m engine translate <file> --start s --end s [--language xx] [--model small]   # English translation of one stretch
python -m engine models status | download <name> | delete <name> | import <folder> | check   # <name> may be mlx-small etc. (Apple GPU versions)
python -m engine export <transcript.json> <out> --format docx|txt|csv|srt|vtt|md|json|chapters|edl|minutes|highlights|redacted|quotes|changes|combined-csv
python -m engine clip <input> <output> --start s --end s
python -m engine highlights <transcript.json> [--model qwen3-4b] [--count N]   # suggest quotable passages (local language model)
python -m engine summarize <transcript.json> [--model qwen3-4b]                 # summary, topics, decisions, action items
python -m engine export-clips <input> <folder> --clips clips.json [--format mp3|wav|m4a] [--pad 0.3]   # one audio file per clip
python -m engine models download llm-qwen3-4b   # a language model; the ids are in LLM_MODELS in llm.py
```

### Protocol

The engine prints **one JSON object per line** on stdout and nothing else:

| `type` | Fields |
| --- | --- |
| `progress` | `stage` (`decode`, `diarize`, `transcribe`, `merge`, `translate`, `download`), `fraction` (0–1 or null), `message` |
| `log` | `level`, `message` (shown in the activity list; never contains transcript text) |
| `done` | for `transcribe`: `language`, `duration`, `speakers`, `segments` (each with `words`), `meta` (models, devices, timings); for others: command results |
| `error` | `message`, `detail` |

Inference runs with offline mode on (`HF_HUB_OFFLINE=1`); only `models download` touches the network.

## Where things are in the app

- `app/electron/main.ts`: window, IPC (`pick-file`, `transcribe`, `models`, `export`, `save-image`, `reveal-*`,
  `disk-free`, `peaks`, projects load/save). Keep handlers small and validate arguments.
- `app/electron/preload.ts`: the only bridge (`window.api`).
- `app/src/useProjects.ts`: project list, persistence, the one-at-a-time queue, engine events.
- `app/src/components/`: `ProjectView` (transcript, player, toolbar), `Inspector` (Speakers / AI / Details), `HighlightsTab` (highlights, suggestions, audio clips, summary),
  `Transcript` (lines, editing, chapters), `ReviewBar` (review mode), `ExportMenu` and `ExportOptions`, `Setup` (first
  launch), `settings/` (Settings screens), `Activity` (status pill). `ShareCard.tsx` and `shareCardLib.ts` (a "who talks the most"
  picture) exist but are not wired into the UI yet.
- `app/src/types.ts`: shared types and the pure helpers for editing a line (`retext`, `revertLine`).
- `app/src/styles/`: `base.css` is the design system (tokens, buttons, dialogs, menus); each area has its own file.
  System fonts only; no web fonts or CDNs, so the app stays offline. Colours go through tokens so every look works
  in light and dark: `--surface` (cards, inputs), `--tint` and `--tint-k` (borders and inset rings), `--page` (an opaque
  page colour for sticky bars), `--done` / `--on-done` (finished steps), `--on-sun` (text on the main buttons), and
  `--violet-ink`, `--err-ink`, `--warn-ink`, `--ok-ink` for coloured text. `themes.css` holds dark mode, the second
  look (*Clean*) and high contrast (`<html data-mode="dark" data-look="clean" data-contrast="high">`, set by `applyLook` in
  `types.ts`). The two looks change colour tokens only: no layout, shape or font differs between them.
  Avoid fixed colours in new CSS; if you need one, add a token and its dark value.
- `app/resources/`: the app icon (`icon.icns`, `icon.ico`, `icon.png`), used by electron-builder and as the Dock
  icon in development. The drawings are in `resources/icon-src/` (`cassette.svg` for 64 px and up, `cassette-small.svg`
  for 16 and 32 px); see *App icon* below to export them again.
- `engine/src/engine/`: `main.py` (CLI), `asr.py`, `diarize.py`, `merge.py` (pure), `export.py` (pure), `models.py`, `llm.py` (the local language model: MLX
  on Apple Silicon, llama.cpp elsewhere), `highlights.py` and `summarize.py` (prompts and checking the answers; the model is injected, so tests use a fake), `audio.py` (`export_clips`).
- `docs/samples/`: two-voice test recordings (made with text-to-speech) to try the pipeline.

## Run, test, build

```bash
cd engine && uv sync && uv run pytest -q     # engine tests (export formats, merging, language and translation logic, run metadata, and a tripwire for new network code, see Privacy and offline use)
cd app && npm ci && npm run dev              # dev app with hot reload (Node 22.12 or newer)
cd app && npx tsc --noEmit && npm run build  # typecheck + production build
engine/build_engine.sh && cd app && npm run package   # packaged app for this OS
```

Hot reload restarts the page when you save a file, which stops audio playback. That is expected during
development and does not happen in a built app.

`app/src/dev-mock.ts` fakes `window.api` so the UI can run in a plain browser. Add flags to the address, for example `http://localhost:5173/?ready&fresh`:

| Flag | Effect |
| --- | --- |
| `ready` | Models and speaker detection count as installed |
| `fresh` | Forget saved projects and settings first, so you start from the empty screen |
| `lowmem` | Pretend the computer has 4 GB of memory |
| `slow` | Make the transcription step take 12 s, to watch progress and the queue |
| `fit` | The language check finds Persian and says the chosen size is weak |
| `battery` | Pretend the computer is on battery |
| `missing` | *Add recordings* also adds a recording whose file is gone (the missing-file messages) |
| `enginefail` | Transcribing fails after decoding, with an engine error (the error card and activity log) |
| `offline`, `denied`, `lowdisk` | Trigger the download and disk error cards |

*Add recordings* gives three samples: a German interview, a German podcast episode and an English team meeting (any path containing "meeting" or "english" comes back in English), all not yet transcribed.

## Screenshots

The pictures in `docs/screenshots/` and the README are generated from the browser mock, so they can be redone whenever the UI changes:

```bash
cd app && npm i --no-save playwright-core && npx vite --port 5173   # terminal 1: the mock UI
cd app && node scripts/docs-screenshots.mjs                         # terminal 2: writes docs/screenshots/*.jpg
```

It needs Google Chrome (set `CHROME=/path/to/chrome` to use another) and drives the UI by button labels, so renaming a button
means updating the script. The images show made-up data from `dev-mock.ts` (a short German interview, three speakers), never a real recording.
After running it, look at the pictures before committing them. The README's top picture
(`00-hero-light.jpg` and `00-hero-dark.jpg`, shown to GitHub visitors in light or dark mode) comes from the same mock.

Local recordings and scratch screenshots belong in `test-media/` and `shots/`; both are ignored by git, so they
never leave your computer.

## App icon

Export the icon again after changing the drawings in `app/resources/icon-src/` (needs `rsvg-convert`, ImageMagick and,
for the macOS file, `iconutil`):

```bash
cd app/resources
mkdir icon.iconset
for s in 16 32; do rsvg-convert -w $s -h $s icon-src/cassette-small.svg -o icon.iconset/icon_${s}x${s}.png; done
rsvg-convert -w 32 -h 32 icon-src/cassette-small.svg -o icon.iconset/icon_16x16@2x.png
rsvg-convert -w 24 -h 24 icon-src/cassette-small.svg -o tmp-24.png
for s in 48 64 128 256 512 1024; do rsvg-convert -w $s -h $s icon-src/cassette.svg -o tmp-$s.png; done
cp tmp-64.png icon.iconset/icon_32x32@2x.png; cp tmp-128.png icon.iconset/icon_128x128.png
cp tmp-256.png icon.iconset/icon_128x128@2x.png; cp tmp-256.png icon.iconset/icon_256x256.png
cp tmp-512.png icon.iconset/icon_256x256@2x.png; cp tmp-512.png icon.iconset/icon_512x512.png
cp tmp-1024.png icon.iconset/icon_512x512@2x.png; cp tmp-1024.png icon.png
iconutil -c icns icon.iconset -o icon.icns
magick icon.iconset/icon_16x16.png tmp-24.png icon.iconset/icon_32x32.png tmp-48.png tmp-256.png icon.ico
rm -rf icon.iconset tmp-*.png
```

The 16 and 32 px sizes use the simpler drawing on purpose: the cut-out reels need to stay big and the tail simple at that size.

## Translations

The UI text is English in the source: write `t("English sentence")` (`useT()` in components, `t` from `app/src/i18n` elsewhere) and
add the German, French and Spanish text to a file in `app/src/i18n/dict/` (`export default { de, fr, es }`, English text as
the key; `{name}` placeholders must stay). A missing entry falls back to English. `npm run i18n:check` in `app/` lists every
`t("…")` string without all three translations and fails if any are missing. Don't put markup inside one translated sentence;
split it. The words the engine writes into exports (headings, footer, dates) are in `_L` in `engine/src/engine/export.py`;
the app sends its language with every export. The language setting is `appLanguage` (`system` by default).

## Adding an export format

1. Add a pure function to `engine/src/engine/export.py` and a test in `engine/tests/test_export.py`.
2. Register it in `cmd_export` in `engine/src/engine/main.py` and in the `--format` choices.
3. Add an item to `FORMATS` in `app/src/components/ExportMenu.tsx` (and options in `ExportOptions.tsx` if needed).
4. If the file extension differs from the format id, adjust the mapping in the `export` handler in `main.ts`.

## File sizes

The engine and Electron always deal in exact bytes. Only the text changes: `bytes()` in `app/src/types.ts` formats a
number using `SIZE_BASE` (1000 on macOS and Linux, 1024 on Windows). Never format sizes with hand-written
"MB" strings or in Python; send raw numbers (as `models.py` does with `done`/`total`) and format them in the app.
RAM is the exception: every system shows it in binary units, so Settings uses 2³⁰ for it.

## Time estimates

`app/src/estimate.ts` turns a recording's length, the model, the engine and whether speakers are detected into a range of seconds. Speeds are "seconds
of audio per second of work": built-in rough guesses (measured once on one Mac with the small model, scaled by model size) until `recordSpeed` has stored real
timings from full runs in `localStorage`. `StartSheet.tsx` shows the estimate always and the questions when the middle estimate is over a minute
(`ASK_ABOVE_SECONDS`). The first-3-minutes run is an ordinary range run flagged `trial` on the project. Battery state comes from the `power-state` IPC.

## Speech engines

`asr.py` talks to a model object with two methods, `transcribe` and `detect_language`, shaped like faster-whisper's `WhisperModel`. There are two
implementations: faster-whisper (CPU, or CUDA when ctranslate2 finds an NVIDIA card) and `asr_mlx.py`, a thin wrapper around `mlx-whisper` for the
Apple GPU (Apple Silicon only; the dependency is installed only there, through an environment marker in `engine/pyproject.toml`). `load_model` chooses
with `pick_backend`: *auto* uses MLX only when it is installed, that size's MLX model is downloaded (`mlx-community/whisper-*-mlx`, see `MLX_MODELS` in
`models.py`), the user didn't force the CPU and the project doesn't use skip-silence (MLX has no VAD). Everything above that layer (per-turn languages,
translation, verbatim prompts) is unchanged. `models status` reports `mlxAvailable`, `mlx` and `mlxSizes`. PyInstaller: `build_engine.sh` adds the MLX
packages when they are installed; that bundle has **not been built or run**.

## Continuous integration

`.github/workflows/build.yml`: every push and pull request runs the engine tests, the typecheck, the translation check and the
build on macOS, Linux and Windows. Packaging (all four targets) runs only for `v*` tags or by hand. Neither has been run yet.

## Known limits

- Whisper runs on the CPU (its engine has no Apple GPU backend). Speaker detection can use the graphics chip.
- Language is detected once per file unless Mixed languages finds several (Automatic checks the language of the longest speaker turns first; "Always" skips the check): then each diarization turn is transcribed on its own with its own language (turns under 0.35 s are skipped, no switch inside a turn). Verified on one 29 s, 3-speaker, 4-language recording only.
- NVIDIA GPU use for Whisper is chosen through ctranslate2 and has never run on this project (no NVIDIA hardware); Windows and Linux builds are untested.
- Overlapping speech is flagged (words keep one speaker, the louder one); the flag has only been unit-tested, not tried on real crosstalk.
- Windows and Linux builds are untested; the build workflow has not been run.

## Checks that keep the look and privacy claims true

From `app/`:

```bash
npm run contrast:check   # WCAG contrast of the Clean look's colour pairs, read from src/styles/themes.css
npm run build && npm run built:check   # fails if the built app names a remote font, stylesheet or CDN address
npm run i18n:check       # every string has a German, French and Spanish entry
```

Fonts live in `app/src/assets/fonts` (see [dependency-vetting.md](dependency-vetting.md)). The app icon is drawn in `app/resources/icon-src/cassette.svg`; `icon.png`, `icon.ico` and `icon.icns` are made from it with `rsvg-convert`, `magick` and `iconutil` (the small sizes of the `.ico` use `cassette-small.svg`).

## Right-to-left layout and the player

In Arabic and Persian the window mirrors: the project list moves to the right, text aligns right, tabs run right to left. The **player is a deliberate exception inside**:

- The play, back 15 and forward 15 buttons keep their usual left-to-right order and arrow directions. They name the direction of the recording, not the direction of reading.
- The waveform and the playhead still run left to right, as in audio editors and most players. Clicking further right means later in the recording.
- The clock stays `0:00 / 0:24` (`dir="ltr"`): numbers are not reordered.
- The whole player block, and the buttons as a group, do sit on the mirrored side.

This follows Material Design, Firefox and Spotify's guidance (do not mirror media controls or the media progress bar), and is the safer choice because the opposing view (Apple's HIG says to flip controls that show progress, Mozilla says time should run right to left) is mostly about generic progress bars, not about a recording's timeline. It has not been checked with Arabic or Persian readers: ask one before changing it either way.
