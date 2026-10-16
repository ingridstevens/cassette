# Feature plan: multilingual and live transcription

Written for Radio Connection Berlin (many languages, Apple Silicon Macs). Decisions below were settled in a Q&A with Ingrid; each is marked **Decided**.

## Context

- Today: Whisper only (faster-whisper on CPU, MLX on Apple GPU), whole-file jobs, English-only translation, model choices spread over the start sheet, Settings > Performance and Settings > Storage.
- Hardware: **Decided** – Apple Silicon Macs. No GPU-only models (e.g. Voxtral needs 16 GB NVIDIA via vLLM).
- Not all screenshot models are speech recognisers. Tiny Aya and HY-MT are text models; Moonshine, Parakeet and Whisper are speech models.

## Features

### F1. Model catalog (one picker, grouped by job) — **Decided**
Settings > Models replaces the split between Performance (Apple GPU copies) and Storage.
Sections: *Writing the words down* (Whisper sizes, Parakeet v3, Moonshine), *Live*, *Translation* (HY-MT2).
Each row: languages covered, speed, download size, licence badge, Download/Delete. The Apple GPU build of a Whisper size is a detail of that row, not a second list.
The start sheet shows only downloaded models plus a "Best for this language" default.
New engine data lives in one registry in `engine/src/engine/models.py` (id, kind, repo, languages, quality-per-language, licence, bytes), so the UI never hardcodes it.

### F2. New engines — **Decided**
- **Parakeet v3** (NVIDIA, Apache-2.0): fast, European languages only. Believed to be 25 European languages, which does *not* include Arabic or Farsi (to verify against the model card before shipping; the screenshot says "English-focused").
- **Moonshine** (streaming, small): English MIT; other languages non-commercial. Shown with a "Non-commercial" badge and a one-line confirmation before download.
- **HY-MT2-1.8B** (Tencent, translation): GGUF via the existing llama.cpp backend, so it joins the language-model machinery. Covers Persian, Arabic, Russian, German, French, English, Hebrew, Urdu, Hindi, Turkish, Ukrainian and more; not Swahili, Hausa, Amharic, Yoruba.
All three go through the dependency-vetting check before being added to `engine/pyproject.toml`.

### F3. Translation into a chosen language — **Decided**
The "English translation" checkbox becomes "Translate lines into: [language]" per project (default English). English stays on Whisper's translate task when HY-MT2 isn't downloaded; other targets need HY-MT2 and the picker says so.

### F4. Language-fit check — **Decided: pause and ask**
After language detection in the first seconds, compare the detected language with the chosen model's quality table. If the model is weak for it (e.g. Farsi on `small`):
- File jobs: pause before transcribing and show a card: "Farsi detected. *small* is weak here. Download *medium* (1.5 GB)?" with **Download and continue** / **Continue anyway** / **Cancel**.
- Live mode: never pause (audio is flowing); show the same suggestion as a banner, and offer to re-transcribe the saved audio with the better model after stop.

Built for file jobs (live mode still to do): the engine loads the model, detects the language on the first 30 s and, only when it is at least 60% sure and the model is below that language's floor (`engine/fit.py`), emits a `fit` event and exits before speaker detection. The app shows a card; any choice starts the run again (`--accept-fit` for "continue anyway"). It only runs when the language is set to automatic. A mixed-language recording is judged by its first 30 s only.

### F5. Streaming transcript into the field — **Decided: ships first**
Words appear in the transcript while a file is still being transcribed, instead of after the whole job. Engine emits `partial` events per finished segment (new type in `protocol.py`, handled in `electron/engine-client.ts`). Speaker labels arrive when diarization finishes; until then lines are unlabeled and visibly draft.

### F6. Live recording with live transcription — **Decided: mic only, speakers after stop**
Pick a microphone, record, see a draft transcript (chunked Whisper/Moonshine, roughly 1–3 s delay, recent words may be rewritten). On stop the audio is saved as a project, speaker detection runs on the saved file, and the draft is replaced by the full result. No system-audio capture in v1.

## Order of work

1. F5 streaming partial events (foundation for F6; smallest visible win).
2. F1 model registry + catalog UI (with Whisper only, nothing new yet).
3. F4 language-fit check (needs the registry's per-language quality).
4. F6 live recording.
5. F2 Parakeet and Moonshine adapters; F3 + HY-MT2.

## Open, implementer's call
Chunk length and overlap for live mode; exact quality table values (derive from Whisper's published per-language WER); how long Moonshine/Parakeet must be tested on Radio Connection's audio before they become "recommended".
