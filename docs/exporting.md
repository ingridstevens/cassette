# Exporting

Open a project and choose **Export** (or press `⌘E` / `Ctrl+E`). Exports always use the speaker names you
entered (unnamed speakers appear as "Speaker 1", "Speaker 2", …) and your corrected text.

![The Export menu, grouped into Read and share, Subtitles and video, and Data](screenshots/13-export-menu.jpg)

The menu is grouped: **Read and share** (Word, text, Markdown, anonymised, Text style), **Subtitles and video**, and **Data**. The table lists every item.

| Menu item | File | What's in it |
| --- | --- | --- |
| Word document | `.docx` | A designed page: title, date, who talked how much (coloured bars), then each line with a coloured rule for the speaker, the name and the time. Chapters become shaded headings. Opens in Word, Pages and Google Docs. |
| Plain text | `.txt` | `[00:00:03] Anna: text`, one line per speaker turn. |
| Spreadsheet | `.csv` | Start and end as seconds and as `h:mm:ss`, speaker, text, and flag columns (see below); optionally a last version row. Opens in Excel, Numbers and Sheets. |
| Subtitles | `.srt` | Subtitle cues for video editors and players. Has options (below). |
| Web subtitles | `.vtt` | The same cues in WebVTT, for web video. Has the same options. |
| Meeting minutes | `.docx` | The summary (if you wrote one, see [Highlights](highlights.md#summary)) with topics, attendees, a "Decisions and action items" list made from the lines you **Mark** (plus the summary's decisions and action items), your highlights as "Key quotes", then the full record with chapter headings. |
| Highlights and marked lines | `.txt` | Every highlight and every marked line, each as a quote with the speaker and time. Greyed out until you have one. |
| Highlights | `.docx` | The same quotes in a Word file, with the reason next to each one. |
| Original vs. edited | `.txt` | Every line you changed, with the original text and your edit, for an audit trail. Says "0 edited lines" if you changed nothing. |
| Anonymised text | `.txt` | Speakers become `P01`, `P02`… in order of first appearance, and any speaker name you typed is replaced by `[name]` wherever it appears in the text. Other names that are spoken (people, places) are **not** removed: read it before you share it. |
| Bilingual (Word) | `.docx` | A table with time, speaker, the original and the translation side by side, headed by the share of each language. See [Two languages](#two-languages). |
| Bilingual subtitles | `.srt` | The same cues as Subtitles (same options), with the translation under the original. |
| Language shares | `.txt` | One line per language with its minutes and percent of the speech. No names and no transcript text. |
| Markdown | `.md` | Speaker and time headings with the text under them. |
| Everything (JSON) | `.json` | All lines (with marks, language, translation and overlap flags), words with timings, and speakers, for other programs. |
| Chapters (text) | `.txt` | A `0:00 Title` list. Needs at least one chapter; see [Chapters](chapters.md). |
| Markers (DaVinci Resolve) | `.edl` | Chapters (or speaker turns) as timeline markers. Has options (below). |
| Episode folder | folder | Chapters, one audio clip per kept highlight and DaVinci Resolve markers, together in one new folder. See [Episode folder](#episode-folder). |

**Export all as CSV** (sidebar, shown when two or more projects are finished) writes one spreadsheet with a
`project` column followed by the usual columns.

## Two languages

For a recording with lines in more than one language, **Bilingual (Word)** and **Bilingual subtitles (.srt)** put the original and the
translation together, and **Language shares (text)** says how much of the recording was in each language. They are under **More formats…**
(or tick them in Settings, Saving and export) and only reuse what is already in the project:

- **Translations.** The two bilingual formats need at least one translated line (see [Translation](using-the-app.md)); until then they are greyed
  out with "Translate some lines first". A line without a translation stays in the table or the subtitles with an empty translation. They show the
  translation whatever the "translations" Text style option says, since showing it is their point. The Spreadsheet (`.csv`) already has `text`,
  `language` and `translation` columns if you prefer to work there.
- **Language shares** come from the language tag of each line (the recording's language where a line has none), counting the seconds of each line. Nothing
  is detected again, so correcting a wrong tag with **Languages** changes the shares. The same shares are in the **Info** section of the **Details** tab (shown when there are two or more languages) and
  at the top of the bilingual Word file, as `DE 12:30 (63%), EN 7:30 (37%)`.
- **Anonymised export.** Bilingual formats show the real speaker names, so they are **not** part of the anonymised export, which stays a plain text file with `P01`, `P02`… and no translation.
  Language shares contain no names or text.
- The version line (when on) is added to the bilingual Word file; Text style (clean text, pause marks, times) applies to it too. In Easy mode the menu stays Word and Print / PDF.

## Episode folder

**Export, More formats…, Episode folder** writes everything for publishing an episode in one go. You pick a folder; Cassette
makes a new folder inside it called `<project name> episode` and fills it with:

- `<name> chapters.txt`, the chapter list (only when the project has chapters, see [Chapters](chapters.md)).
- `<name> markers.edl`, DaVinci Resolve markers, with the frame rate and start timecode from the markers options.
- `clips/`, one MP3 per kept highlight, using the trimmed start and end of each highlight (see [Highlights](highlights.md)).
  If the recording can no longer be found, the clips are skipped and the message says so.

It never overwrites anything: if `<name> episode` already exists, the new folder is `<name> episode (2)`, then `(3)`. Files are written
only inside that new folder. The version line (see below) is not added, since none of these files carries it. It is off in Easy mode's fixed
menu, greyed out until there is a chapter or a highlight, and, like any export, can be the **Again:** item or the default format. While it
works, the screen reader hears "Exporting the episode…", then the result; the result has a **Show in folder** button.

## Choose which formats the menu shows

The menu lists a few formats up front (Word, plain text, Print / PDF, Large-print PDF, subtitles and meeting minutes) and keeps the
rest under **More formats…**. To change what is up front, open **Settings, Saving and export, Formats in the Export menu** and tick
the formats you use. The list is grouped like the menu and the change applies at once; it is remembered between runs and is the same for
every project.

- **Nothing is lost.** A format you do not tick is still in the menu under **More formats…**. At the bottom of that list,
  **Choose which formats to show…** takes you back to the setting.
- **Bring a format back:** tick it again, or press **Reset to the default set**.
- It only changes the menu. The `⌘E` / `Ctrl+E` shortcut, **Again: …** (the last export of the project, or the
  format chosen under "First item in the Export menu") and **Export all as CSV** work as before.
- A format that needs something from the project (chapters, highlights) still says why it is greyed out when it is listed.
- **Easy mode** keeps its own two items (Word and Print / PDF), whatever is ticked here.
- You can untick everything: the menu then shows only **More formats…**.
- With the keyboard, Tab to a checkbox and press Space; each checkbox is labelled with its format name and description, and a
  line under the list says how many are listed up front.

The **Text style…** item at the bottom of the menu is not an export; it sets how the text formats are written (below).

## The JSON file

`Everything (JSON)` has three top-level keys: `meta`, `speakers` and `segments`.

| `meta` key | Meaning |
| --- | --- |
| `schema` | The version of this layout (now `1`). It changes only when a key is renamed or removed; adding keys does not change it, so check it before relying on a layout. |
| `app`, `engine` | The versions of Cassette and of its engine that wrote the file |
| `language` | The recording's language |
| `lines`, `edited_lines` | How many lines there are and how many you changed by hand |
| `model`, `device`, `speakerDevice` | The speech model and the processors used for the run |
| `languageProb`, `languages`, `mixed`, `translated` | How sure the language check was, the seconds of speech per language when several were found, whether lines were checked one by one, and how many were translated |
| `secondsTranscribe`, `secondsSpeakers` | How long the run took |

There is no date and no file path in the file, so the same transcript always exports to identical bytes. The spreadsheet (`.csv`) and text formats have no such header by default: a header would change their columns, which scripts depend on. Their columns will not change without a note in the release notes. To trace those files too, see the version line below.

## The version line (optional)

**Export, Text style…, Add a version line** (off by default) adds one last line to Word, text, Markdown, minutes and spreadsheet exports, built from the same fields as the JSON's `meta`:

`Cassette 0.1.0 (export format 1, engine 0.1.0, language de, model small)`

- **Where it goes.** Text: the last line. Markdown: the last line in italics. Word: the page footer, above the page number. Minutes: the last paragraph. Spreadsheet: a **last row** whose `speaker` column holds `#` and whose `text` column holds the line; the other cells are empty. The header, the columns and their order and every data row are unchanged, so a script can skip the row where `speaker` is `#`. A comment row at the top was not used because it would shift the header row that importers and `pandas.read_csv` expect, and a second sheet or file does not fit in a `.csv`. Because that last row has an empty `start_seconds`, a numeric column still imports as numbers (with one empty cell).
- **What it contains.** The versions of Cassette and its engine, the export format number (`schema` in the JSON), the recording's language and the speech model of the run. No date, no file path, no speaker name and no computer or user name, so the same transcript with the same settings still exports to identical bytes.
- **What it leaves out.** Subtitles (`.srt`, `.vtt`) and markers (`.edl`) never get it, so players and editors read them as before. The JSON already has `meta`. The **anonymised** text does not get it either: it is meant to carry nothing but the coded text, and a reviewer can read the report beside it. **Export all as CSV** is not stamped because it mixes projects.
- Turning it on applies to every export until you turn it off, and is remembered.

## The anonymised export's report and key

**Anonymised text** also writes two small files next to the export, with the same name:

- `….anonymisation-report.txt`: how many speakers were replaced by codes, how many times the names you gave to speakers were removed from the text, and a list of **words that start with a capital letter inside a sentence and are still in the text** (with counts), which may be names of people, places or organisations to check by hand. It contains no real name, so it can be given to a reviewer or an ethics board. It says what it cannot tell you: it only looks for capitalised words (a name at the start of a sentence, or in lower case, is not listed), it only removes names you gave to speakers, and it is a help for checking, not proof. For German it notes that every noun is capitalised, so the list is long. English "I'm" and "I've" are not listed.
- `….anonymisation-key.txt`: which code is which speaker (`P01 = Anna`) and how often each name was removed. **Keep it apart from the data.** The app asks for a second place to save it, and suggests your Documents folder.

If saving fails, the menu shows **Export failed:** with the reason. Cancelling the save window shows nothing.

## Text style

**Export, Text style…** (see also [Verbatim, pauses and timestamps](verbatim.md)) sets how Word, text, Markdown, spreadsheet, minutes and anonymised exports are written. The
choice is remembered. Your transcript itself is never changed.

- **Hesitations:** *Keep them* (verbatim, the default) or *Remove them* (clean copy). The clean list is short and
  depends on the recording's language (German äh/ähm, English uh/um/er, French euh, Spanish eh/em); other languages are left
  untouched. A clean copy says so at the top, so nobody mistakes it for a word-for-word record. Whisper sometimes leaves
  hesitations out by itself, so *keep them* cannot guarantee a verbatim record either.
- **Mark pauses:** `(.)` about half a second, `(..)` about one second, `(...)` two seconds or more, from the word timings. Lines you edited
  keep their text without marks.
- **Show times:** turn the `[0:03]` stamps off in text, Markdown and Word. The spreadsheet always keeps its time columns.

## Languages, translations and overlap in exports

- A line in a language different from the recording's is written as `Name [fr]:` in text, Markdown and Word, and appears in the
  `language` column of the spreadsheet and in the JSON.
- An **English translation** (if the line has one) is written under the line: `→ text` in text and Word (grey italics), a quote
  block in Markdown, and the `translation` column of the spreadsheet. The anonymised export leaves translations out.
- Where two people talk at once the line is written as `Name [overlap]:` (together with the language when both apply), and the
  spreadsheet has `yes` in the `overlap` column.
- The spreadsheet's columns are: start and end (seconds), start and end (`h:mm:ss`), speaker, text, `overlap`, `language`,
  `translation`. New columns are always added at the end, so existing spreadsheet formulas keep working.

## Cues for a reader without the audio (text, Word and quotes)

The text, Word and quote-list exports say, in words, what is not settled. Each cue has its own wording, and a line with nothing to say gets
no label, so a clean recording from one file exports exactly as before.

| Cue | Where it appears | Wording |
|---|---|---|
| Unsure word (the model doubted it and you have not confirmed it) | after the speaker, on that line | `Name [wording unsure: Brandt]:` |
| Unconfirmed speaker (brought in by an added recording that you have neither matched nor named) | after the speaker | `Name [speaker unconfirmed]:` |
| Overlapping speech | after the speaker | `Name [overlap]:` (says nothing about who the speaker is) |
| Checked by a person (you pressed **Heard** on the line) | after the speaker | `Name [checked by a person]:` |
| Known gap, unknown gap, overlapping handoff between recordings | a line of its own before the first line of the later recording | `[Gap of 2 min 5 s: nothing was recorded between these two recordings.]` |
| Untranscribed rest (a 3-minute sample) | a line of its own at the end | `[Not transcribed: everything after 3:00. Only a sample was transcribed.]` |

Labels share one pair of brackets and are separated by commas (`Name [overlap, speaker unconfirmed]:`). A line you checked carries only
`checked by a person` (and its language and overlap): you vouched for it. The check goes away as soon as you change the line's wording
or its speaker, so an export never calls changed text checked. In Word the notes are shaded lines of plain text. In the quote list the labels
follow the time (`— Anna, 0:05 [wording unsure: Brandt]`) and name only the unsure words that are inside the quote. **Copy quote** in the
transcript adds the same labels. Subtitles, Markdown, the spreadsheet, JSON and the anonymised export do not carry these cues. The original-versus-edited file (the changes list) puts
`[checked by a person]` after the speaker of an edited line you pressed **Heard** on after changing it, and **Changes by you** in the Info section of the Details tab shows the same.

## The app's language in exports

The words the app writes itself follow the language you chose under Settings, Text and language: headings in the Word document and the
minutes ("Attendees", "Decisions and action items", …), the footer, the long date, "speakers", the notes about clean copies and pause marks,
and the labels in the original-vs-edited file. Speaker names, the text, and file names are never translated.

## Subtitle options

Shown when you choose Subtitles or Web subtitles. The last values you used are remembered.

- **Maximum characters per line:** 20–60, default 42. Lines break at word boundaries.
- **Maximum lines:** 1 or 2, default 2.
- **Put speaker names in subtitles:** on by default; the name starts the first cue of each speaker's turn.
- **Shift all times by (seconds):** to line subtitles up with an edited video. Times never go below zero.

A cue lasts at most 7 seconds and at least 1 second where possible. Subtitles are built from the word timings, so
they follow the speech closely.

## Marker options (DaVinci Resolve)

- **Frame rate:** 24, 25, 30, 50 or 60. **Start timecode:** default `01:00:00:00`, matching a typical Resolve timeline.
- One marker per chapter. If you haven't marked chapters, one marker per speaker turn (named with the speaker and
  the first words).

## Backup file next to the recording

If **Settings → Saving** is on, after each transcription the app writes `name.transcript.json` next to the
recording. It is a backup this app can read again, not a document to send; use Export for that.
