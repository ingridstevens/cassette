import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Production-only CSP (dev needs inline scripts and a websocket for HMR).
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: media:; connect-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
const csp = (): Plugin => ({
  name: "inject-csp",
  apply: "build",
  transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" }],
});

export default defineConfig({ define: { __APP_VERSION__: JSON.stringify(version) }, plugins: [react(), csp()], base: "./", build: { outDir: "dist" }, server: { port: 5173, strictPort: true } });
