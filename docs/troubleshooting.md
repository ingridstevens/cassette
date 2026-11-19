# Troubleshooting

The status pill at the bottom of the sidebar opens a plain-language activity list. **Technical details** shows the
raw log, and **Open log file** shows it on disk. Include it when you report a problem (it lists file names, so
check it first).

**Not sure what is wrong?** Open **Settings, Advanced, Diagnostics and reset** and press **Check my setup**. It tests the
speech engine, the chosen model, speaker detection, memory, free disk space and the microphone, marks each as Ready,
Warning or Problem, and says what to do. **Copy diagnostics** afterwards includes the result; it has no transcript text,
file names or token, so it is safe to paste into an email.

**Export diagnostics** (same place) saves a zip for a bug report after showing you exactly what is in it; see
[diagnostics.md](diagnostics.md).

## Speaker detection won't download ("Hugging Face said no")

Almost always one of:

1. You haven't sent the short form (**Agree and access repository**) on **both** model pages (`speaker-diarization 3.1` and `segmentation 3.0`). Each page
   should say you have been granted access.
2. The token was made on the **Fine-grained** tab. Create a new one on the **Read** tab.
3. The token was mistyped or is incomplete. It starts with `hf_` and is shown only once, so make a new one if unsure.

Then use **Try again**.

## "Not enough free disk space"

Downloads need room to unpack: about 1.5× the model size plus half a gigabyte. Free some space, or choose a smaller
model (Settings → Transcription shows what each needs).

## The download stopped or says it is offline

Check your connection and use **Resume download**. Files already downloaded are kept.

## The waveform doesn't show

You'll see "Couldn't show the waveform" with a reason and **Retry**. The file may have moved or be unreadable; you can
still transcribe it. If the recording was moved, add it again.

## Wrong speakers, or too many

- Set **Number of speakers** under Options if you know it, then **Transcribe again**.
- Fix single lines from the speaker name above each line; use **Move all** if the model split one person in two.
- Very similar voices and people talking over each other are hard. Overlapping speech is flagged as **Overlap** but its words go to one person. Try an exact speaker number or a range under Options.
- Try Settings → Advanced → Processor → **Processor only** if labels look odd on a graphics chip.

## Words are wrong

- Use a bigger model (Options → Transcription model; download it under Settings → Transcription).
- Add names and jargon under **Names and special words**, then transcribe again.
- Or just fix the line: hover it and click **Edit**.
- If the language was guessed wrongly, pick it under Options.
- If part of a recording with several languages is missing or garbled, check Options, Mixed languages (Automatic is the default;
  try *Always check each speaker*, set the number of speakers, and use a bigger model: small models are weak outside English).
  For a stretch that is still wrong, set the line's language and use **Transcribe this line again in…**, or select the part on
  the waveform and transcribe it with the language chosen.
- If a translation is missing or wrong: translations are English only, are made by the same speech model, and are off when
  *English translation* is off. Use **Translate to English** in the line's language dialog to make one.

## It's slow

On a Mac with an Apple chip, open Settings, Advanced, Apple GPU models and download the **Apple GPU version** of your model size: the words are then written on
the graphics chip, several times faster (the panel shows "Apple GPU" when it is in use; a project with **Skip silence** on, or the choice *Always
the CPU*, uses the CPU instead). Without that download, and on an Intel Mac, writing the words down uses the CPU. On Windows and Linux it is meant
to use an NVIDIA card when one is usable; that has never been tried on this project. A smaller model is faster. **Skip silence** helps on
recordings with long pauses. On an Apple chip or an NVIDIA card, speaker detection uses the graphics hardware automatically.

## I transcribed again and lost my edits

**Transcribe again** replaces the transcript; the app warns first. Speaker names, edits and chapters are not
recovered. If **Saving** was on, the previous backup file next to the recording is overwritten too.

## Windows and Linux

These are not tested yet (see the [Compatibility matrix](compatibility.md)). Please report what you find. What to expect, and what to try:

- **`setup.ps1` is "not digitally signed" or "running scripts is disabled":** run `powershell -ExecutionPolicy Bypass -File .\setup.ps1`.
- **`uv`, `node` or `npm` "is not recognized" right after `winget install`:** close PowerShell and open a new window; the new window sees the new programs.
- **`node` is too old:** the app needs Node.js 22.12 or newer. `winget upgrade OpenJS.NodeJS.LTS`, then open a new window.
- **`npm ci` or `uv sync` stops with "path too long" or "access denied":** keep the folder short (`C:\lt`, not deep inside OneDrive or Documents) and
  pause real-time scanning for that folder in Windows Security while it installs. OneDrive-synced folders cause trouble with thousands of small files.
- **`uv sync --extra llm` fails with "CMake" or "Microsoft Visual C++ 14.0 or greater is required":** llama.cpp has to be compiled.
  Install the build tools (`winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`,
  several GB) and run it again. If you do not need highlights and summaries, skip the extra: everything else works without it.
- **Not enough space:** the install is several GB (Python packages including PyTorch, then Electron), plus the models. Plan for 8 GB free before you start.
- **It is very slow:** without an NVIDIA card the words are written on the processor. Choose the *Tiny*, *Base* or *Small* size
  ([Which model size?](models.md)), turn on *Skip silence*, and close other programs.

## The computer warns that the app is from an unidentified developer
Builds are not signed yet. On macOS, right-click the app, choose **Open**, then **Open** again (or allow it under
System Settings, Privacy and Security). On Windows, click **More info**, then **Run anyway**. This warning is about
the missing signature, not about what the app does; see [Privacy](privacy-and-offline.md).

## The token is rejected or a model page shows a cross
Copy the whole token (it starts with `hf_`), make sure it came from the **Read** tab, and open each page with a cross
and send its form (**Agree and access repository**). If it still says **Form not sent yet**, wait a minute and click **Check now**.

## Suggest highlights or Write a summary doesn't work
- **"The language model is not downloaded yet":** open the AI tab (Highlights or Summary) and press **Download the language model**, or use Settings, Summaries and translation. It needs one online download.
- **The tab says the language model is not part of this version:** the build you run doesn't include it (on Windows and Linux it needs llama.cpp, an opt-in install: `uv sync --extra llm` in the `engine` folder, see [Windows and Linux](#windows-and-linux)). Highlighting by hand still works.
- **It found nothing, or the summary is very short:** small models struggle with very short recordings. Try a bigger one in Settings, Summaries and translation.
- **It stops with an error:** the message is shown in the tab and the details are in the activity log (Settings, Privacy). A computer with little memory may not be able to load the larger model; use the small one.

## macOS says “Apple could not verify … is free of malware”
This happens when the project folder was copied over AirDrop or unpacked from a zip instead of cloned with `git`:
macOS marks every file as downloaded, and refuses to open the helper programs inside `app/node_modules` (for example
`index.darwin-universal.node`, or esbuild being stopped with “Killed: 9”). Click **Done** (not *Move to Trash*), then
get fresh copies:

```bash
cd app
rm -rf node_modules
npm ci
```

Cloning with `git clone` avoids it.

## Copy buttons do nothing
Fixed in the current version: the app now allows writing to the clipboard (and still never reads it). If you run an
older copy, update it, or select the text and press `⌘C` / `Ctrl+C`.
