# Which model size should I pick?

Bigger models make fewer mistakes and run slower. On a Mac, Whisper runs on the processor, not the graphics chip (on Windows and Linux it is meant to use an NVIDIA card when one is usable, which is untested). Sizes below are
approximate downloads (Windows shows slightly smaller numbers; see [file sizes](using-the-app.md#file-sizes)).

| Size | Download | Use it when |
| --- | --- | --- |
| tiny | about 75 MB | Trying the app, very old computer. Many mistakes. |
| base | about 145 MB | Quick drafts of clear speech. |
| small | about 480 MB | **Default** (on computers with under 6 GB of memory the first launch starts with *base* instead). Good balance for most interviews and meetings. |
| medium | about 1.5 GB | Accents, background noise, names. |
| large-v3-turbo | about 1.6 GB | Near the best quality, faster than large-v3. |
| large-v3 | about 3 GB | Best quality, slowest. |

## Models for each job

Three different models do three jobs. In Settings, **Transcription** turns speech into text (Whisper, Parakeet or Moonshine: pick an engine, then press **Use** on a downloaded model). **Speakers** sets up speaker detection. **Summaries and translation** chooses the language model for highlights and summaries, and the translation model.
The model that only finds the language defaults to **tiny** (a few letters of output don't need a big model); change it under Settings, Advanced, Language checker. If tiny isn't downloaded, the transcription model is used instead.
Every model has **Use** and **Delete** buttons. Deleting the one in use offers to switch to another downloaded model at the same time.

## Language model (highlights and summaries)

Suggesting highlights and writing summaries uses a separate, small language model, not one of the sizes above. It runs on this computer
and is a one-time download of 1 to 4.3 GB, depending on which one you pick. See [Highlights](highlights.md#the-language-model).

## Apple GPU versions (Apple Silicon Macs)

On a Mac with an Apple chip, each size also has an **Apple GPU version** that writes the words down on the graphics chip. It is a separate
download of about the same size (Settings, Advanced, Apple GPU models), not gated, no account. Download the one for the size you use. With **Automatic** the
app then uses it by itself, and falls back to the CPU engine when it isn't downloaded, when you chose *Always the CPU*, or when a project
has **Skip silence** on (that feature isn't available on the graphics chip).

In our tests (the small model, Apple Silicon): 58 seconds of English took about 15 s on the CPU engine and about 1 s on the graphics chip once
loaded; a 29-second recording with three speakers and four languages took 27 s in total on the CPU engine and 11 s on the graphics chip,
with the same languages and speakers found. Results can differ slightly (we saw one line lose its `¿`). These are timings from one Mac and a
few recordings, not a benchmark.

Tips: for recordings with several languages use at least *medium* if you can (small models are weak outside English); pick the language yourself when you know it (it is more reliable than auto-detect); add unusual names and terms
under Options, vocabulary; change the size any time in Settings. Speed depends on your computer; I have not measured
it for each size here.

## Other speech engines (Apple Silicon Macs)

Besides Whisper, Settings, Transcription can offer two more engines (the Parakeet and Moonshine choices). Both run on the Apple graphics chip, both are fast, and
neither can tell which language is spoken or translate by itself: if you have a Whisper model downloaded (the smallest one is enough)
the app uses it for those two jobs, otherwise you choose the language yourself.

| Engine | Download | Languages | Use it when |
| --- | --- | --- | --- |
| **Parakeet v3** (NVIDIA, CC-BY-4.0) | about 2.5 GB, from Hugging Face | 25 European languages: German, English, French, Spanish, Italian, Dutch, Polish, Russian, Ukrainian and more. **Not** Arabic or Persian. | You record in European languages and want speed. In our test it matched Whisper on the German and English sample interviews and wrote 58 seconds of audio in about 4 seconds. |
| **Moonshine** (Moonshine AI, MIT; needs macOS 15 or newer) | 32 MB to 270 MB per language, from **download.moonshine.ai**, not Hugging Face | One model per language: English, German, Spanish, Arabic, Japanese, Vietnamese, Chinese, Tagalog | You want small and quick, or live drafts. It gives a time per sentence, so word times (and where a speaker change falls inside a sentence) are estimates. |

Only Moonshine's *streaming* models are offered: those are MIT-licensed in every language. Its older non-streaming models for other
languages than English are non-commercial and are left out.

If the first seconds of a recording are in a language the model you picked is weak at, the app stops before doing any work and
suggests a better model (see the language list under Settings, Transcription: "Reliable in N of M languages").

## Translation into other languages

Whisper can only translate into English. The **translation model Hy-MT2 1.8B** (Tencent, Apache-2.0, about 1 GB, from Hugging Face)
translates lines into 38 languages, including Arabic, Persian, Russian, Turkish, Hebrew, Hindi, Urdu and Ukrainian (not Swahili, Hausa,
Amharic or Yoruba). Download it under Settings, Summaries and translation, then pick the language under *Translate into* in a project's options.
It is a small model: read the translations as help, not as final text.

## Sharing models with a team

Models only need to be downloaded once per team, not once per person.

1. On a computer that already has the models, open **Settings, Advanced, Models folder** and choose **Show in Finder** (or File Explorer). Copy that folder to a shared drive or a USB stick.
2. On the other computer, open **Settings, Transcription** and choose **Use a models folder…**. Pick the folder you copied.

The app **copies** the models it finds into its own models folder, so the shared folder can be disconnected afterwards. Nothing is downloaded, and nobody needs a Hugging Face account for models that are imported this way.
