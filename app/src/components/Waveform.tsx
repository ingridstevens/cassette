import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import HoverPlugin from "wavesurfer.js/dist/plugins/hover.esm.js";
import { useT } from "../i18n";
import { fmt, PALETTE, Result } from "../types";
import { RangeStop } from "../playRange";
import { clampZoom, followScroll, maxZoom, pxPerSec, stepZoom, zoomLabel } from "../waveZoom";
import "../styles/project.css";

export interface WaveformHandle { seek(t: number, play?: boolean): void; toggle(): void; pause(): void; skip(delta: number): void; setRate(rate: number): void; playRange(start: number, end: number): void; markClip(start: number, end: number): void; zoomIn(): void; zoomOut(): void; zoomFit(): void }
/** A highlight whose two ends are draggable handles on the waveform. */
export interface TrimRange { id: string; start: number; end: number }
interface Props {
  path: string; result: Result | null;
  onTime(t: number): void; onSelection(range: [number, number] | null): void; onPlaying?(p: boolean): void; onDuration?(d: number): void;
  trim?: TrimRange | null; onTrim?(id: string, start: number, end: number): void;
  /** Easy mode shows no zoom controls and always the whole recording. */ easy?: boolean;
}

/** Waveform colours come from the current look (CSS variables on <html>) so the looks can recolour them. */
function waveColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return { waveColor: v("--wave", "#c3b8de"), progressColor: v("--wave-progress", "#e8467c"), cursorColor: v("--wave-progress", "#e8467c") };
}

type State = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string } | { kind: "missing" };

