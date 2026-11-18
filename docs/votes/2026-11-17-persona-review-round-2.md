# Persona review, round 2 (2026-11-17)

*These are simulated opinions. Each of the ten personas reviewed the app on its own (the browser mock, fake engine) and listed up to four new features it wants. Reviewers shared one browser and one saved state, so some observations come from each other's clicks (for example a renamed project). Nothing here is evidence of real demand.*

All ten said they would keep using the app, or "maybe". None triggered a veto.

## What they asked for, clustered

| Theme | Who | What |
| --- | --- | --- |
| **Delete and retention** | Okafor, Jonas, Mara | "Remove from the list" does not say what is deleted; wanted a plain list and a receipt; later: retention timers, log controls |
| **Anonymisation honesty** | Jonas, Okafor | "Anonymised text" did not say that spoken names other than speaker labels are not replaced |
| **Source-linked minutes, decisions, quotes** | Priya, Mara | Link every summary item to its transcript line; show the kind of a marked line; verified-by-ear mark; change history |
| **Per-line language** | Lucía, Jonas | Language chip per line, retag and re-transcribe a line, bilingual export, detected-language shares |
| **Keyboard and screen reader** | Hana | Live announcements in review mode, jump by speaker or time, shortcut sheet, skip link |
| **Team setup** | Sam, Dev | Config file, models-folder verifier with a per-model result, support bundle, path with Copy/Open |
| **Provenance and checkability** | Dev, Jonas | Model, version and settings in each export; source link per network call; headless command line |
| **Video workflow** | Theo | Share card, auto-suggest chapters, silence cut list, remembered export presets |
| **Plain, forgiving app** | Walt | Print, resume a long transcription, time left in plain words, easy mode with fewer buttons |
| **Export menu is long** | Mara, Priya, Lucía, Walt, Theo, Sam, Jonas | Seven of ten said the 15-item list is too long; group it and pin the common formats |
| **Sample data** | Mara, Theo, Lucía, Jonas | The mock only has two German, already-finished projects, so the first-run path could not be walked |

## Check against the code

Personas guess. I checked what I could:

- **Wrong:** Dev said there is no JSON export in the menu; there is ("Everything (JSON)", in the Data group). Hana said Settings did not open; it does (the shared tabs and the mock confused that run). "Intervijew 2026" is the mock's own project name (a typo in the fake data, not another reviewer's rename).
- **Right and now fixed:** the anonymised export did not say it only replaces speaker names (the engine replaces speaker labels and the names the user typed, not other spoken names); the Overview page said "Nothing leaves this computer unless you download a model" while the Privacy page says the token is also checked; the review counter was not announced to screen readers; per-line action buttons stayed hidden while a keyboard user was inside a line.
- **Right, not fixed:** the export menu length; no per-line language chip (the speaker menu has a language action, but no visible tag); summary items without links; no print.
- **Not checked:** Hana's claim that settings nav buttons have no accessible names, and Okafor's that settings search does not filter (both may be mock artefacts).

## Done in response (this round)

1. **Delete a project with a receipt.** The sidebar × now opens a dialog listing what is deleted (the transcript and edits, the backup file next to the recording, and the recording only if Cassette made it) and what is not touched (your own audio file, exports and clips, the activity log). Afterwards a receipt lists each file as deleted, not found, could not delete or kept. File names only, never transcript text; shown once, not saved. New engine call `delete-project-files` (Electron only deletes the one backup file and an app-made recording; a file you added is never touched).
2. **Anonymised export label** now says speaker names are replaced and other names are not found.
3. **Overview privacy sentence** now matches the Privacy page.
4. **Review counter** is announced (`role="status"`); **line actions** show on keyboard focus inside a line.
5. **Arabic and Persian** (issue #17): the first-run screens, start sheet, project list and delete dialog are now translated (214 strings). Right-to-left layout was already in place. The transcript, Settings pages, record page and export menu are still English.
6. **Dialogs under text zoom:** a box fixed to the window overflowed when text size was above 100%; the new dialog divides by the zoom.

## Next, in order

1. **Group and shorten the Export menu** (seven personas): pin Word and one data format, fold the rest under "More formats".
2. ~~**Demo data that covers the first run:** an English sample and one un-transcribed project in the mock, plus flags to simulate a missing file and an engine failure (Sam, Mara, Lucía).~~ Done: `?fresh`, an English sample, `?missing` and `?enginefail` (see development.md).
3. ~~**Source links in the summary** (Priya, Mara): a clickable time on every decision and action item.~~ Done: each decision and action item links to the closest matching line when there is a clear match; an item with no match (nothing in the transcript says it) gets no time.
4. ~~**Per-line language chip** with "Transcribe this line again in…" (Lucía; also feeds Jonas).~~ Mostly there already: the tag, the dialog and "Transcribe this line again" existed, but the tag only showed on lines that differed or in mixed recordings, so Lucía never saw it. Done: a **Languages** toolbar button shows the tag on every line. Not done: detected-language shares ("German 70%, English 20%") and a bilingual export.
5. ~~**Keyboard jumps and a shortcut sheet** (Hana).~~ Done: `N` / `Shift+N` (next or previous line from a different speaker), `G` (go to a time) and `?` (the list of shortcuts); jumps are announced. Later done: `O`, `M` and `C` (next overlap, marked line, chapter; with Shift for previous) and a **Skip to the transcript** link. Keyboard-only clip selection is also done: `[`, `]`, `S`, and `,` / `.` for half-second steps. Still not done: a jump to the next decision (decisions are the summary's, not marks on a line).
6. **Finish Arabic and Persian** for the transcript, Settings and export menu (about 180 strings), then ask a native reader to review. Done for the transcript, export menu, review mode, record page, activity list and the Settings overview (242 more strings each, machine-assisted). Later: the Settings pages Transcription, Speakers, Summaries, Saving, Text and language, Advanced and About, and the model list are translated too (160 strings each). Then the Speakers, Options, Info and Ask tabs, the language-fit card, error cards and the model-folder report (135 strings each). Then the Highlights tab and summary, export options, the empty first screen, the player messages, model download errors, "Check my setup" and step names (111 strings each). Then the speaker setup steps and the rest of the project view (progress, search and replace, player, dialogs; 171 strings each). Still English: only the long Privacy page (its wording makes privacy promises, so it should be translated together with a native reader). **A native reader still needs to check all of it.**
7. ~~**Models-folder result list** after "Use a models folder…" (Sam).~~ Done: a dialog lists each model as copied, incomplete or not in the folder. Not done: checksums and version checks (a file can be complete but the wrong version), a config file and silent install.

Also done after the list: **provenance in the JSON export** (Jonas, Dev). The JSON file's `meta` was always empty; it now carries a schema version, the app and engine versions, the language, the model and devices, and the number of edited lines, with no date so exports stay identical for the same input. Not done: model checksums, and a header in CSV or text exports (it would change their columns).

Also done: **log controls** (Okafor): Settings, Privacy can switch the activity log off and clear the file. Later: a **Hide file and folder names** switch for new log entries (best effort: it recognises paths and audio or video file names, checked by `npm run links:check`, which CI now runs). Not done: retention timers.

Also done: **network tripwire and source column** (Dev): a test that fails when network-capable code or a new web address appears outside the known places, and a "Where in the code" column in Settings, Privacy, Every network call.

Held back for now: password lock, burned-in captions, share cards, headless command line (each needs a design decision).
