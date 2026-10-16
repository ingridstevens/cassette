# FAQ

**Can two languages be in one recording?** Yes, within limits. Leave the language on auto-detect: with Mixed languages on *Automatic* (the
default), the app checks each speaker's language and, if it finds several, detects the language separately for each speaker's turn.
Every line is tagged with its language and can show an English translation. On one test recording (three speakers; Spanish, English, German
and French; 29 seconds; small model) it found all four languages, the three speakers and correct translations. One word was repeated at a
turn boundary, a 0.2-second turn was skipped, and one-word turns by different people stayed on one line (use **Split**). That is one short
recording, not a guarantee. It cannot follow a switch inside one turn, short turns can be misdetected, and it relies on speaker detection
finding the turns. If a line is wrong, set its language (click its language tag) and use **Transcribe this line again in…**.

**How do I check the words the model wasn't sure of?** Use **Review N unsure words** in the toolbar (see [Using the app](using-the-app.md)): one word at a time, with the audio.

**Can the app translate?** Into English only (a limit of the speech model), as an extra line under text in another language. Turn it on or off
under Options, English translation, or use **Translate to English** on a single line. There is no translation into German, French or Spanish.

**Can I use the app in German, French or Spanish?** Yes. Settings, Text and language. By default it matches your computer.

**Is it free?** Yes. The app is released into the public domain; models and libraries keep their own licences
([notices](../THIRD_PARTY_NOTICES.md)).

**Is my audio uploaded?** No. The internet is used only to download models. See [Privacy](privacy-and-offline.md).

**What happens if I quit the app while it is transcribing?** The transcription stops and is not resumed. The speech engine ends as soon as the
app does (checked from the command line: closing its output ends it within seconds), nothing is saved from the unfinished run, and after you
reopen the app the recording is back as "Not transcribed", so you start again. Waiting recordings in the queue are forgotten too. On macOS the
red window button does **not** quit the app: the engine keeps working in the background, but with the window closed there is nowhere to
deliver the result, so the finished transcript is lost as well. Leave the window open (minimise it instead) until the transcription is done.
This comes from reading the code and a command-line test; it has not been tried in the packaged desktop app.

**Why is it slow?** On a Mac, transcription runs on the processor. Use a smaller model, or see [Troubleshooting](troubleshooting.md).

**Where are my files?** Projects and models are in the app's data folder (Settings, Privacy, What is stored where, Show). Your recording is never moved or changed.

**Why does speaker detection need an account?** The speaker models are gated on Hugging Face. You can skip it, or
have someone else set it up once and [import the models folder](getting-started.md).

**Does the AI that suggests highlights and writes summaries send my recording anywhere?** No. It is a small language model that runs on your computer, downloaded once
from huggingface.co; after that it works offline. See [Highlights](highlights.md#the-language-model) and [Privacy](privacy-and-offline.md).

**Can I save a highlight as audio, as text, or both?** Both, as separate actions. **Save clip** on one highlight, or **Save N audio clips…** for all of them, writes audio
(one file per highlight, in a folder you choose). **Export, Highlights and marked lines (text)** or **Highlights (Word)** writes the text of all highlights in one file.

**The suggested highlights are not good. What can I do?** Try a bigger language model, such as Qwen3 4B or Qwen2.5 7B (Settings, Summaries and translation), or highlight the passages yourself by
selecting words. The small model can find fewer highlights on a very short recording. It cannot make things up in your transcript, because every suggestion is checked against the real words.

**Can I replace a word everywhere?** Yes: type it in the find box, press **Replace**, and use **Replace all**. Changed lines can be put back one by one. See [Highlights](highlights.md#search-and-replace).
