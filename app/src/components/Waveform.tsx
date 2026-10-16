import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { useT } from "../i18n";
import { PALETTE, Result } from "../types";
import "../styles/project.css";

export interface WaveformHandle { seek(t: number): void; toggle(): void; pause(): void; skip(delta: number): void; setRate(rate: number): void; markClip(start: number, end: number): void }
interface Props {
  path: string; result: Result | null;
  onTime(t: number): void; onSelection(range: [number, number] | null): void; onPlaying?(p: boolean): void; onDuration?(d: number): void;
}

/** Waveform colours come from the current look (CSS variables on <html>) so the looks can recolour them. */
function waveColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return { waveColor: v("--wave", "#c3b8de"), progressColor: v("--wave-progress", "#e8467c"), cursorColor: v("--wave-progress", "#e8467c") };
}

const MIME: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", flac: "audio/flac", ogg: "audio/ogg", opus: "audio/ogg",
  aac: "audio/aac", mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska", webm: "video/webm",
};
type State = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string } | { kind: "missing" };

const Waveform = forwardRef<WaveformHandle, Props>(({ path, result, onTime, onSelection, onPlaying, onDuration }, ref) => {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurfer | null>(null);
  const regions = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const cb = useRef({ onTime, onSelection, onPlaying, onDuration });
  cb.current = { onTime, onSelection, onPlaying, onDuration };
  const [duration, setDuration] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useImperativeHandle(ref, () => ({
    seek: (t) => { const w = ws.current; if (w && w.getDuration()) { w.setTime(t); w.play(); } },
    toggle: () => ws.current?.playPause(),
    markClip: (a, b) => { regions.current?.addRegion({ start: a, end: b, color: "rgba(124, 92, 255, 0.14)" }); },
    setRate: (r) => { ws.current?.setPlaybackRate(r, true); },
    pause: () => { if (ws.current?.isPlaying()) ws.current.pause(); },
    skip: (d) => { const w = ws.current; if (w && w.getDuration()) w.setTime(Math.min(Math.max(0, w.getCurrentTime() + d), w.getDuration())); },
  }));

  useEffect(() => {
    let dead = false;
    setState({ kind: "loading" });
    const rp = RegionsPlugin.create();
    const w = WaveSurfer.create({ container: box.current!, height: 46, ...waveColors(), cursorWidth: 2, barWidth: 3, barGap: 3, barRadius: 3, plugins: [rp] });
    regions.current = rp; ws.current = w;
    rp.enableDragSelection({ color: "rgba(124, 92, 255, 0.14)" });
    w.on("timeupdate", (t) => cb.current.onTime(t));
    w.on("play", () => cb.current.onPlaying?.(true));
    w.on("pause", () => cb.current.onPlaying?.(false));
    w.on("ready", (d) => { if (!dead) { setState({ kind: "ready" }); setDuration(d); cb.current.onDuration?.(d); } });
    w.on("error", (e) => { if (!dead) setState({ kind: "error", message: String(e instanceof Error ? e.message : e) }); });
    rp.on("region-created", (r) => {
      if (r.id.startsWith("seg-")) return;
      rp.getRegions().filter((x) => !x.id.startsWith("seg-") && x !== r).forEach((x) => x.remove());
      // a drag-selection is announced only here (when the drag ends); "region-updated" fires only for later drags and resizes
      cb.current.onSelection([r.start, r.end]);
    });
    const changed = (r: { id: string; start: number; end: number }) => { if (!r.id.startsWith("seg-")) cb.current.onSelection([r.start, r.end]); };
    rp.on("region-updated", changed);
    rp.on("region-removed", (r) => { if (!r.id.startsWith("seg-")) cb.current.onSelection(null); });

    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    window.api.readAudio(path)
      .then((bytes) => { if (dead) return; if (!bytes) { setState({ kind: "missing" }); return; } return w.loadBlob(new Blob([bytes as BlobPart], { type: MIME[ext] ?? "audio/mpeg" })); })
      .catch((e) => { if (!dead) setState({ kind: "error", message: String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "") }); });
    return () => { dead = true; cb.current.onPlaying?.(false); w.destroy(); };
  }, [path, attempt]);

  useEffect(() => {
    const apply = () => ws.current?.setOptions(waveColors());
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-look", "data-mode", "data-contrast"] });
    return () => mo.disconnect();
  }, []);

  const total = duration || result?.duration || 0;
  return (
    <div className="pv-wave">
      <div className="pv-wave-canvas" ref={box} role="img" aria-label={t("Audio waveform. Drag across it to pick a part.")} />
      {total > 0 && result && (
        <div className="pv-lanes" aria-hidden>
          {result.segments.map((sg, i) => (
            <i key={i} style={{ left: `${(sg.start / total) * 100}%`, width: `${Math.max(0, ((sg.end - sg.start) / total) * 100)}%`, background: PALETTE[Math.max(0, result.speakers.indexOf(sg.speaker)) % PALETTE.length] }} />
          ))}
        </div>
      )}
      {state.kind === "loading" && (
        <div className="pv-wave-overlay" role="status"><div className="pv-skeleton" aria-hidden>{Array.from({ length: 60 }, (_, i) => <i key={i} style={{ height: `${22 + Math.abs(Math.sin(i * 1.7) * 52)}%`, animationDelay: `${i * 40}ms` }} />)}</div><span className="pv-sr">{t("Reading audio…")}</span></div>
      )}
      {state.kind === "missing" && (
        <div className="pv-wave-overlay pv-wave-error" role="alert">
          <span><b>{t("The recording can't be found.")}</b> {t("It was moved, renamed or deleted. Its transcript is still here.")}</span>
          <button type="button" className="btn small" onClick={() => setAttempt((a) => a + 1)}>{t("Check again")}</button>
        </div>
      )}
      {state.kind === "error" && (
        <div className="pv-wave-overlay pv-wave-error" role="alert">
          <span><b>{t("Couldn't show the waveform.")}</b> {state.message} {t("You can still transcribe this file.")}</span>
          <button type="button" className="btn small" onClick={() => setAttempt((a) => a + 1)}>{t("Retry")}</button>
        </div>
      )}
    </div>
  );
});
export default Waveform;
