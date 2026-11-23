# Privacy and offline use

## The short version

- Your recordings and transcripts **stay on your computer**. There is no account, no cloud copy and no usage
  tracking.
- The app goes online **only to download models** (from Hugging Face, and Moonshine models from Moonshine's own server) (and to check your Hugging Face token while you set up speaker
  detection). After that it works offline.
- **One optional exception, off until you turn it on:** Settings, Privacy, **Updates**, "Tell me when a new version is out (checks github.com once a week)". With it off, the app makes no
  request of its own and About says to check the Releases page.

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
| Only if you switch on **Tell me when a new version is out** (Settings, Privacy, Updates): when you switch it on, then at most once a week while the app is open | **api.github.com** | Asks for the newest release (`/repos/ingridstevens/cassette/releases/latest`) and keeps only its version number, to say in About whether it is newer than yours. Sent: no token, no cookies, no file names; GitHub sees your internet address and "Cassette" with this app's version number in the User-Agent. Nothing is downloaded or installed. Reason: without it a security fix reaches nobody who does not look. If the check fails, the app waits a week before trying again. |
| Pressing Open the Releases page (Settings, About) | **github.com**, in your browser only | Your browser opens the Releases page. The app sends nothing, and opens only that exact address. |
| Transcribing, exporting, everything else | nothing | Runs fully offline (the engine is started with offline mode on). |

**See it in the app.** Settings, Privacy, **Network activity since the app opened** lists what the app itself has started on the network since it opened: requests from its own window to anything that is not part of the app (there should be none), model downloads and token checks it asked the engine for, and pages it opened in your browser. The weekly update check, when you have switched it on, appears there as a request to api.github.com. It says how many transcriptions ran and whether any network use was seen while one was running. It shows host names only, starts empty at every launch and keeps the last 200 entries. It is honest about its limits: it cannot see other software on your computer, and it cannot watch the speech engine's own connections (for a download it only records that the app asked), so it complements the list above and the tripwire test rather than replacing an outside check such as a firewall. The code is `app/electron/netWatch.ts`.

**Pinned versions.** Every Hugging Face download is pinned to one exact commit of its model repository (`PINS` in `engine/src/engine/models.py`), never to whatever is newest, so a changed or compromised repository cannot reach you through a later download. The two speaker-model files that are PyTorch pickles are also checked against a recorded sha256 before every load, and are refused if they differ. A model downloaded before the pin was added is at another commit and shows as not downloaded; download it again to get the pinned version.

Hugging Face may serve files from its own content hosts, and Moonshine downloads come from download.moonshine.ai; the app does not contact anything else. Links you click
in the setup steps open in your normal browser, and only huggingface.co links, the one new-issue page and the Releases page on github.com are allowed.

**Check it yourself.** Settings, Privacy lists each call with the file and function in the code that makes it (`engine/src/engine/models.py` for the Hugging Face downloads and the token check, `engine/src/engine/asr_moonshine.py` for Moonshine, `app/electron/ipc/updates.ts` for the optional update check, `app/electron/ipc/diagnostics.ts` for opening pages in your browser). A test, `engine/tests/test_network_surface.py`, runs with the rest of the engine tests and fails if code that can reach the network shows up in any other file, if a new web address is written into the app, if the app starts making requests itself (the one request in `updates.ts` is the single allowed exception, and the test checks it is one request to one host, reachable only through the weekly rule that is false while the switch is off), if a speech-model lookup could download instead of reading the local copy, or if any download or lookup could use the newest commit instead of the pinned one. It reads the source as text, so it cannot see an address built at run time: it is a tripwire, not an audit.

Translations into English are done by the local speech model, and translations into other languages by the local translation model (Hy-MT2); mixed-language detection uses the speech model too. Nothing is sent anywhere. Suggested highlights and summaries are written by a language model on your computer, which runs with offline mode on like the speech model. Your transcript is never sent to a service.

**Fonts and the look.** The fonts (Inter and Vazirmatn) are files inside the app; nothing is loaded from the internet to draw a screen. After a build, `npm run built:check` in `app/` fails if the built app names any remote font or CDN address. The *Soft look: Automatic* setting reads how much memory this computer has, on this computer, and sends nothing. Text size, look and contrast are stored only in the app's own settings. The font licences are in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md); how the files were checked is in [dependency-vetting.md](dependency-vetting.md).

## What is stored, and where

For a data-protection review, [data-evidence.md](data-evidence.md) maps every data kind to its location, who can read it, how to delete it and which network calls exist, with the source file for each statement.

Inside the app's data folder (Settings → Privacy → *Open*, or Settings → Saving → *Show app folder*):

- **Projects:** names, transcripts, speaker names and your edits (`projects.json`).
- **Models:** the downloaded models (Settings → Advanced → Models folder shows the exact path and size; Settings → Privacy lists where everything is stored).
- **Hugging Face token:** encrypted with your operating system's secure storage. Only the last 4 characters are
  ever shown in the app.
- **Marks, highlights and summaries:** the Mark flag, your highlights (with the text of each) and any summary are saved with your project. The minutes, quote list, highlight clips, original-vs-edited and
  anonymised exports contain transcript text, like any export.
- **Activity log:** a text file of what the app did. It lists file names and folders, which can be sensitive
  themselves, but never the text of a transcript.

- **Project backups:** only if you choose **Back up project…**: one `.cassette-backup` file where you save it, holding the project and a copy of each of its recordings (so it is as sensitive as all of them). Restoring one copies the recordings into `recordings` in the data folder. No network is used.

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
