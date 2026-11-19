import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The compiler checks the types of every channel (electron/ipcChannels.ts). This checks the part types cannot: that the map, the window side and the main side
// list exactly the same channel names, so a channel cannot be added to one side only or left behind in the map after it is removed.
const read = (f: string) => readFileSync(`electron/${f}`, "utf8").replace(/\r\n/g, "\n"); // Windows checkouts may use CRLF
const handlerSources = ["main.ts", "live.ts", ...readdirSync("electron/ipc").filter((f) => f.endsWith(".ts") && f !== "typed.ts").map((f) => `ipc/${f}`)].map(read).join("\n");
const preload = read("preload.ts");
const map = read("ipcChannels.ts");

const keysOf = (iface: string) => {
  const body = map.slice(map.indexOf(`export interface ${iface} {`)).split("\n}\n")[0];
  return [...body.matchAll(/^ {2}"([A-Za-z-]+)":/gm)].map((m) => m[1]).sort();
};
const uniq = (a: string[]) => [...new Set(a)].sort();
const names = (src: string, re: RegExp) => uniq([...src.matchAll(re)].map((m) => m[1]));

describe("IPC channel map", () => {
  it("has a handler in the main process for every invoke channel, and no handler without an entry", () => {
    expect(names(handlerSources, /(?<![.\w])handle\("([A-Za-z-]+)"/g)).toEqual(keysOf("IpcInvoke"));
  });
  it("is called from the preload for every invoke channel", () => {
    expect(names(preload, /(?<![.\w])invoke\("([A-Za-z-]+)"/g)).toEqual(keysOf("IpcInvoke"));
  });
  it("lists the fire-and-forget and synchronous channels on both sides", () => {
    expect(names(handlerSources, /(?<![.\w])on\("([A-Za-z-]+)"/g)).toEqual(keysOf("IpcSend"));
    expect(names(preload, /(?<![.\w])send\("([A-Za-z-]+)"/g)).toEqual(keysOf("IpcSend"));
    expect(names(handlerSources, /\bonSync\("([A-Za-z-]+)"/g)).toEqual(keysOf("IpcSendSync"));
    expect(names(preload, /\bsendSync\("([A-Za-z-]+)"/g)).toEqual(keysOf("IpcSendSync"));
  });
  it("uses no untyped ipcMain registration outside the typed helpers", () => {
    expect(handlerSources).not.toMatch(/ipcMain\./);
  });
});
