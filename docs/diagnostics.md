# Export diagnostics

For a bug report. **Settings, Advanced, Diagnostics and reset, Export diagnostics, Preview…** shows every file that would go into a zip, with its text, and lets you read it before anything is written. **Save zip…** then asks where to put it. The app never uploads it and makes no network call for it; you attach the file to a bug report yourself.

## What is inside (the allowlist)

The files are built from the fields below and nothing else (`app/electron/supportBundle.ts`). Each field is cut to a fixed shape; a value that does not fit becomes `unknown`.

| File | Contents |
| --- | --- |
| `README.txt` | A fixed text saying what the zip is |
| `system.txt` | App version, Electron version, OS name, architecture and release, chip name, core count, memory in GB, free disk space where the models live |
| `models.txt` | The model in use, the names of downloaded models, whether speaker detection is set up |
| `setup-check.txt` | The result of **Check my setup**, as an id and a level (ok, warn, bad) per line |
| `activity-log.txt` | Optional (a checkbox). The last 400 well-formed activity log lines, scrubbed as described below |

Never included: recordings, transcripts, project names, speaker names, file or folder names, settings, the Hugging Face token, the user name or home folder.

## The activity log is best effort

The log is the only free text. Before it is added, the app keeps only lines in the log's own format, always applies the same name hiding as **Hide file and folder names** (even if that setting is off), replaces the home folder and the user name, and removes tokens (`hf_…`), e-mail addresses and long opaque strings. It cannot know a file name written inside ordinary words, so **read `activity-log.txt` in the preview, and untick the log if in doubt**. The log is documented not to contain transcript text (see [data-evidence.md](data-evidence.md)).

## Checking it

`cd app && npm test` runs `src/supportBundle.test.ts`: it plants a fake transcript sentence, file name, home folder, user name, token and e-mail address in the inputs and the log and fails if any of them appears in any file.

See also [troubleshooting.md](troubleshooting.md) and [privacy-and-offline.md](privacy-and-offline.md).
