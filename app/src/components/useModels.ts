import { useCallback, useEffect, useState } from "react";
import { t } from "../i18n";
import { bytes } from "../types";
import type { VerifyRow } from "../verifyModels";

/** Approximate download size of a model, in the units this system uses (see bytes() in types.ts). */
/** "≈ 1.6 GB" with no-break spaces, so a narrow panel never leaves the ≈ alone at the end of a line. */
export const modelSize = (name: string) => `≈ ${bytes(MODEL_BYTES[name] ?? 5e8)}`.replace(/ /g, "\u00a0");

/** Approximate download sizes, used to warn before filling the disk. */
export const MODEL_BYTES: Record<string, number> = { tiny: 75e6, base: 145e6, small: 480e6, medium: 1.5e9, "large-v3-turbo": 1.6e9, "large-v3": 3e9, "parakeet-v3": 2.51e9, diarization: 60e6, "llm-small": 1.2e9, "llm-best": 4.8e9 };

export type ModelErrorKind = "offline" | "space" | "denied" | "other";
export interface Access { valid: boolean; kind: string | null; /** The Hugging Face username the token belongs to. */ username: string | null; repos: Record<string, boolean> }
export interface ModelError { kind: ModelErrorKind; title: string; body: string }

function friendly(msg: string): ModelError {
  if (/401|403|gated|restricted|access to model|must be authenticated|not authorized/i.test(msg))
    return { kind: "denied", title: t("Hugging Face said no"), body: t("This usually means one of the two model pages hasn't been agreed to yet, or the token was created on the Fine-grained tab. Check that both pages say “You have been granted access”, and that your token uses the Read tab.") };
  if (/connection|resolve|network|timed out|offline|ENOTFOUND|ECONN|unreachable|max retries/i.test(msg))
    return { kind: "offline", title: t("The download stopped"), body: t("The connection dropped or the internet can't be reached. What's already downloaded is kept, so it continues from there.") };
  return { kind: "other", title: t("The download didn't finish"), body: msg.slice(0, 400) };
}

/** Hugging Face's "new token" page with the Read tab already chosen. */
export const HF_TOKEN_PAGE = "https://huggingface.co/settings/tokens/new?tokenType=read";

/** One model in a folder that was just imported: copied, incomplete in the folder, or not in it. */
export interface ImportRow { id: string; state: "imported" | "incomplete" | "missing" }

