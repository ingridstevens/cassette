# Accessibility of the exports (audit for issue #200)

Last audited: 2026-11-19. Checked structurally (the files are opened and inspected in tests). Nothing here was tried with a real screen reader.

## There is no HTML export

Cassette writes no HTML file. The engine (`engine/src/engine/export.py`) produces Word, text, Markdown, subtitles, CSV, JSON and EDL. Print / PDF
prints the app window itself (`printToPDF`, with `app/src/styles/print.css`). The share card is a PNG drawn on a canvas. So the HTML points of the
issue (lang, landmarks, click-to-seek, audio player) do not apply. If an HTML export is ever added it must be self-contained and meet them.

## Word files

| Check | Result |
| --- | --- |
| Document title (File > Info) | Fixed: set in all four Word files (transcript, bilingual, minutes, highlights). |
| Document language | Fixed: set from the transcript language (English if none), so screen readers pick the right voice. |
| Title is a real title | Fixed: transcript and bilingual files use the Title style. Minutes and highlights already used it. |
| Chapters are headings | Fixed: chapter bands in the transcript file are Heading 2, so a screen reader can jump between them. |
| Table header rows | Minutes action table (earlier, #284) and bilingual table: flagged as header rows. |
| Speaker name and time as text | Yes. Speakers are told apart by name, never by colour alone. |

Tests: `engine/tests/test_export.py` (`test_every_word_export_declares_its_title_and_language` and neighbours).

## Remains

- Speaker names in the transcript Word file are bold paragraphs, not headings (a heading per line would flood the navigation pane). Needs a design decision.
- The share card canvas now has a translated text alternative (title, talk time per speaker, the quote when one is on the card; `app/src/shareCardA11y.test.ts`). Not heard with a real screen reader. The rest of the share card dialog is still English only.
- Plain Word files still carry the default author name from the library.
- Needs real assistive technology: Word with NVDA/JAWS/VoiceOver, and the printed PDF's reading order and tags.