const Waveform = forwardRef<WaveformHandle, Props>(({ path, result, onTime, onSelection, onPlaying, onDuration, trim, onTrim, easy = false }, ref) => {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurfer | null>(null);
  const regions = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const cb = useRef({ onTime, onSelection, onPlaying, onDuration, onTrim });
  cb.current = { onTime, onSelection, onPlaying, onDuration, onTrim };
  /** Where a "play from selection" ends; any pause, seek, skip or click on the waveform forgets it. */
  const stop = useRef(new RangeStop());
  const [duration, setDuration] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // zoom: a factor over "the whole recording across the width" (1 = fit); the waveform scrolls sideways while zoomed
  const lanesIn = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [peakCount, setPeakCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [scrollFrac, setScrollFrac] = useState(0);
  const [following, setFollowing] = useState(true);
  const [zoomNote, setZoomNote] = useState("");
  const follow = useRef(true);
  const pendingScroll = useRef<number | null>(null);
  const setFollow = (v: boolean) => { follow.current = v; setFollowing(v); };
  const total0 = duration;
  const max = maxZoom(width, total0, peakCount);
  const factor = easy ? 1 : clampZoom(zoom, max);
  const view = useRef({ factor: 1, width: 0, duration: 0 });
  view.current = { factor, width, duration };
  /** Scroll (never animated) so that time `time` is in view. */
  const reveal = (time: number) => {
    const w = ws.current, v = view.current;
    if (!w || v.factor <= 1 || !(v.duration > 0)) return;
    const pps = (v.factor * v.width) / v.duration;
    const to = followScroll(time, pps, w.getScroll(), v.width);
    if (to !== null) w.setScroll(to);
  };
  const zoomTo = (next: number) => {
    const w = ws.current;
    const f = clampZoom(next, max);
    if (!w || !(total0 > 0)) return;
    if (f === factor) { if (next > f) setZoomNote(t("Waveform zoom is at its limit")); return; }
    // keep what is under the playhead (or, when it is out of view, the middle of the view) where it is
    const oldPps = (factor * width) / total0, newPps = (f * width) / total0;
    const cur = w.getCurrentTime();
    const left = w.getScroll();
    const inView = cur * oldPps >= left && cur * oldPps <= left + width;
    const anchor = inView ? cur : (left + width / 2) / oldPps;
    pendingScroll.current = anchor * newPps - width / 2;
    setFollow(true);
    setZoom(f);
    setZoomNote(f > 1 ? t("Waveform zoom {level}", { level: zoomLabel(f) }) : t("Waveform shows the whole recording"));
  };
  useEffect(() => { if (easy) setZoom(1); }, [easy]);

  useImperativeHandle(ref, () => ({
    seek: (t, play = true) => { stop.current.clear(); const w = ws.current; if (w && w.getDuration()) { w.setTime(t); setFollow(true); reveal(t); if (play) w.play(); } },
    playRange: (a, b) => { const w = ws.current; if (!w || !w.getDuration() || !(b > a)) return; w.setTime(a); setFollow(true); reveal(a); stop.current.arm(b); w.play(); },
    toggle: () => { stop.current.clear(); ws.current?.playPause(); },
    markClip: (a, b) => { regions.current?.addRegion({ start: a, end: b, color: "rgba(124, 92, 255, 0.14)" }); },
    setRate: (r) => { ws.current?.setPlaybackRate(r, true); },
    pause: () => { stop.current.clear(); if (ws.current?.isPlaying()) ws.current.pause(); },
    skip: (d) => { stop.current.clear(); const w = ws.current; if (w && w.getDuration()) { w.setTime(Math.min(Math.max(0, w.getCurrentTime() + d), w.getDuration())); setFollow(true); reveal(w.getCurrentTime()); } },
    zoomIn: () => { if (!easy) zoomTo(stepZoom(factor, 1, max) === factor ? factor + 1 : stepZoom(factor, 1, max)); },
    zoomOut: () => { if (!easy) zoomTo(stepZoom(factor, -1, max)); },
    zoomFit: () => { if (!easy) zoomTo(1); },
  }));

  useEffect(() => {
    let dead = false;
    setState({ kind: "loading" });
    const rp = RegionsPlugin.create();
    ws.current = null; regions.current = null; stop.current.clear();
    let w: WaveSurfer | null = null;
    const fail = (e: unknown) => { if (!dead) setState({ kind: "error", message: String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "") }); };
    // The window never decodes the recording: the main process makes the waveform (cached) and the player streams the file from media://.
    window.api.peaks(path).then((r) => {
      if (dead) return;
      if (!r) { setState({ kind: "missing" }); return; }
      w = WaveSurfer.create({ container: box.current!, height: 64, ...waveColors(), cursorWidth: 3, autoScroll: false, autoCenter: false, hideScrollbar: true, barWidth: 3, barGap: 2, barRadius: 3, plugins: [rp, HoverPlugin.create({ lineColor: "#6a45e8", lineWidth: 1, labelBackground: "#1a1a22", labelColor: "#fff", labelSize: "12px", formatTimeCallback: (sec: number) => fmt(Math.max(0, sec)) })], url: window.api.mediaUrl(path), peaks: [r.peaks], duration: r.duration });
      regions.current = rp; ws.current = w; setPeakCount(r.peaks.length);
      rp.enableDragSelection({ color: "rgba(124, 92, 255, 0.14)" });
      w.on("timeupdate", (t) => { cb.current.onTime(t); if (stop.current.tick(t)) w?.pause(); if (follow.current && w?.isPlaying()) reveal(t); });
      w.on("scroll", (_a, _b, left) => {
        lanesIn.current?.style.setProperty("transform", `translateX(${-left}px)`);
        const room = view.current.factor * view.current.width - view.current.width;
        setScrollFrac(room > 0 ? Math.min(1, Math.max(0, left / room)) : 0);
      });
      w.on("play", () => { setFollow(true); cb.current.onPlaying?.(true); });
      w.on("pause", () => { stop.current.clear(); cb.current.onPlaying?.(false); });
      w.on("interaction", () => { stop.current.clear(); setFollow(true); });
      w.on("ready", (d) => { if (!dead) { setState({ kind: "ready" }); setDuration(d); cb.current.onDuration?.(d); } });
      w.on("error", fail);
    }).catch(fail);
    rp.on("region-created", (r) => {
      if (r.id.startsWith("seg-") || r.id.startsWith("trim-")) return;
      rp.getRegions().filter((x) => !x.id.startsWith("seg-") && !x.id.startsWith("trim-") && x !== r).forEach((x) => x.remove());
      // a drag-selection is announced only here (when the drag ends); "region-updated" fires only for later drags and resizes
      cb.current.onSelection([r.start, r.end]);
    });
    const changed = (r: { id: string; start: number; end: number }) => {
      if (r.id.startsWith("trim-")) cb.current.onTrim?.(r.id.slice(5), r.start, r.end);
      else if (!r.id.startsWith("seg-")) cb.current.onSelection([r.start, r.end]);
    };
    rp.on("region-updated", changed);
    rp.on("region-removed", (r) => { if (!r.id.startsWith("seg-") && !r.id.startsWith("trim-")) cb.current.onSelection(null); });

    return () => { dead = true; cb.current.onPlaying?.(false); w?.destroy(); };
  }, [path, attempt]);

  // The highlight being trimmed: one region with drag handles on both ends (the middle does not move). It follows the highlight when a button moves an end.
  const trimId = trim?.id, trimStart = trim?.start, trimEnd = trim?.end;
  useEffect(() => {
    const rp = regions.current;
    if (!rp || state.kind !== "ready") return;
    const old = rp.getRegions().filter((x) => x.id.startsWith("trim-"));
    const mine = trimId ? old.find((x) => x.id === "trim-" + trimId) : undefined;
    old.filter((x) => x !== mine).forEach((x) => x.remove());
    if (trimId === undefined || trimStart === undefined || trimEnd === undefined) return;
    if (!mine) rp.addRegion({ id: "trim-" + trimId, start: trimStart, end: trimEnd, drag: false, resize: true, color: "rgba(232, 70, 124, 0.18)", minLength: 0.1 });
    else if (Math.abs(mine.start - trimStart) > 0.001 || Math.abs(mine.end - trimEnd) > 0.001) mine.setOptions({ start: trimStart, end: trimEnd });
  }, [trimId, trimStart, trimEnd, state.kind]);

  // the width of the strip (it changes with the window and the drawer)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el); setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // apply the zoom; the strip scrolls sideways while zoomed
  useEffect(() => {
    const w = ws.current;
    if (!w || state.kind !== "ready" || !(width > 0) || !(total0 > 0)) return;
    w.zoom(pxPerSec(factor, width, total0));
    const to = pendingScroll.current; pendingScroll.current = null;
    const done = () => { if (factor <= 1) { w.setScroll(0); return; } if (to !== null) w.setScroll(Math.max(0, to)); else if (follow.current) reveal(w.getCurrentTime()); };
    done();
    const id = requestAnimationFrame(done); // the strip is made wider on the next frame
    return () => cancelAnimationFrame(id);
  }, [factor, width, total0, state.kind]);
  useEffect(() => { if (factor <= 1) { lanesIn.current?.style.setProperty("transform", "none"); setScrollFrac(0); } }, [factor]);
  // a scroll the person makes themselves (wheel, trackpad, touch) stops the following; playing, seeking and the buttons start it again
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const off = () => { if (view.current.factor > 1) setFollow(false); };
    el.addEventListener("wheel", off, { passive: true }); el.addEventListener("touchmove", off, { passive: true });
    return () => { el.removeEventListener("wheel", off); el.removeEventListener("touchmove", off); };
  }, []);

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
          <div className="pv-lanes-in" ref={lanesIn} style={{ width: `${factor * 100}%` }}>
          {result.segments.map((sg, i) => (
            <i key={i} style={{ left: `${(sg.start / total) * 100}%`, width: `${Math.max(0, ((sg.end - sg.start) / total) * 100)}%`, background: PALETTE[Math.max(0, result.speakers.indexOf(sg.speaker)) % PALETTE.length] }} />
          ))}
          </div>
        </div>
      )}
      {state.kind === "ready" && !easy && max > 1 && (
        <div className={"pv-zoom" + (following ? "" : " unfollowed")} role="group" aria-label={t("Zoom the waveform in, out, or back to the whole recording")}>
          <button type="button" className="pv-zbtn" aria-label={t("Zoom out")} title={t("Zoom out")} disabled={factor <= 1} onClick={() => zoomTo(stepZoom(factor, -1, max))}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg></button>
          <button type="button" className="pv-zbtn" aria-label={t("Zoom in")} title={t("Zoom in")} disabled={factor >= max} onClick={() => zoomTo(stepZoom(factor, 1, max))}><svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" /></svg></button>
          {factor > 1 && <>
            <span className="pv-zlevel" dir="ltr">{zoomLabel(factor)}</span>
            <button type="button" className="pv-zbtn txt pv-fit" aria-label={t("Show the whole recording")} title={t("Show the whole recording")} onClick={() => zoomTo(1)}>{t("Fit")}</button>
            <input type="range" className="pv-zscroll" min={0} max={1000} value={Math.round(scrollFrac * 1000)} aria-label={t("Scroll the zoomed waveform")} dir="ltr"
              onChange={(e) => { const w = ws.current; if (!w) return; setFollow(false); w.setScroll((Number(e.target.value) / 1000) * (factor * width - width)); }} />
            {!following && <button type="button" className="pv-zbtn txt" aria-label={t("Follow the playhead")} title={t("Follow the playhead")} onClick={() => { setFollow(true); reveal(ws.current?.getCurrentTime() ?? 0); }}>{t("Follow")}</button>}
          </>}
        </div>
      )}
      <span className="pv-sr" role="status" aria-live="polite" aria-atomic="true">{zoomNote}</span>
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
