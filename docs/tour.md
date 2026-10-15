# A tour of the app

A look at every main screen, in the order you meet them. Each picture links to the page that explains it in detail.
The pictures show a short German interview with three speakers.

## 1. First launch

The first screen asks for one download. After it, the app works without internet.
Speaker names are optional and can wait. → [Getting started](getting-started.md)

![First launch with a download button and an optional speaker step](screenshots/02-first-launch.jpg)

Telling speakers apart needs a free Hugging Face account. The app opens one step at a time, ticks off what is done, and has buttons that open the right pages and copy what the forms ask for. → [Setting up speaker detection](getting-started.md#setting-up-speaker-detection)

![The four-step speaker setup](screenshots/03-speaker-setup.jpg)

## 2. Add a recording and press Start

Drop files on the window, or click **Add recordings**. Each file becomes a project in the left column.
→ [Before you start transcribing](using-the-app.md#before-you-start-transcribing)

![The drop zone shown when there are no projects](screenshots/01-empty.jpg)

Before it starts, the app shows an estimate of the time and lets you choose languages, model size and number of speakers. **Change settings** opens these questions.

![Ready to transcribe, with language, model and speaker choices](screenshots/04-start-sheet.jpg)

## 3. Read, listen, correct

The transcript is in the middle, the player and waveform below it, and the **Speakers** tab on the right shows who talked how much.
Click a name to rename it everywhere. → [Reading and playing](using-the-app.md#reading-and-playing), [Speakers](using-the-app.md#speakers)

![The finished transcript](screenshots/05-transcript.jpg)

Hover a line for its tools: **Mark**, **Chapter**, **Split**, **Edit**, **Copy quote**. → [Fixing and annotating lines](using-the-app.md#fixing-and-annotating-lines)

![Tools shown when hovering over a line](screenshots/06-line-actions.jpg)

Click the speaker's name above a line to give it to someone else, or to open the language of that line.

![The speaker menu on a line](screenshots/07-speaker-menu.jpg)

Mixed-language recordings: each line has a language, and you can translate it or transcribe it again in another language. → [Languages in a recording](using-the-app.md#languages-in-a-recording)

![The language dialog for one line](screenshots/08-language-dialog.jpg)

## 4. Check the doubtful words

Words the model was unsure of have a dotted underline. **Review N unsure words** plays each one in its sentence and lets you fix it with `Enter`.
→ [Reviewing unsure words](using-the-app.md#reviewing-unsure-words)

![Review mode: one unsure word, with its sentence and the audio](screenshots/09-review-mode.jpg)

Search the transcript, or **Replace** a misheard word everywhere. → [Search and replace](highlights.md#search-and-replace)

![The find and replace bar](screenshots/10-search-replace.jpg)

## 5. Options and information

The **Options** tab holds what applies the next time you transcribe the project: languages, model, number of speakers, translation, hesitations, silence, vocabulary.
→ [Options (per project)](using-the-app.md#options-per-project)

![The Options tab](screenshots/11-options.jpg)

The **Info** tab says what file this is, which models ran and how long each step took.

![The Info tab](screenshots/12-info.jpg)

## 6. Highlights and summary

Select words and choose **Highlight this passage**. → [Highlights](highlights.md)

![Selecting words in a line](screenshots/14-highlight-selection.jpg)

Let the local language model suggest more (with a reason for each), keep the ones you like, and save each as an audio clip.

![The Highlights tab with a kept highlight and a suggestion](screenshots/15-highlights-panel.jpg)

**Write a summary** adds topics, decisions and action items, which also go into the meeting minutes. → [Summary](highlights.md#summary)

![A summary with topics, decisions and action items](screenshots/16-summary.jpg)

## 7. Export

**Export** (`⌘E` / `Ctrl+E`) writes Word, text, subtitles, a spreadsheet and more. → [Exporting](exporting.md)

![The Export menu](screenshots/13-export-menu.jpg)

## 8. Settings

**Settings** (`⌘,` / `Ctrl+,`) is where you choose how the computer's chips are used...

![Settings: performance](screenshots/17-settings-performance.jpg)

...and download or delete models. Deleting is safe: the app asks you to download it again when needed.

![Settings: storage and models](screenshots/18-settings-storage.jpg)

The **Privacy** page says what stays on your computer and what goes online, and shows the last four characters of your saved token.
→ [Privacy and offline use](privacy-and-offline.md)

![Settings: privacy](screenshots/19-settings-privacy.jpg)
