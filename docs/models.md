# Which model size should I pick?

Bigger models make fewer mistakes and run slower. On a Mac, Whisper runs on the processor, not the graphics chip (on Windows and Linux it is meant to use an NVIDIA card when one is usable, which is untested). Sizes below are
approximate downloads (Windows shows slightly smaller numbers; see [file sizes](using-the-app.md#file-sizes)).

| Size | Download | Use it when |
| --- | --- | --- |
| tiny | about 75 MB | Trying the app, very old computer. Many mistakes. |
| base | about 145 MB | Quick drafts of clear speech. |
| small | about 480 MB | **Default.** Good balance for most interviews and meetings. |
| medium | about 1.5 GB | Accents, background noise, names. |
| large-v3-turbo | about 1.6 GB | Near the best quality, faster than large-v3. |
| large-v3 | about 3 GB | Best quality, slowest. |

## Language model (highlights and summaries)

Suggesting highlights and writing summaries uses a separate, small language model, not one of the sizes above. It runs on this computer
and is a one-time download of 1 to 4.3 GB, depending on which one you pick. See [Highlights](highlights.md#the-language-model).

## Apple GPU versions (Apple Silicon Macs)

On a Mac with an Apple chip, each size also has an **Apple GPU version** that writes the words down on the graphics chip. It is a separate
download of about the same size (Settings, Performance), not gated, no account. Download the one for the size you use. With **Automatic** the
app then uses it by itself, and falls back to the CPU engine when it isn't downloaded, when you chose *Always the CPU*, or when a project
has **Skip silence** on (that feature isn't available on the graphics chip).

In our tests (the small model, Apple Silicon): 58 seconds of English took about 15 s on the CPU engine and about 1 s on the graphics chip once
loaded; a 29-second recording with three speakers and four languages took 27 s in total on the CPU engine and 11 s on the graphics chip,
with the same languages and speakers found. Results can differ slightly (we saw one line lose its `¿`). These are timings from one Mac and a
few recordings, not a benchmark.

Tips: for recordings with several languages use at least *medium* if you can (small models are weak outside English); pick the language yourself when you know it (it is more reliable than auto-detect); add unusual names and terms
under Options, vocabulary; change the size any time in Settings. Speed depends on your computer; I have not measured
it for each size here.