/** Shared model download/delete + token state, used by the setup checklist and the sidebar. */
export function useModels(refresh: () => void) {
  const [busy, setBusy] = useState("");
  const [errInfo, setErrInfo] = useState<ModelError | null>(null);
  const [last, setLast] = useState<{ action: "download" | "delete" | "repair"; name: string } | null>(null);
  const err = errInfo?.body ?? "";
  const [tokenSet, setTokenSet] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tokenHint, setTokenHint] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  /** What the folder chosen with "Use a models folder" contained, one row per model; shown in a dialog until it is closed. */
  const [importReport, setImportReport] = useState<ImportRow[] | null>(null);
  const [dl, setDl] = useState<{ fraction: number | null; message: string } | null>(null);
  useEffect(() => window.api.onEvent((e) => {
    if (e.source === "models" && e.type === "progress") setDl({ fraction: e.fraction, message: typeof e.done === "number" ? (typeof e.total === "number" ? t("{done} of {total}", { done: bytes(e.done), total: bytes(e.total) }) : bytes(e.done)) : e.message });
  }), []);
  useEffect(() => { window.api.token().then((t) => { setTokenSet(!!t); setTokenHint(t); }); }, []);

  /** `size` is the download size when the caller knows it better than MODEL_BYTES (the language models come with their sizes). Resolves to whether it worked. */
  const run = useCallback(async (action: "download" | "delete" | "repair", name: string, size?: number) => {
    setErrInfo(null); setLast({ action, name });
    if (action === "download" || action === "repair") {
      const need = size || (MODEL_BYTES[name] ?? MODEL_BYTES[name.replace(/^mlx-/, "")] ?? 5e8), free = await window.api.diskFree();
      if (free != null && free < need * 1.5 + 5e8) {
        setErrInfo({ kind: "space", title: t("Not enough free space"), body: t("This download needs about {need} free, including room to unpack it, and you have {free}. Empty the Trash or remove files you no longer need.", { need: bytes(need * 1.5 + 5e8), free: bytes(free) }) });
        return false;
      }
    }
    setBusy(`${action} ${name}`);
    let ok = false;
    try {
      const r = await window.api.models(action, name);
      if (r?.type === "error" && !r.cancelled) setErrInfo(friendly(String(r.message)));
      ok = r?.type !== "error";
    } catch (e) { setErrInfo(friendly(String(e))); }
    setBusy(""); setDl(null); refresh();
    return ok;
  }, [refresh]);

  /** What "Verify models" found, one row per model; null until it has run. Reading the files is local: it needs no network. */
  const [verified, setVerified] = useState<VerifyRow[] | null>(null);
  /** Checks every downloaded model (or just `name`, after a repair) against the pinned version and the recorded checksums. Resolves to the rows. */
  const verify = useCallback(async (name?: string) => {
    setErrInfo(null); setBusy("verify");
    let rows: VerifyRow[] | null = null;
    try {
      const r = await window.api.models("verify", name);
      if (r?.type === "error" && !r.cancelled) setErrInfo({ kind: "other", title: t("The check didn't finish"), body: String(r.message).slice(0, 400) });
      else if (r?.type === "done") rows = Array.isArray(r.results) ? (r.results as VerifyRow[]) : [];
    } catch (e) { setErrInfo({ kind: "other", title: t("The check didn't finish"), body: String(e).slice(0, 400) }); }
    setBusy(""); setDl(null);
    if (rows) setVerified((old) => (name && old ? old.map((o) => rows!.find((n) => n.id === o.id) ?? o) : rows));
    return rows;
  }, []);

  /** Asks Hugging Face (online) whether the saved token works and which model pages still need "Agree". Null when it can't be reached. */
  const checkAccess = useCallback(async () => {
    setAccess(null); setChecking(true);
    try {
      const r = await window.api.models("check");
      if (r?.type === "done") setAccess({ valid: !!r.valid, kind: (r.kind as string | null) ?? null, username: (r.username as string | null) ?? null, repos: (r.repos as Record<string, boolean>) ?? {} });
    } catch { /* offline: the setup screen says the check couldn't run */ }
    setChecking(false);
  }, []);
  const saveToken = useCallback(async (t: string) => {
    const h = await window.api.token(t.trim().replace(/\s+/g, "")); setTokenSet(true); setTokenHint(h);
    await checkAccess();
  }, [checkAccess]);
  /** Copy models from a folder someone else downloaded. */
  const importFolder = useCallback(async () => {
    setErrInfo(null);
    const r = await window.api.importModels();
    if (r?.cancelled) return;
    if (r?.type === "error") setErrInfo({ kind: "other", title: t("Couldn't import models"), body: String(r.message).slice(0, 300) });
    else if (Array.isArray((r as { report?: unknown })?.report)) setImportReport((r as unknown as { report: ImportRow[] }).report);
    refresh();
  }, [refresh]);

  const clearToken = useCallback(async () => { await window.api.token(""); setTokenSet(false); setTokenHint(""); }, []);
  const retry = useCallback(() => { if (last) void run(last.action, last.name); }, [last, run]);
  const clearErr = useCallback(() => setErrInfo(null), []);
  const cancel = useCallback(() => { void window.api.cancelModels(); }, []);

  /** `err` stays a plain string for older callers; `errInfo` says what kind of problem it was, so the UI can offer the right buttons. */
  return { busy, err, errInfo, tokenSet, tokenHint, dl, access, checking, checkAccess, importFolder, verified, verify, importReport, closeImportReport: () => setImportReport(null), run, saveToken, clearToken, retry, clearErr, cancel };
}
export type Models = ReturnType<typeof useModels>;
