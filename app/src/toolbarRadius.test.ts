import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = (name: string) => readFileSync(new URL(`./styles/${name}.css`, import.meta.url), "utf8");
const rule = (file: string, selector: string) => {
  const m = css(file).match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`, "m"));
  if (!m) throw new Error(`no rule for ${selector} in ${file}.css`);
  return m[1];
};

describe("toolbar corner radius", () => {
  it("defines one control radius token", () => {
    expect(css("base")).toMatch(/--r-ctl:\s*999px/);
  });
  it.each([
    ["base", ".btn"],
    ["base", ".search"],
    ["base", ".pill"],
    ["settings", ".st-root .btn"],
    ["project", ".pv-title-input"],
  ])("%s.css %s uses the token, not a literal radius", (file, selector) => {
    expect(rule(file, selector)).toMatch(/border-radius:\s*var\(--r-ctl\)/);
  });
  it("no toolbar override gives buttons another radius", () => {
    expect(css("project")).not.toMatch(/\.pv-tool[^{]*\.btn[^{]*\{[^}]*border-radius/);
  });
});
