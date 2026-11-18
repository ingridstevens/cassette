// Checks the activity-log name hiding (electron/logRedact.ts): plain asserts through esbuild, like check-source-links.mjs.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { build } from "esbuild";

const out = join(mkdtempSync(join(tmpdir(), "redact-")), "r.mjs");
await build({ entryPoints: ["electron/logRedact.ts"], outfile: out, bundle: true, format: "esm", logLevel: "silent" });
const { redactNames } = await import(pathToFileURL(out).href);

const cases = [
  ["Input: /Users/ingrid/My Recordings/Interview 2026.wav (range 0.0s-5.0s)", "Input: [file] (range 0.0s-5.0s)"],
  ["Input: C:\\Users\\Ana\\Documents\\Call with Müller.m4a", "Input: [file]"],
  ["Input: Patient Smith.mp3", "Input: [file]"],
  ["Imported 2 model(s) from /Volumes/Team Drive/models", "Imported 2 model(s) from [folder]"],
  ["ffmpeg failed: /Users/ana/Patient Smith.wav: Invalid data found", "ffmpeg failed: [file]: Invalid data found"],
  ["Saved the transcript next to the audio: /home/a/b c/d.transcript.json", "Saved the transcript next to the audio: [file]"],
  ["Couldn't save next to the audio: EACCES: permission denied, open '/Users/ana/Docs/x y.transcript.json'", "Couldn't save next to the audio: EACCES: permission denied, open '[file]'"],
  ["Couldn't open C:\\Users\\Ana\\notes\\todo", "Couldn't open [path]"],
  // known limit: a folder with a space and no file extension is only hidden up to the space (the rest is app and system folders here)
  ["Whisper model small loaded from /Users/ana/Library/Application Support/Cassette/models/x (device=cpu)", "Whisper model small loaded from [path] Support/Cassette/models/x (device=cpu)"],
  ["Language heard at the start: de (93%). “small” is weak for it", "Language heard at the start: de (93%). “small” is weak for it"],
  ["Decoded to 16 kHz mono, 24.0s. Nothing leaves this computer.", "Decoded to 16 kHz mono, 24.0s. Nothing leaves this computer."],
  ["Found 3 speakers in 4.1 seconds.", "Found 3 speakers in 4.1 seconds."],
];
for (const [input, want] of cases) assert.equal(redactNames(input), want, input);
// whatever else is true, no recognisable name survives
for (const bad of ["Interview 2026", "Müller", "Patient Smith", "My Recordings", "Team Drive", "/Users/ana"]) {
  for (const [input] of cases.slice(0, 8)) assert.ok(!redactNames(input).includes(bad), `${bad} leaked from: ${input}`);
}
console.log("log redaction: all checks pass");
