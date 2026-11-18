// The file types the installer registers with the OS (electron-builder.yml) must be the ones the app opens (AUDIO_EXT in electron/main.ts).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const main = readFileSync("electron/main.ts", "utf8");
const inCode = [...main.match(/const AUDIO_EXT = new Set\(\[(.*?)\]\)/)[1].matchAll(/"\.(\w+)"/g)].map((m) => m[1]).sort();
const yml = readFileSync("electron-builder.yml", "utf8");
const inYml = yml.match(/fileAssociations:\s*\n\s*- \{ ext: \[(.*?)\]/)?.[1].split(",").map((e) => e.trim()).sort();
assert.ok(inYml, "electron-builder.yml has no fileAssociations");
assert.deepEqual(inYml, inCode, "fileAssociations extensions differ from AUDIO_EXT");
assert.match(main, /app\.on\("open-file"/, "main.ts must listen for the macOS open-file event");
console.log("file associations ok");
