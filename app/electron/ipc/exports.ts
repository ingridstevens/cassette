/** Everything that writes a transcript, clips or an image where the person chooses: export, episode folder, Copy as Markdown, PDF, clips, share card. */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { app, dialog, shell } from "electron";
import { EngineEvent, runEngine } from "../engine-client";
import { withTempJson } from "../tempJson";
import { EXPORT_FORMATS, episodeFolder, episodeInput, safeName } from "../validate";
import { handle, type IpcContext } from "./typed";

export function registerExports({ mediaFile, knownMedia }: IpcContext) {
  // One audio file per highlight, written into a folder the user picks (created if needed), then shown in the file manager.
  handle("export-clips", async (_e, input: unknown, clips: { start: number; end: number; speaker?: string }[], format: unknown, name: unknown) => {
    if (!mediaFile(input) || !Array.isArray(clips) || !clips.length || !clips.every((c) => Number.isFinite(c?.start) && Number.isFinite(c?.end) && c.end > c.start)) return { ok: false, error: "Unsupported or missing recording" };
    const r = await dialog.showOpenDialog({ title: "Choose where to save the clips", properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { cancelled: true };
    const fmt = format === "wav" || format === "m4a" ? format : "mp3";
    const dir = path.join(r.filePaths[0], `${String(name || "Highlights").replace(/[\\/:*?"<>|]/g, "-")} highlights`);
    const res = await withTempJson(clips.map((c) => ({ start: c.start, end: c.end, speaker: String(c.speaker ?? "") })), (tmp) => runEngine(randomUUID(), ["export-clips", input, dir, "--clips", tmp, "--format", fmt], {}, () => {})) as EngineEvent | null;
    if (res?.type !== "done") return { ok: false, error: String(res?.message ?? "The export failed.").slice(0, 300) };
    const paths = res.paths as string[];
    if (paths[0]) shell.showItemInFolder(paths[0]);
    return { ok: true, count: paths.length, path: dir };
  });

  // Saves a PNG the renderer drew (the share card). `dataUrl` must be a PNG data URL.
  handle("save-image", async (_e, dataUrl: unknown, defaultName: unknown) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) return { ok: false, error: "Not a PNG image." };
    const r = await dialog.showSaveDialog({ defaultPath: `${String(defaultName || "share-card").replace(/[\\/:*?"<>|]/g, "-")}.png`, filters: [{ name: "PNG image", extensions: ["png"] }] });
    if (r.canceled || !r.filePath) return { cancelled: true };
    try { fs.writeFileSync(r.filePath, Buffer.from(dataUrl.slice(22), "base64")); return { ok: true, path: r.filePath }; }
    catch (e) { return { ok: false, error: String((e as Error).message) }; }
  });

  handle("export", async (_e, payload: unknown, format: string, defaultName: string) => {
    if (typeof format !== "string" || !EXPORT_FORMATS.has(format)) return { ok: false, error: "Unsupported export format." };
    const ext = ({ chapters: "txt", quotes: "txt", highlights: "docx", changes: "txt", redacted: "txt", minutes: "docx", "combined-csv": "csv", bilingual: "docx", "bilingual-srt": "srt", languages: "txt" } as Record<string, string>)[format] ?? format; // the engine format id differs from the file extension for chapters
    const r = await dialog.showSaveDialog({ defaultPath: `${safeName(defaultName, "Transcript")}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (r.canceled || !r.filePath) return { cancelled: true };
    const args = ["--format", format];
    if (format === "redacted") { // the key maps P01 back to real names, so it goes to a second place, away from the anonymised text
      const k = await dialog.showSaveDialog({
        title: "Where should the key go? Keep it apart from the data",
        defaultPath: path.join(app.getPath("documents"), `${path.basename(r.filePath, path.extname(r.filePath))}.anonymisation-key.txt`),
        filters: [{ name: "TXT", extensions: ["txt"] }],
      });
      if (k.canceled || !k.filePath) return { cancelled: true };
      args.push("--key-output", k.filePath);
    }
    const res = await withTempJson(payload, (tmp) => runEngine(randomUUID(), ["export", tmp, r.filePath!, ...args], {}, () => {}));
    return res?.type === "done" ? { ok: true, path: r.filePath } : { ok: false, error: String(res?.message ?? "The export failed.").slice(0, 300) };
  });

  // One-button episode export: chapters, a clip per kept highlight and DaVinci Resolve markers, all in one NEW folder inside a folder the user picks.
  // The window never supplies a path: the parent comes from the dialog, the recording must be a known one, and nothing existing is overwritten (a taken folder name gets " (2)").
  let lastEpisode = "";
  handle("export-episode", async (_e, payload: unknown, input: unknown, name: unknown) => {
    const ep = episodeInput(payload);
    if (typeof ep === "string") return { ok: false, error: ep };
    const r = await dialog.showOpenDialog({ title: "Choose where to save the episode folder", properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { cancelled: true };
    let dir = "";
    for (let n = 1; n <= 999 && !dir; n++) {
      const d = path.join(r.filePaths[0], episodeFolder(name, n));
      try { fs.mkdirSync(d); dir = d; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") return { ok: false, error: String((e as Error).message).slice(0, 300) }; }
    }
    if (!dir) return { ok: false, error: "The folder could not be created." };
    const base = safeName(typeof name === "string" ? name.trim() : "", "Episode");
    const step = async (format: string, file: string) => {
      const res = await withTempJson(payload, (tmp) => runEngine(randomUUID(), ["export", tmp, path.join(dir, file), "--format", format], {}, () => {})) as EngineEvent | null;
      if (res?.type !== "done") throw new Error(String(res?.message ?? "The export failed.").slice(0, 300));
    };
    try {
      if (ep.chapters) await step("chapters", `${base} chapters.txt`);
      await step("edl", `${base} markers.edl`);
      let clips = 0;
      const withClips = ep.clips.length > 0 && knownMedia(input);
      if (withClips) {
        const res = await withTempJson(ep.clips, (tmp) => runEngine(randomUUID(), ["export-clips", input as string, path.join(dir, "clips"), "--clips", tmp, "--format", "mp3"], {}, () => {})) as EngineEvent | null;
        if (res?.type !== "done") throw new Error(String(res?.message ?? "The clips could not be saved.").slice(0, 300));
        clips = (res.paths as string[]).length;
      }
      lastEpisode = dir;
      return { ok: true, path: dir, chapters: ep.chapters, clips, clipsSkipped: ep.clips.length > 0 && !withClips };
    } catch (err) { lastEpisode = dir; return { ok: false, error: String((err as Error).message).slice(0, 300) }; }
  });
  // "Show in folder" for the result: opens the folder the last episode export made (remembered here, never taken from the window).
  handle("show-episode-folder", () => { if (lastEpisode && fs.existsSync(lastEpisode)) void shell.openPath(lastEpisode); });

  // "Copy as Markdown": the engine writes the same Markdown as the .md export to a private temp file; the renderer puts the text on the clipboard.
  handle("export-text", async (_e, payload: unknown) => {
    const dir = path.join(app.getPath("userData"), "tmp"); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const out = path.join(dir, `${randomUUID()}.md`);
    try {
      const res = await withTempJson(payload, (tmp) => runEngine(randomUUID(), ["export", tmp, out, "--format", "md-copy"], {}, () => {}));
      return res?.type === "done" ? { ok: true, text: fs.readFileSync(out, "utf-8") } : { ok: false, error: String(res?.message ?? "The export failed.").slice(0, 300) };
    } catch (err) { return { ok: false, error: String((err as Error).message) }; }
    finally { fs.rmSync(out, { force: true }); }
  });

  // Prints the open transcript to a PDF through the print stylesheet (styles/print.css), which hides everything but the transcript.
  handle("print-pdf", async (e, name: unknown, large: unknown) => {
    const base = String(typeof name === "string" && name.trim() ? name : "Transcript").replace(/[\\/:*?"<>|]/g, "-");
    const r = await dialog.showSaveDialog({ defaultPath: `${base}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (r.canceled || !r.filePath) return { cancelled: true };
    const root = `document.documentElement.classList.toggle("print-large", ${large === true}); document.documentElement.classList.add("printing")`;
    try {
      await e.sender.executeJavaScript(root);
      // The transcript only keeps the lines near the viewport in the page; "printing" makes it draw them all, and it says so with data-print-ready.
      await e.sender.executeJavaScript(`new Promise((done) => { const t0 = Date.now(); const check = () => document.documentElement.dataset.printReady || Date.now() - t0 > 10000 ? requestAnimationFrame(() => done(true)) : setTimeout(check, 50); check(); })`);
      const pdf = await e.sender.printToPDF({ pageSize: "A4", printBackground: false });
      fs.writeFileSync(r.filePath, pdf);
      return { ok: true, path: r.filePath };
    } catch (err) { return { ok: false, error: String((err as Error).message) }; }
    finally { await e.sender.executeJavaScript(`document.documentElement.classList.remove("print-large", "printing")`).catch(() => {}); }
  });
}
