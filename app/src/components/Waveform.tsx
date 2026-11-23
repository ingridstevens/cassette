import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import HoverPlugin from "wavesurfer.js/dist/plugins/hover.esm.js";
import { useT } from "../i18n";
import { fmt, PALETTE, Part, Result } from "../types";
import { locate, timelineLength } from "../sources";
import { RangeStop } from "../playRange";
import { clampZoom, followScroll, maxZoom, pxPerSec, stepZoom, zoomLabel } from "../waveZoom";
import "../styles/project.css";

export interface WaveformHandle { seek(t: number, play?: boolean): void; toggle(): void; pause(): void; skip(delta: number): void; setRate(rate: number): void; playRange(start: number, end: number): void; markClip(start: number, end: number): void; zoomIn(): void; zoomOut(): void; zoomFit(): void }
/** A highlight whose two ends are draggable handles on the waveform. */
export interface TrimRange { id: string; start: number; end: number }
interface Props {
  /** The recordings in order, on one timeline (see sources.ts). Everything this component says or is told is in seconds on that timeline; one recording is shown and played at a time, and a seek into another one switches to it. */
  parts: Part[]; result: Result | null;
  /** The recording on screen changed (its index in `parts`). */ onActive?(index: number): void;
  onTime(t: number): void; onSelection(range: [number, number] | null): void; onPlaying?(p: boolean): void; onDuration?(d: number): void;
  trim?: TrimRange | null; onTrim?(id: string, start: number, end: number): void;
  /** Opens the file chooser for a recording that was moved (shown when the file cannot be found). */ onLocate?(): void;
  /** Easy mode shows no zoom controls and always the whole recording. */ easy?: boolean;
}

/** Waveform colours come from the current look (CSS variables on <html>) so the looks can recolour them. */
function waveColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return { waveColor: v("--wave", "#c3b8de"), progressColor: v("--wave-progress", "#e8467c"), cursorColor: v("--wave-progress", "#e8467c") };
}

type State = { kind: "loading" } | { kind: "ready" } | { kind: "error"; message: string } | { kind: "missing" };

