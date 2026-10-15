import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Result } from "../types";
import { fileSlug, pickQuotes, roundPercents, talkShares, wrapText } from "./shareCardLib";
import "../styles/share.css";

type StyleKey = "sunset" | "lilac" | "peach";
const STYLES: Record<StyleKey, { label: string; stops: [string, string, string] }> = {
  sunset: { label: "Sunset", stops: ["#ffd6c4", "#ffb0cc", "#d3c0ff"] },
  lilac: { label: "Lilac", stops: ["#e4d8ff", "#f2c9ee", "#ffd9d0"] },
  peach: { label: "Peach", stops: ["#ffe6d2", "#ffc9b8", "#ffb3c8"] },
};
const SIZE = 1080;
const INK = "#2a2040", INK2 = "#5f5479";
const UI = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
const SERIF = 'ui-serif, "New York", Georgia, "Times New Roman", serif';

interface Opts { title: string; result: Result; names: Record<string, string>; style: StyleKey; quote: { text: string; name: string } | null; footer: boolean }

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h);
}

function ellipsize(c: CanvasRenderingContext2D, s: string, w: number) {
  if (c.measureText(s).width <= w) return s;
  while (s.length > 1 && c.measureText(s + "…").width > w) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}

function draw(canvas: HTMLCanvasElement, o: Opts) {
  canvas.width = SIZE; canvas.height = SIZE;
  const c = canvas.getContext("2d"); if (!c) return;
  const g = c.createLinearGradient(0, 0, SIZE, SIZE);
  const st = STYLES[o.style].stops;
  g.addColorStop(0, st[0]); g.addColorStop(0.55, st[1]); g.addColorStop(1, st[2]);
  c.fillStyle = g; c.fillRect(0, 0, SIZE, SIZE);

  const cx = 70, cy = 70, cw = SIZE - 140, ch = SIZE - 140, pad = 64;
  c.save(); c.shadowColor = "rgba(90, 40, 140, .28)"; c.shadowBlur = 50; c.shadowOffsetY = 20;
  c.fillStyle = "#fffdfd"; rr(c, cx, cy, cw, ch, 56); c.fill(); c.restore();

  const left = cx + pad, inner = cw - pad * 2;
  c.textBaseline = "alphabetic"; c.textAlign = "left";
  c.fillStyle = INK; c.font = `700 62px ${UI}`;
  c.fillText("Who talks the most", left, cy + 130);
  c.fillStyle = INK2; c.font = `500 28px ${UI}`;
  c.fillText(ellipsize(c, o.title, inner), left, cy + 176);

  const shares = talkShares(o.result, o.names);
  const pcts = roundPercents(shares.map((s) => s.pct));
  const top = cy + 222;
  const quoteH = o.quote ? 260 : 0;
  const bottom = cy + ch - (o.footer ? 84 : 44) - quoteH;
  const rowH = Math.min(110, (bottom - top) / Math.max(1, shares.length));
  const barH = Math.min(26, rowH * 0.3), nameSize = rowH >= 90 ? 32 : 28;
  shares.forEach((s, i) => {
    const y = top + i * rowH;
    const base = y + nameSize;
    c.fillStyle = s.color; c.beginPath(); c.arc(left + 11, base - nameSize * 0.34, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK; c.font = `600 ${nameSize}px ${UI}`;
    c.textAlign = "right"; c.fillText(`${pcts[i]}%`, left + inner, base);
    const pw = c.measureText(`${pcts[i]}%`).width;
    c.textAlign = "left"; c.fillText(ellipsize(c, s.name, inner - pw - 70), left + 36, base);
    const by = base + 14;
    c.fillStyle = "rgba(110, 85, 170, .12)"; rr(c, left, by, inner, barH, barH / 2); c.fill();
    const bw = Math.max(barH, (inner * s.pct) / 100);
    c.fillStyle = s.color; rr(c, left, by, Math.min(inner, bw), barH, barH / 2); c.fill();
  });

  if (o.quote) {
    const qy = cy + ch - (o.footer ? 84 : 44) - quoteH + 20;
    c.fillStyle = "rgba(168, 123, 255, .35)"; rr(c, left, qy, 6, quoteH - 40, 3); c.fill();
    c.font = `italic 400 38px ${SERIF}`; c.fillStyle = INK;
    const lines = wrapText(`“${o.quote.text}”`, inner - 36, (t) => c.measureText(t).width, 4);
    lines.forEach((l, i) => c.fillText(l, left + 28, qy + 40 + i * 50));
    c.font = `600 26px ${UI}`; c.fillStyle = INK2;
    c.fillText(`— ${ellipsize(c, o.quote.name, inner - 60)}`, left + 28, qy + 40 + lines.length * 50 + 14);
  }

  if (o.footer) {
    c.font = `500 22px ${UI}`; c.fillStyle = "#7d7396"; c.textAlign = "center";
    c.fillText("Made with Local Transcriber · everything stays on this computer", SIZE / 2, cy + ch - 34);
  }
}

function Switch({ id, on, set, label }: { id: string; on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <div className="share-toggle">
      <span id={id}>{label}</span>
      <button type="button" role="switch" className="switch" aria-checked={on} aria-labelledby={id} onClick={() => set(!on)} />
    </div>
  );
}

function Dialog({ title, result, names, onClose }: { title: string; result: Result; names: Record<string, string>; onClose: () => void }) {
  const uid = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dlgRef = useRef<HTMLDivElement>(null);
  const quotes = useMemo(() => pickQuotes(result, names), [result, names]);
  const [withQuote, setWithQuote] = useState(false);
  const [qi, setQi] = useState(0);
  const [style, setStyle] = useState<StyleKey>("sunset");
  const [footer, setFooter] = useState(true);
  const [status, setStatus] = useState<{ msg: string; err?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const quote = withQuote && quotes[qi] ? { text: quotes[qi].text, name: quotes[qi].name } : null;

  useEffect(() => { if (canvasRef.current) draw(canvasRef.current, { title, result, names, style, quote, footer }); },
    [title, result, names, style, quote?.text, quote?.name, footer]);
  useEffect(() => { dlgRef.current?.querySelector<HTMLElement>("button, input, select")?.focus(); return () => window.clearTimeout(timer.current); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab" || !dlgRef.current) return;
    const f = [...dlgRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])")];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !dlgRef.current.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !dlgRef.current.contains(a))) { e.preventDefault(); first.focus(); }
  };

  const save = async () => {
    if (!canvasRef.current) return;
    setStatus(null);
    try {
      const r = await window.api.saveImage(canvasRef.current.toDataURL("image/png"), fileSlug(title));
      if (r.cancelled) setStatus(null);
      else if (r.ok) setStatus({ msg: "Saved ✓" });
      else setStatus({ msg: r.error || "Could not save the image.", err: true });
    } catch (e) { setStatus({ msg: e instanceof Error ? e.message : "Could not save the image.", err: true }); }
  };
  const copy = () => {
    const cv = canvasRef.current; if (!cv) return;
    setStatus(null);
    cv.toBlob(async (blob) => {
      try {
        if (!blob) throw new Error("no image");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true); window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 2000);
      } catch { setStatus({ msg: "Could not copy the image. Try Save image… instead.", err: true }); }
    }, "image/png");
  };

  return (
    <div className="scrim share-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog share-dialog" role="dialog" aria-modal="true" aria-labelledby={`${uid}-h`} ref={dlgRef} onKeyDown={onKey}>
        <h2 id={`${uid}-h`}>Share card</h2>
        <div className="share-body">
          <div className="share-preview">
            <canvas ref={canvasRef} role="img" aria-label="Preview of the share card" />
          </div>
          <div className="share-controls">
            <p className="share-note">The card is made on this computer. Nothing is uploaded.</p>
            <Switch id={`${uid}-q`} on={withQuote} set={setWithQuote} label="Include a quote" />
            <label className="field" htmlFor={`${uid}-sel`}>Quote
              <select id={`${uid}-sel`} className="input" disabled={!withQuote || !quotes.length} value={qi} onChange={(e) => setQi(Number(e.target.value))}>
                {quotes.map((q, i) => <option key={q.index} value={i}>{q.label}</option>)}
                {!quotes.length && <option>No lines to quote</option>}
              </select>
            </label>
            <fieldset className="share-styles">
              <legend>Style</legend>
              <div className="share-radios">
                {(Object.keys(STYLES) as StyleKey[]).map((k) => (
                  <label key={k} className="share-radio">
                    <input type="radio" name={`${uid}-style`} value={k} checked={style === k} onChange={() => setStyle(k)} />
                    <i style={{ background: `linear-gradient(135deg, ${STYLES[k].stops.join(", ")})` }} aria-hidden="true" />
                    {STYLES[k].label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Switch id={`${uid}-f`} on={footer} set={setFooter} label="Show footer" />
            <div className="share-actions">
              <button type="button" className="btn sun" onClick={save}>Save image…</button>
              <button type="button" className="btn" onClick={copy}>{copied ? "Copied ✓" : "Copy image"}</button>
            </div>
            <div role="status" className={`share-status${status?.err ? " err" : ""}`}>{status?.msg ?? ""}</div>
          </div>
        </div>
        <div className="row"><button type="button" className="btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

export default function ShareCardButton({ title, result, names }: { title: string; result: Result; names: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const empty = !result.segments.length;
  const close = useCallback(() => { setOpen(false); window.setTimeout(() => btn.current?.focus(), 0); }, []);
  const host = open ? (document.querySelector<HTMLElement>(".win") ?? document.body) : null;
  return (
    <>
      <button ref={btn} type="button" className="btn" disabled={empty} aria-haspopup="dialog"
        title={empty ? "Nothing to share yet: this recording has no transcript lines." : "Make a picture of who talks the most"}
        onClick={() => setOpen(true)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7 16v-3M12 16V8M17 16v-5" />
        </svg>
        Share card
      </button>
      {host && createPortal(<Dialog title={title} result={result} names={names} onClose={close} />, host)}
    </>
  );
}
