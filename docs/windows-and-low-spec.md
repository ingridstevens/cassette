# Windows and weaker computers: ideas and status

Goal: Cassette should be pleasant on a Windows laptop with 4 to 8 GB of memory and no graphics card. Nobody has timed it
on one yet, so every speed idea below is untested until someone runs it (see the [Compatibility matrix](compatibility.md)).

## Done

- **CPU thread budget** (`engine/src/engine/threads.py`): on the processor the speech model and the speaker model use all
  cores on small computers and all but one (at most 8) on bigger ones, so the app and Windows stay responsive.
- **Low-memory warning** on the start sheet: if the chosen size plus speaker detection will probably not fit in the memory
  left after Windows (about 2.5 GB), the app says so and names a size that fits, before a run fails halfway.
- **Smaller default on first launch**: with under 6 GB of memory a new install starts on the Base size instead of Small.
- **Memory note in Settings, Transcription**: sizes that probably will not fit are marked, as on the start sheet.
- **Lite look**: at 4 GB or less the app drops fade effects and the decorative pulse (progress animations stay).
- **Check my setup** (Settings, Advanced): engine, model, speakers, memory, disk and microphone in one list, also added to Copy diagnostics.
- **The speech and speaker models are no longer in memory together** (when the language checker is a separate small model, which is the default): the engine loads the small checker, finds the speakers, frees the speaker model, and only then loads the speech model. Untested for real memory use: the order is covered by tests with stand-in models; nobody has measured the saving on a real 4 GB computer.
- The browser preview (`npm run dev`) can pretend to have 4 GB: add `?lowmem` to the address.

## Next (small, safe)

- Time a real run on a low-end Windows laptop and replace the guessed speeds in `app/src/estimate.ts`.

## Ideas (bigger, need testing on Windows)

- **Skip silence by default on CPU-only computers** (`--vad`): less audio to read, so faster, at a small accuracy cost.
- **Distilled Whisper models** for English-only recordings.
- **Chunked processing** with a memory ceiling, so a 3-hour recording does not need all its audio in memory at once.
- **DirectML or Vulkan** speech engines for AMD and Intel graphics (whisper.cpp), as an optional engine like MLX on Mac.
- **A Windows installer** built in CI and tested on a clean machine (configured, never run).
- **Windows polish**: high-DPI check at 125% and 150%, long paths and OneDrive folders, antivirus slowing the first start.
