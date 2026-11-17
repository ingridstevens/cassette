# Windows and weaker computers: ideas and status

Goal: Cassette should be pleasant on a Windows laptop with 4 to 8 GB of memory and no graphics card. Nobody has timed it
on one yet, so every speed idea below is untested until someone runs it.

## Done

- **CPU thread budget** (`engine/src/engine/threads.py`): on the processor the speech model and the speaker model use all
  cores on small computers and all but one (at most 8) on bigger ones, so the app and Windows stay responsive.
- **Low-memory warning** on the start sheet: if the chosen size plus speaker detection will probably not fit in the memory
  left after Windows (about 2.5 GB), the app says so and names a size that fits, before a run fails halfway.
- The browser preview (`npm run dev`) can pretend to have 4 GB: add `?lowmem` to the address.

## Next (small, safe)

- Pick the default model from memory on first run (Base under 6 GB, Small otherwise) instead of always Small.
- Show the memory warning in Settings, Transcription too, next to the model list.
- A "Lite look" that turns off animations and shadows on computers with 4 GB or less (the Soft look is already automatic).
- Time a real run on a low-end Windows laptop and replace the guessed speeds in `app/src/estimate.ts`.

## Ideas (bigger, need testing on Windows)

- **Skip silence by default on CPU-only computers** (`--vad`): less audio to read, so faster, at a small accuracy cost.
- **Never hold both models in memory**: finish the words, free the model, then load the speaker model.
- **Distilled Whisper models** for English-only recordings.
- **Chunked processing** with a memory ceiling, so a 3-hour recording does not need all its audio in memory at once.
- **DirectML or Vulkan** speech engines for AMD and Intel graphics (whisper.cpp), as an optional engine like MLX on Mac.
- **A Windows installer** built in CI and tested on a clean machine (configured, never run).
- **Windows polish**: high-DPI check at 125% and 150%, long paths and OneDrive folders, antivirus slowing the first start.