const Waveform = forwardRef<WaveformHandle, Props>(({ parts, result, onActive, onTime, onSelection, onPlaying, onDuration, trim, onTrim, onLocate, easy = false }, ref) => {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurfer | null>(null);
  const regions = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const cb = useRef({ onTime, onSelection, onPlaying, onDuration, onTrim, onActive });
  cb.current = { onTime, onSelection, onPlaying, onDuration, onTrim, onActive };
  /** Where a "play from selection" ends; any pause, seek, skip or click on the waveform forgets it. */
  const stop = useRef(new RangeStop());
  const [duration, setDuration] = useState(0);
  // which recording is on screen, and what to do as soon as it has loaded (a seek or a play that crossed the join)
  const [active, setActive] = useState(0);
  const idx = Math.min(active, parts.length - 1);
  const part = parts[idx];
  const path = part.path, offset = part.offset;
  const live = useRef({ parts, idx }); live.current = { parts, idx };
  const after = useRef<{ local: number; play: boolean; stopAt?: number } | null>(null);
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

  /** Go to a moment on the timeline: in this recording at once, or in another one after it has loaded. */
  const go = (time: number, play: boolean, stopAt?: number) => {
    stop.current.clear();
    const { parts: ps, idx: at } = live.current;
    const target = locate(ps, time);
    const w = ws.current;
    const stopLocal = stopAt === undefined ? undefined : Math.min(stopAt - ps[target.index].offset, ps[target.index].duration > 0 ? ps[target.index].duration : Infinity);
    if (target.index !== at) { after.current = { local: target.local, play, stopAt: stopLocal }; setActive(target.index); return; }
    if (!w || !w.getDuration()) return;
    w.setTime(target.local); setFollow(true); reveal(target.local);
    if (stopLocal !== undefined && stopLocal > target.local) stop.current.arm(stopLocal);
    if (play) w.play();
  };
  useImperativeHandle(ref, () => ({
    seek: (t, play = true) => go(t, play),
    playRange: (a, b) => { if (b > a) go(a, true, b); },
    toggle: () => { stop.current.clear(); ws.current?.playPause(); },
    markClip: (a, b) => { const lo = a - offset, hi = Math.min(b - offset, duration || Infinity); if (hi > lo && lo >= 0) regions.current?.addRegion({ start: lo, end: hi, color: "rgba(124, 92, 255, 0.14)" }); },
    setRate: (r) => { ws.current?.setPlaybackRate(r, true); },
    pause: () => { stop.current.clear(); if (ws.current?.isPlaying()) ws.current.pause(); },
    skip: (d) => {
      const w = ws.current;
      if (!w || !w.getDuration()) return;
      const total = timelineLength(parts) || w.getDuration();
      go(Math.min(Math.max(0, offset + w.getCurrentTime() + d), total), w.isPlaying());
    },
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
    cb.current.onActive?.(idx);
    // The window never decodes the recording: the main process makes the waveform (cached) and the player streams the file from media://.
    window.api.peaks(path).then((r) => {
      if (dead) return;
      if (!r) { setState({ kind: "missing" }); return; }
      w = WaveSurfer.create({ container: box.current!, height: 64, ...waveColors(), cursorWidth: 3, autoScroll: false, autoCenter: false, hideScrollbar: true, barWidth: 3, barGap: 2, barRadius: 3, plugins: [rp, HoverPlugin.create({ lineColor: "#6a45e8", lineWidth: 1, labelBackground: "#1a1a22", labelColor: "#fff", labelSize: "12px", formatTimeCallback: (sec: number) => fmt(Math.max(0, sec)) })], url: window.api.mediaUrl(path), peaks: [r.peaks], duration: r.duration });
      regions.current = rp; ws.current = w; setPeakCount(r.peaks.length);
      rp.enableDragSelection({ color: "rgba(124, 92, 255, 0.14)" });
      w.on("timeupdate", (t) => { cb.current.onTime(offset + t); if (stop.current.tick(t)) w?.pause(); if (follow.current && w?.isPlaying()) reveal(t); });
      // the end of one recording plays on into the next
      w.on("finish", () => { const { parts: ps, idx: at } = live.current; if (at < ps.length - 1) { after.current = { local: 0, play: true }; setActive(at + 1); } });
      w.on("scroll", (_a, _b, left) => {
        lanesIn.current?.style.setProperty("transform", `translateX(${-left}px)`);
        const room = view.current.factor * view.current.width - view.current.width;
        setScrollFrac(room > 0 ? Math.min(1, Math.max(0, left / room)) : 0);
      });
      w.on("play", () => { setFollow(true); cb.current.onPlaying?.(true); });
      w.on("pause", () => { stop.current.clear(); cb.current.onPlaying?.(false); });
      w.on("interaction", () => { stop.current.clear(); setFollow(true); });
      w.on("ready", (d) => {
        if (dead) return;
        setState({ kind: "ready" }); setDuration(d); cb.current.onDuration?.(timelineLength(live.current.parts) || d);
        const next = after.current; after.current = null;
        if (next) { w?.setTime(Math.min(next.local, d)); setFollow(true); if (next.stopAt !== undefined && next.stopAt > next.local) stop.current.arm(next.stopAt); if (next.play) void w?.play(); cb.current.onTime(offset + next.local); }
        else cb.current.onTime(offset);
      });
      w.on("error", fail);
    }).catch(fail);
    rp.on("region-created", (r) => {
      if (r.id.startsWith("seg-") || r.id.startsWith("trim-")) return;
      rp.getRegions().filter((x) => !x.id.startsWith("seg-") && !x.id.startsWith("trim-") && x !== r).forEach((x) => x.remove());
      // a drag-selection is announced only here (when the drag ends); "region-updated" fires only for later drags and resizes
      cb.current.onSelection([r.start + offset, r.end + offset]);
    });
    const changed = (r: { id: string; start: number; end: number }) => {
      if (r.id.startsWith("trim-")) cb.current.onTrim?.(r.id.slice(5), r.start + offset, r.end + offset);
      else if (!r.id.startsWith("seg-")) cb.current.onSelection([r.start + offset, r.end + offset]);
    };
    rp.on("region-updated", changed);
    rp.on("region-removed", (r) => { if (!r.id.startsWith("seg-") && !r.id.startsWith("trim-")) cb.current.onSelection(null); });

    return () => { dead = true; cb.current.onPlaying?.(false); w?.destroy(); };
  }, [path, attempt, idx, offset]);

  // The highlight being trimmed: one region with drag handles on both ends (the middle does not move). It follows the highlight when a button moves an end.
  const trimId = trim?.id, trimStart = trim?.start, trimEnd = trim?.end;
  useEffect(() => {
    const rp = regions.current;
    if (!rp || state.kind !== "ready") return;
    const old = rp.getRegions().filter((x) => x.id.startsWith("trim-"));
    const mine = trimId ? old.find((x) => x.id === "trim-" + trimId) : undefined;
    old.filter((x) => x !== mine).forEach((x) => x.remove());
    if (trimId === undefined || trimStart === undefined || trimEnd === undefined) return;
    // the highlight is on the timeline; only a highlight inside the recording on screen can be trimmed here
    const ts = trimStart - offset, te = trimEnd - offset;
    if (ts < -0.001 || (duration > 0 && te > duration + 0.001)) { mine?.remove(); return; }
    if (!mine) rp.addRegion({ id: "trim-" + trimId, start: ts, end: te, drag: false, resize: true, color: "rgba(232, 70, 124, 0.18)", minLength: 0.1 });
    else if (Math.abs(mine.start - ts) > 0.001 || Math.abs(mine.end - te) > 0.001) mine.setOptions({ start: ts, end: te });
  }, [trimId, trimStart, trimEnd, state.kind, offset, duration]);

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

  // a recording was added while this one is on screen: the whole timeline is longer now
  const whole = timelineLength(parts);
  useEffect(() => { if (state.kind === "ready") cb.current.onDuration?.(whole || duration); }, [whole]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = duration || part.duration || result?.duration || 0;
  const several = parts.length > 1;
  return (
    <div className="pv-wave">
      <div className="pv-wave-canvas" ref={box} role="img" aria-label={t("Audio waveform. Drag across it to pick a part.")} />
      {total > 0 && result && (
        <div className="pv-lanes" aria-hidden>
          <div className="pv-lanes-in" ref={lanesIn} style={{ width: `${factor * 100}%` }}>
          {result.segments.filter((sg) => !several || (sg.end > offset && sg.start < offset + total)).map((sg, i) => (
            <i key={i} style={{ left: `${(Math.max(0, sg.start - offset) / total) * 100}%`, width: `${Math.max(0, ((Math.min(sg.end - offset, total) - Math.max(0, sg.start - offset)) / total) * 100)}%`, background: PALETTE[Math.max(0, result.speakers.indexOf(sg.speaker)) % PALETTE.length] }} />
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
          <span><b>{several ? t("Part {n}, “{name}”, can't be found.", { n: idx + 1, name: part.name }) : t("The recording can't be found.")}</b> {t("It was moved, renamed or deleted. Its transcript is still here.")}</span>
          <span className="pv-wave-actions">
            {onLocate && idx === 0 && <button type="button" className="btn small" onClick={onLocate}>{t("Locate recording…")}</button>}
            <button type="button" className="btn small" onClick={() => setAttempt((a) => a + 1)}>{t("Check again")}</button>
          </span>
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
