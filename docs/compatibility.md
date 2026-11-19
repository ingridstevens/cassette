# Compatibility matrix

One place for what has and has not been checked. Other pages link here instead of repeating it. Nothing below is
a promise: "Not tested" means nobody on this project has run it, so it may work, or it may not.

**What "tested" means here.** "Run by hand" means someone ran the app from a source checkout (`npm run dev`) on that
system. "CI" means the automated checks in `.github/workflows/build.yml` passed on a GitHub-hosted runner. CI does
not start the app, open a window, transcribe a recording or touch a microphone, so a green CI run says the code
builds and its automated tests pass on that system, and nothing more.

## Platforms

| System | Run by hand | CI (automated checks) | Packaged app |
| --- | --- | --- | --- |
| macOS, Apple silicon (M1 and newer) | Yes: the only system the app has been run on | Yes: engine tests, typecheck, translation check, app checks and build run on `macos-15` for every push and pull request | Never built or run by us |
| macOS, Intel | Not tested | Not run on every push: `macos-15-intel` is only in the packaging job, which has not run yet | Not built, not run |
| Windows 10 and 11 | Not tested: nobody has run the app, `setup.ps1` or the installer on Windows | Yes: the same checks run on `windows-2022` for every push and pull request | Installer configured, never built or run |
| Linux | Not tested | Yes: the same checks run on `ubuntu-22.04` for every push and pull request | Not built, not run |

The packaging job (all four targets) runs only for `v*` tags or by hand, and has not been run. There is no installer
to download: you run Cassette from the repository. Builds are not signed, so macOS and Windows will warn the first
time ([Troubleshooting](troubleshooting.md#the-computer-warns-that-the-app-is-from-an-unidentified-developer)).

## Hardware

| Hardware | Status |
| --- | --- |
| Apple silicon | Run by hand. This is the only hardware where the Apple GPU speech version (MLX-Whisper, optional download) can be used. |
| Intel Mac | Not tested. Speech uses the processor. |
| NVIDIA graphics card (Windows, Linux) | Never run: the project has no NVIDIA hardware. The path through ctranslate2 exists in the code and is meant to be used when a card is usable. |
| No graphics card, low memory (4 to 8 GB) | Not timed. The memory warning, the smaller default size, the thread budget and the order in which models are loaded are covered by tests with stand-in models. Nobody has measured speed or memory on a real low-end computer, and the speed estimates in `app/src/estimate.ts` are rough guesses (measured once, on one Mac, with the small model). |
| AMD or Intel graphics | Not supported. DirectML and Vulkan engines are only ideas ([Windows and weaker computers](windows-and-low-spec.md)). |

## Optional parts

| Part | Status |
| --- | --- |
| Highlights and summaries on Windows and Linux | Opt-in install (`uv sync --extra llm`) because llama.cpp has to be compiled. Not tested on either system. |
| Speaker detection | Needs a Hugging Face account and token, or an imported models folder. |

## Features that have only been checked in part

| Feature | What has and has not been checked |
| --- | --- |
| Packaged app | The packaged desktop app has not been run by us on any system. Checks so far are from `npm run dev`, from the command line, from unit tests and from the browser preview. |
| Quitting during a transcription | Read from the code and checked once from the command line (closing the engine's output ends it within seconds). Not tried in a packaged app. |
| Streaming recordings over the `media:` protocol, with the waveform drawn from engine-computed peaks | Covered by unit tests. Not run in a packaged app. |
| Recording from the microphone (Record page) | Not yet tried with a real microphone or real models, on any system. Browser previews fake the engine and cannot say anything about real audio. |
| Review mode | Tried in the browser preview with a fake sound, not with real audio in the desktop app. |
| Several languages in one recording | Tried on one short test recording (29 s, 3 speakers, 4 languages). It cannot follow a switch inside one turn, and turns under 0.35 s are skipped. |
| Overlapping speech | The flag has only been unit-tested, not tried on real crosstalk. |
| Look, fonts and text sizes | Checked in a browser preview, not with a screen reader and not on Windows. |
| Translations (German, French, Spanish) | Machine-assisted and not yet reviewed by a native speaker. `npm run i18n:check` only checks that the text is complete. |
| Browser end-to-end tests | `npm run e2e` (Playwright, in `app/e2e/`, against the browser preview) is run on demand. It is not part of CI yet. |
| Model downloads | Each Hugging Face download is pinned to one exact commit (`PINS` in `engine/src/engine/models.py`); the security statements come from reading the code, not from an independent audit ([Privacy and offline use](privacy-and-offline.md#honest-limits)). |

## Where else this is mentioned

[README](../README.md#honest-limits), [Getting started](getting-started.md), [Troubleshooting](troubleshooting.md#windows-and-linux),
[Windows and weaker computers](windows-and-low-spec.md), [Development](development.md#known-limits).
If a test shows something new, change this page first and keep the other pages pointing here.
