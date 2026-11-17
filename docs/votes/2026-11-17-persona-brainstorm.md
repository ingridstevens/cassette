# Persona brainstorm: new features (2026-11-17)

*These are simulated opinions from AI personas, not evidence of demand. Each persona was asked, independently, for the four new features it wants most. Nobody saw anyone else's answers.*

## Themes, by how many personas asked

| # | Theme | Who asked | Ideas |
| --- | --- | --- | --- |
| 1 | **Prove and control where data lives** (evidence, retention, deletion) | Okafor (×4), Mara, Jonas, Dev | Evidence pack for a data-protection officer; retention timer and secure deletion; "wipe this recording and everything next to it"; data-location page; privacy audit panel; disk-encryption check; no-transcript log viewer; password lock |
| 2 | **Trust the file you get** (verify, reproduce) | Dev (×2), Jonas, Sam | Model manifest with checksums and a "Verify models" button; reproducible builds and published checksums; version and schema stamp in CSV/JSON; models-folder verification and repair |
| 3 | **Setup and support for a team** | Sam (×4), Dev | Config file and silent install; "Check my setup" and a copy-diagnostics button; pinned versions; headless command-line use |
| 4 | **Check claims against the audio** | Priya (×2), Mara (×2), Hana | Minutes with links back to the source line; per-quote "heard it myself" mark; overlap review list; readable change history |
| 5 | **Fewer repeated steps** | Theo, Priya, Lucía | One-button chapters + clips + Resolve markers; recurring-meeting template; action-owner table; faster per-line language retag |
| 6 | **Never lose work, readable on paper** | Walt (×4) | Autosave and crash recovery; resume a long transcription; visible undo history; large-print printable transcript |
| 7 | **Keyboard and screen-reader parity** | Hana (×4) | Live announcements for progress; jump by speaker, flag, chapter or time; keyboard-only clip selection; accessible Word/HTML output |
| 8 | **Timing and editing for video** | Theo (×3) | Frame-rate and offset aware SRT/VTT/EDL; subtitle presets and burned-in captions; EDL cut list from deleted text |
| 9 | **More languages inside one recording** | Lucía (×3) | Mid-line language marking; hint for lines in weak languages; translation target of choice |
| 10 | **Better anonymisation** | Jonas (×2) | Coverage report of what was and was not replaced; one pseudonym table across interviews |

## Strongest signals

- **Theme 1** has the most asks (four from Okafor alone, plus Mara, Jonas and Dev) and fits the app's promise. Every version stays local and read-only.
- **Theme 7** is a veto area for Hana: a new feature without a keyboard route is a regression. Live progress announcements and keyboard jumps are the cheapest wins.
- **Theme 6** is a veto area for Walt (losing work). Autosave of edits and a visible resume point matter most.
- **Theme 3** is cheap and unblocks a whole class of users (teams): a diagnostics block with no audio or text in it.

## Check against the code

The personas guessed what the app does; I looked at a few claims.

- **Already there, partly:** an undo action exists (`onUndo` in the project view); autosave to a file beside the recording exists (`autosave` option, "Saved in this app and next to the audio"); a translation target language exists (`translateTo` in the options); a per-line language action sits in the speaker menu; the Advanced settings page builds a short system summary (version, OS, cores, memory). Lucía's "choose the translation language" and Walt's "undo" are therefore requests to improve, not to add.
- **Not found:** jump-to-time or next-speaker shortcuts, a print layout, resuming a stopped transcription (the engine streams partial results but I found no resume), a pseudonym table, a delete-everything action that also clears the backup file.
- **Not checked:** the exact behaviour of the backup file on project removal, and whether progress is announced to screen readers (many components use `role="status"`, which suggests partial coverage).

## Recommendations (nothing built yet)

1. **Copy diagnostics and a setup check** (Sam, Dev): one block with versions, OS, disk, models-folder state and recent errors, with no audio or transcript text. Small, local, helps every team.
2. **Delete a project and everything beside it, with a plain receipt** (Mara, Okafor, Jonas): file names and counts only.
3. **Data-location page** (Okafor, Jonas, Dev): where audio copies, transcripts, backups, models and logs live, with sizes. This also feeds the evidence pack later.
4. **Keyboard jumps and live announcements** (Hana): next/previous speaker, jump to a time, and a polite announcement when a file finishes or fails.
5. **Autosave of edits and a resume point on long files** (Walt): confirm what autosave already covers before designing.
6. **One-button episode export** (Theo): chapters, clips and Resolve markers in one folder. Opt-in.

**Not first:** password lock and retention timers (big, easy to get wrong, a false sense of security), burned-in captions (video rendering is a different product), reproducible builds (no installer exists yet).

## Notes

- Blind spots: Dev and Jonas lean toward verifiability and under-weight everyday users; Okafor's four asks overlap heavily, which inflates theme 1; Walt's asks come from one older-Mac view.
- Only one persona asked for: burned-in captions, password lock, mid-line language marking, read-aloud.
