# Verbatim, pauses and timestamps

Three things control how literally a transcript follows the speech. Two are applied when you export, one when you transcribe.

| You want | Where | Setting |
| --- | --- | --- |
| Hesitations ("um", "äh") written down | When transcribing | Options, **Write hesitations down** |
| Hesitations kept or removed in a file | When exporting | Export, **Text style…**, *Hesitations* |
| Pauses marked | When exporting | Export, **Text style…**, *Mark pauses* |
| Times shown or hidden | When exporting | Export, **Text style…**, *Show times* |

## 1. Getting hesitations into the transcript

Speech models tend to leave hesitations out. **Write hesitations down** (Options, per project) gives the model a short sample sentence full of
hesitations in the recording's language, which nudges it to write them down. Turn it on *before* you transcribe; it cannot add what was
already left out. It works for German, English, French and Spanish. If the language is on auto-detect, the app first detects it so the sample
matches. It is a nudge, not a guarantee: some hesitations will still be missing, so a transcript made this way is closer to verbatim but
is not a certified word-for-word record.

## 2. Keeping or removing them in a file

**Export, Text style…, Hesitations**:

- **Keep them (verbatim)** is the default. The text is exported as it is stored.
- **Remove them (clean copy)** drops a short list of hesitations for the recording's language (German äh, ähm, öh, hm; English uh, um, er, hm;
  French euh, heu, hum; Spanish eh, em, mmm). Other languages are left unchanged. The file says at the top that it is an edited copy, so it
  cannot be mistaken for a verbatim record. The list is deliberately short: words that are also real words are not removed (for example the German
  "er" is kept, because it means "he").

Applies to Word, text, Markdown, spreadsheet, minutes and the anonymised export. Your stored transcript is never changed.

## 3. Pauses

**Mark pauses** inserts `(.)` for a gap of about half a second, `(..)` for about one second and `(...)` for two seconds or more, using the
word timings. Lines you edited by hand are left without marks, because their word timings no longer match the text. The file says what the marks mean.

## 4. Timestamps

**Show times** switches the `[0:03]` time stamps in text, Markdown and Word on or off. The spreadsheet always keeps its time columns, and
subtitles and markers always keep their times.

## For research or legal use

Keep hesitations on both steps, mark pauses if you need them, keep times, and use **Original vs. edited** to document your own changes. State in
your methods how the transcript was made, and check it against the audio: the model can still mishear or drop words. A clean copy is for reading,
not for the record.
