import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Production-only CSP (dev needs inline scripts and a websocket for HMR).
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
const csp = (): Plugin => ({
  name: "inject-csp",
  apply: "build",
  transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" }],
});

export default defineConfig({ plugins: [react(), csp()], base: "./", build: { outDir: "dist" }, server: { port: 5173, strictPort: true } });
