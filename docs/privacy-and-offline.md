# Privacy and offline use

## The short version

- Your recordings and transcripts **stay on your computer**. There is no account, no cloud copy and no usage
  tracking.
- The app goes online **only to download models** (from Hugging Face, and Moonshine models from Moonshine's own server) (and to check your Hugging Face token while you set up speaker
  detection). After that it works offline.

Settings → Privacy says the same in the app, and lets you see or remove your saved token:

![Settings, Privacy](screenshots/19-settings-privacy.jpg)

## What the app connects to

| When | Where | Why |
| --- | --- | --- |
| Downloading a transcription model | huggingface.co | Fetches the model files once. |
| Setting up speaker detection | huggingface.co | Checks your token (and learns your username, to show your profile address) and fetches the speaker models once. The model pages' own forms, which you send in your browser, share your Hugging Face email and username with the model's makers (pyannote). |
| Downloading the language model (for highlights and summaries) | huggingface.co | Fetches the model files once. No account or token needed. |
| Downloading Parakeet, or the translation model | huggingface.co | Fetches the model files once. No account or token needed. |
| Downloading a Moonshine model | **download.moonshine.ai** (Moonshine's own server, not Hugging Face) | Fetches that language's model files once, by the moonshine-voice package, with a checksum check. Nothing about you or your recordings is sent. |
| Pressing Send feedback (Settings, About) | **github.com**, in your browser only | Your browser opens a new GitHub issue pre-filled with the app version, your system and its memory. You can read and edit it, and nothing is sent unless you submit it. The app itself sends nothing. |
| Transcribing, exporting, everything else | nothing | Runs fully offline (the engine is started with offline mode on). |

Hugging Face may serve files from its own content hosts, and Moonshine downloads come from download.moonshine.ai; the app does not contact anything else. Links you click
in the setup steps open in your normal browser, and only huggingface.co links and the one new-issue page on github.com are allowed.

**Check it yourself.** Settings, Privacy lists each call with the file and function in the code that makes it (`engine/src/engine/models.py` for the Hugging Face downloads and the token check, `engine/src/engine/asr_moonshine.py` for Moonshine, `app/electron/main.ts` for opening pages in your browser). A test, `engine/tests/test_network_surface.py`, runs with the rest of the engine tests and fails if code that can reach the network shows up in any other file, if a new web address is written into the app, if the app starts making requests itself, or if a speech-model lookup could download instead of reading the local copy. It reads the source as text, so it cannot see an address built at run time: it is a tripwire, not an audit.

Translations into English are done by the local speech model, and translations into other languages by the local translation model (Hy-MT2); mixed-language detection uses the speech model too. Nothing is sent anywhere. Suggested highlights and summaries are written by a language model on your computer, which runs with offline mode on like the speech model. Your transcript is never sent to a service.

**Fonts and the look.** The fonts (Inter and Vazirmatn) are files inside the app; nothing is loaded from the internet to draw a screen. After a build, `npm run built:check` in `app/` fails if the built app names any remote font or CDN address. The *Soft look: Automatic* setting reads how much memory this computer has, on this computer, and sends nothing. Text size, look and contrast are stored only in the app's own settings. The font licences are in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md); how the files were checked is in [dependency-vetting.md](dependency-vetting.md).

## What is stored, and where

Inside the app's data folder (Settings → Privacy → *Open*, or Settings → Saving → *Show app folder*):

- **Projects:** names, transcripts, speaker names and your edits (`projects.json`).
- **Models:** the downloaded models (Settings → Advanced → Models folder shows the exact path and size; Settings → Privacy lists where everything is stored).
- **Hugging Face token:** encrypted with your operating system's secure storage. Only the last 4 characters are
  ever shown in the app.
- **Marks, highlights and summaries:** the Mark flag, your highlights (with the text of each) and any summary are saved with your project. The minutes, quote list, highlight clips, original-vs-edited and
  anonymised exports contain transcript text, like any export.
- **Activity log:** a text file of what the app did. It lists file names and folders, which can be sensitive
  themselves, but never the text of a transcript.

Next to a recording (only if Settings → Saving is on): `name.transcript.json`. Your audio file is never changed
or moved.

## Removing things In **Settings, Privacy, Activity log** you can switch **Keep an activity log** off (nothing more is written; existing entries stay) **Hide file and folder names in the log** (new entries show `[file]` or `[path]` instead of paths and audio or video file names the app recognises; best effort, so a name inside ordinary text can remain and the log should be read before it is shared; entries already written are not changed), and **Clear log…** to empty the file. Without a log it is harder to find out what went wrong, so leave it on unless file names are the concern.
- **Old projects:** Settings, Privacy, **Old projects** lets you choose "Ask about projects older than" 30, 90, 180 or 365 days (the default is never). The app **never deletes by itself**: when you open it and some projects are older, it lists them and asks. **Keep them for now** closes the question until you next open the app; **Delete** removes them as described under "Delete a project" and shows one receipt.
- **Delete a project:** the **×** on the project in the sidebar opens a dialog that lists what will go and what stays. **Delete** removes the
  project and its transcript and edits from the app, the backup file (`.transcript.json`) next to the recording if there is one, and the
  recording itself only if Cassette made it (a recording made with **Record**). A file you added yourself is never touched, and neither are
  files you exported or clips you saved (the app keeps no list of those) or the activity log, which lists file names. A receipt then lists each
  file as deleted, not found, could not delete or kept. It shows file names only, appears once and is not saved.
- **Remove models:** Settings → Transcription (or Summaries and translation) → Delete.
- **Remove the token:** Settings → Privacy → Remove.
- **Everything:** quit the app and delete its data folder.

## Honest limits

- These statements come from reading the code, not from an independent security audit.
- Speaker detection uses Hugging Face models that require you to accept their terms with your own account. The app
  does not redistribute them.
- Unsigned builds will show an operating-system warning the first time you open them.
- Exports contain whatever is in your transcript; check them before you send them.

See also [SECURITY.md](../SECURITY.md) and [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
