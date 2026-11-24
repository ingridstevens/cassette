import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script shared with CI, no types
import { versionProblems } from "../scripts/check-versions.mjs";

const ok = {
  pkg: JSON.stringify({ version: "1.2.3" }),
  lock: JSON.stringify({ version: "1.2.3", packages: { "": { version: "1.2.3" } } }),
  pyproject: '[project]\nname = "engine"\nversion = "1.2.3"\n',
  uvLock: '[[package]]\nname = "engine"\nversion = "1.2.3"\nsource = { editable = "." }\n',
};

describe("version check", () => {
  it("accepts matching versions and a matching tag", () => {
    expect(versionProblems(ok)).toEqual([]);
    expect(versionProblems({ ...ok, tag: "v1.2.3" })).toEqual([]);
    expect(versionProblems({ ...ok, tag: "refs/tags/v1.2.3" })).toEqual([]);
  });
  it("reports each file that disagrees", () => {
    expect(versionProblems({ ...ok, pyproject: ok.pyproject.replace("1.2.3", "1.2.4") })).toHaveLength(1);
    expect(versionProblems({ ...ok, uvLock: ok.uvLock.replace("1.2.3", "0.0.1") })).toHaveLength(1);
    expect(versionProblems({ ...ok, lock: JSON.stringify({ version: "9.9.9", packages: {} }) })).toHaveLength(2);
  });
  it("rejects a tag that is not v plus the version", () => {
    expect(versionProblems({ ...ok, tag: "v1.2.4" })).toHaveLength(1);
    expect(versionProblems({ ...ok, tag: "1.2.3" })).toHaveLength(1);
  });
  it("rejects a version that is not semver", () => {
    const bad = { ...ok, pkg: JSON.stringify({ version: "banana" }) };
    expect(versionProblems(bad).length).toBeGreaterThan(0);
  });
});
