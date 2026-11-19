# Where your data is: evidence for data-protection reviews

This page maps each kind of data Cassette handles to where it is stored, what can read it, how to delete it and which network calls exist. It was written from the source code, one file at a time; each row names the file it comes from so you can check it. It is not an independent audit (see [Honest limits](privacy-and-offline.md#honest-limits)).

In the app the same places are listed with their real paths on your computer, each with a **Show** button: **Settings, Privacy, What is stored where**. The paths below use `<data folder>` for the app's data folder: the folder Electron calls `userData` for the app named "Cassette" (on macOS usually `~/Library/Application Support/Cassette`, on Windows `%APPDATA%\Cassette`, on Linux `~/.config/Cassette`; the exact path is on the Settings page, and I did not verify these defaults on every system).

Anything that could not be established from the code is marked **not verified**.

## Data kinds

| Data | Location | Who or what can read it | How to delete it | Source |
| --- | --- | --- | --- | --- |
| Your own audio or video files | Where you keep them. Opened in place; never copied, moved or changed. | Anything with your user's file access. The app reads them to transcribe, play (`media://`, below) and draw the waveform. | Delete the file yourself. Deleting a project never deletes it. | `app/electron/main.ts` (`delete-project-files`: the recording is removed only when it lies inside `<data folder>/recordings`) |
| Recordings made with **Record**, and the copy made by **Try a sample** | `<data folder>/recordings/` (`.wav`; a `.pcm` while recording) | Same as above | Delete the project (the dialog says what goes), or delete the folder | `app/electron/live.ts`, `app/electron/main.ts` (`sample`) |
| Recordings recovered after a crash | Same folder. A recording interrupted by a crash stays there as `.pcm`; the next time the app starts it turns each one longer than 1 second into a `.wav` and adds it as a project. | Same | Same | `app/electron/live.ts` (`live-recover`), `app/src/useProjects.ts` |
| Projects: names, transcripts, speaker names, edits, marks, highlights, summaries, settings that belong to the project | `<data folder>/projects.json`, plus up to three rolling backups `projects.json.bak1` to `bak3` (a new backup at most once a minute, only of a readable file). A damaged file is moved aside as `projects.corrupt-<time>.json` and kept. | Anything with your user's file access. **Stored unencrypted**; use disk encryption. | Delete the project in the app (removes it from `projects.json`), then note that older **backups still hold it until they are rotated out**; delete `projects.json`, the `.bak` files and any `.corrupt-` files to erase everything | `app/electron/projectsStore.ts` |
| Backup file next to the recording (`name.transcript.json`) | Next to the audio, only if Settings, Saving is on | Anyone who can read that folder | Deleted with the project (the delete dialog and receipt list it), or delete the file | `app/electron/main.ts` (`save-sidecar`, `delete-project-files`) |
| Waveform cache | `<data folder>/peaks/<hash>.json`: 8000 loudness values and the length. No words and no audio. The name is a hash of path, modified time and size. | Anything with your user's file access | Delete the folder (it is made again). **Not removed when a project is deleted** (the code does not remove it). | `app/electron/main.ts` (`peaks`), `app/electron/media.ts` (`peaksCacheName`) |
| Temporary files | `<data folder>/tmp/`: transcript text handed to the engine as JSON (owner-only permissions) and the text for **Copy as Markdown**. Deleted right after each use, and the whole folder is wiped when the app starts. | Your user only (`0700` folder, `0600` files; Windows permissions **not verified**) | Automatic. Delete the folder if a crash left something. | `app/electron/tempJson.ts`, `app/electron/main.ts` (`export-text`, start-up `rmSync`) |
| Decoded audio while a job runs | The engine decodes the recording to a 16 kHz mono WAV inside Python's `TemporaryDirectory()`, i.e. the **system temporary folder**, not the app's own `tmp`. It is removed when the job ends. | Your user (system temp permissions are the operating system's) | Automatic at the end of the job. If the job is cancelled by killing the engine or the computer crashes, whether the copy is removed is **not verified**; clear the system temporary folder. | `engine/src/engine/main.py` (`cmd_transcribe`, translate), `engine/src/engine/audio.py` |
| Models | The app always starts the engine with `ENGINE_MODELS_DIR=<data folder>/models`. Without that variable (the engine run on its own) the default is `~/.cassette/models`, or the older `~/.local-transcriber/models` if that exists and the new one does not. | Anything with your user's file access. Models contain no recordings or transcripts. | Settings, Transcription or Summaries and translation, **Delete**; or delete the folder. **Verify** (Settings, Advanced) checks files against the pinned version; see [models.md](models.md). | `app/electron/main.ts` (`modelsDir`, `baseEnv`), `engine/src/engine/models.py` (`_default_models_dir`) |
| Hugging Face token | `<data folder>/hf-token.bin`, encrypted with Electron `safeStorage`. Only the last 4 characters are shown. Passed to the engine only when downloading or repairing speaker models, or checking access. | The operating system's secure storage. On Linux without a keyring `safeStorage` uses `basic_text`, which is effectively plain text; the app warns in Settings. | Settings, Privacy, **Remove** | `app/electron/main.ts` (`tokenFile`, `token`, `tokenSecure`, `models`) |
| Activity log | `<data folder>/activity.log` (marker files `activity-log-off` and `activity-log-hide-names` hold the two switches) | Anyone who can read that folder. It lists file and folder names and engine messages such as word counts. The engine's own log lines (read one by one in `engine/src/engine/`) do not write transcript text. The messages the window reports about its own errors are cut to 4000 characters and **not verified** to be free of transcript text. | Settings, Privacy, **Clear log…**, or delete the file. **Hide file and folder names** applies to new lines only and is best effort. | `app/electron/activityLog.ts`, `app/electron/logRedact.ts`, `app/electron/main.ts` |
| Diagnostics zip (**Export diagnostics**) | Where you choose in the save dialog. Built from a fixed list of fields plus the scrubbed activity log; shown in full before saving. Never uploaded. | Whoever can read that place or receive the file | Delete the file yourself. The app keeps no copy. | `app/electron/supportBundle.ts`, `app/electron/zipStore.ts`, [diagnostics.md](diagnostics.md) |
| Exports (text, Word, spreadsheet, JSON, minutes, quotes, clips, PDF) | Where you choose in the save dialog | Whoever can read that place or receive the file | Delete the file yourself. The app keeps no list of exports and never deletes them. | `app/electron/main.ts` (`export`, `export-clips`, `print-pdf`) |
| **Anonymised** export and its key | The anonymised text goes where you choose. A **second** save dialog asks where the key goes; its default is your Documents folder. The key maps pseudonyms back to real names, so keep it apart. If the engine is run on its own without `--key-output`, the key goes beside the export. | Whoever can read those places | Delete both files yourself | `app/electron/main.ts` (`export`, `redacted`), `engine/src/engine/main.py` (`--key-output`) |
| Settings (look, model choices, retention days, Easy mode, export menu) and small app-wide notes such as read help texts and speed estimates | The window's `localStorage` (keys `opts` and others), which Electron keeps inside the data folder. The exact file on disk is **not verified**. No transcript text is stored under `opts` (it holds options). | Anything with your user's file access | Settings, Advanced, **Reset all settings** (for the options); or delete the data folder | `app/src/App.tsx`, `app/src/hints.ts`, `app/src/estimate.ts` |

## What can read your recordings while the app runs

- **`media://` streaming.** The player gets audio from `media://file/<encoded path>`, served by the app's main process with byte-range support. It answers only for a recording the app knows about: one in the saved project list, one you picked, dropped or opened, or one the live recorder wrote. Any other path gets a 403. Nothing is sent over the network; the scheme is local to the app. Source: `app/electron/main.ts` (`protocol.handle("media")`), `app/electron/knownPaths.ts`, `app/electron/media.ts`.
- **What the window may ask the app to open.** The window cannot pass a path to "show in folder" for the app's own places: it names one of six fixed places (`models`, `log`, `data`, `recordings`, `peaks`, `tmp`; `REVEAL_TARGETS` in `app/electron/validate.ts`, tested in `app/src/validate.test.ts`), and the app resolves it. Revealing a recording goes through the known-recordings list.
- **The engine.** The engine is a separate process started by the app. It is given file paths and a temporary JSON file; it runs with offline mode on for transcription, speaker detection, highlights, summaries and questions (`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `engine/src/engine/main.py`).

## Network calls and when

The single list of web hosts is `ALLOWED_HOSTS` in `engine/tests/test_network_surface.py`: `huggingface.co`, `download.moonshine.ai`, `github.com` (and `www.w3.org`, which is only an XML namespace string and is never contacted).

| Host | When | What is sent | Source |
| --- | --- | --- | --- |
| `huggingface.co` | You press Download (or Repair) on a model | The model name and a pinned commit. Your token only for the speaker models. | `engine/src/engine/models.py` |
| `huggingface.co` | You save a token, or the app checks it | The token | `engine/src/engine/models.py` (`check_access`) |
| `download.moonshine.ai` | You download a Moonshine model | The language | `engine/src/engine/asr_moonshine.py` |
| `huggingface.co` pages | You press **Open token page** or **Open the two model pages** | Nothing from the app: your browser opens the page | `app/electron/main.ts` (`open-external`) |
| `github.com` | You press **Send feedback** (Settings, About) | Nothing from the app: your browser opens a pre-filled new-issue page that you can edit and only send yourself | `app/electron/main.ts` (`open-external`), `AboutSection.tsx` |
| Everything else (transcribing, exporting, highlights, translation, retention, Easy mode) | Never | Nothing | The engine runs offline; `test_network_surface.py` guards the rest |

No account, analytics, telemetry or update check exists in the code paths read for this page; the network-surface test is a tripwire for the files and source text it scans, not proof for everything (it cannot see an address built at run time).

## Retention, Easy mode and "keep a copy"

- **Retention.** Settings, Privacy, Old projects: ask about projects older than 30, 90, 180 or 365 days (default never). Age is counted from last use: the latest of when it was added, opened, edited or transcribed; projects that are queued or running are skipped. The app only asks when it starts, lists the projects, and deletes only after you confirm, then shows a receipt. Source: `app/src/retention.ts`. Deleting a project follows the table above (backups of the project list can still hold it until rotated out).
- **Easy mode.** It changes which export buttons are shown (Word and Print/PDF only). It does not change where anything is stored or what is sent. Source: `app/src/easy.ts`.
- **Disk encryption.** The app does not encrypt projects, recordings or models. Turn on FileVault or BitLocker (or the Linux equivalent) so they are protected when the computer is off.

## Reproducing these checks

1. Settings, Privacy, What is stored where: compare the paths and open each with **Show**.
2. `cd engine && uv run pytest tests/test_network_surface.py`: host list, pinned downloads, no requests made by the app itself.
3. `cd app && npm test`: includes the tests for the places the window may reveal and for retention.
4. Read the source files named in the tables.

See also [privacy-and-offline.md](privacy-and-offline.md), [models.md](models.md) and [SECURITY.md](../SECURITY.md).
