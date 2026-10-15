import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { setLanguage } from "./i18n";
import { applyLook } from "./types";
import "./styles/base.css";
import "./styles/classic.css";
import "./styles/themes.css";

if (import.meta.env.DEV && !(window as { api?: unknown }).api) await import("./dev-mock");

if (navigator.userAgent.includes("Macintosh")) document.documentElement.classList.add("mac");
try { const o = JSON.parse(localStorage.getItem("opts") || "{}"); applyLook(o); setLanguage(o.appLanguage); } catch { applyLook({}); setLanguage(); }
createRoot(document.getElementById("root")!).render(<ErrorBoundary><App /></ErrorBoundary>);
window.addEventListener("error", (e) => window.api?.logError(`${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener("unhandledrejection", (e) => window.api?.logError(`unhandled rejection: ${e.reason instanceof Error ? e.reason.stack ?? e.reason.message : String(e.reason)}`));
