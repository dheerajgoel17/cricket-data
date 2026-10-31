import { describe, expect, it, vi } from "vitest";
import { createStorage, memoryAdapter, pushRecent, removeCombo, saveCombo, toggleKey, webAdapter } from "@cricket/storage";
import tokens, { breakpointPx } from "@cricket/tokens";
import { tokensCss } from "@cricket/tokens/css";
import { readFileSync } from "node:fs";

describe("storage", () => {
  it("round-trips JSON, notifies subscribers and keeps a stable snapshot", () => {
    const s = createStorage(memoryAdapter());
    const fn = vi.fn();
    s.subscribe("k", fn);
    const empty = s.get("k", [] as string[]);
    expect(s.get("k", [] as string[])).toBe(empty);
    s.set("k", ["a"]);
    expect(s.get("k", [])).toEqual(["a"]);
    expect(fn).toHaveBeenCalledTimes(1);
    s.remove("k");
    expect(s.get("k", null)).toBeNull();
  });
  it("survives a corrupt value and a storage that throws", () => {
    expect(createStorage(memoryAdapter({ k: "{oops" })).get("k", [1])).toEqual([1]);
    const bad = webAdapter(() => { throw new Error("blocked"); });
    expect(bad.get("k")).toBeNull();
    expect(() => bad.set("k", "v")).not.toThrow();
  });
  it("shares state through one adapter, so a reload sees the saved list", () => {
    const a = memoryAdapter();
    createStorage(a).set("saved", ["player:1"]);
    expect(createStorage(a).get("saved", [])).toEqual(["player:1"]);
  });
});

describe("saved lists", () => {
  it("toggles a key", () => {
    expect(toggleKey(["a"], "b")).toEqual({ list: ["a", "b"], on: true });
    expect(toggleKey(["a", "b"], "a")).toEqual({ list: ["b"], on: false });
  });
  it("keeps recents newest first, unique and capped", () => {
    expect(pushRecent(["a", "b", "c"], "b", 3)).toEqual(["b", "a", "c"]);
    expect(pushRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });
  it("saves a filter combo by name, replaces the same name and ignores empty ones", () => {
    let l = saveCombo([], "Hot T20", "?stat=runs&win=l5");
    expect(l[0]).toMatchObject({ name: "Hot T20", query: "stat=runs&win=l5" });
    l = saveCombo(l, "Hot T20", "stat=wickets");
    expect(l).toHaveLength(1);
    expect(l[0].query).toBe("stat=wickets");
    expect(saveCombo(l, "", "x=1")).toBe(l);
    expect(saveCombo(l, "n", "")).toBe(l);
    expect(removeCombo(l, "Hot T20")).toEqual([]);
  });
});

describe("tokens", () => {
  it("the committed CSS is what tokens.json generates", () => { expect(readFileSync(`${process.cwd()}/src/tokens.generated.css`, "utf8")).toBe(tokensCss(tokens)); });
  it("has no token that points at itself or shares a name with another group (that would make the variable invalid)", () => {
    const seen = new Map<string, string>();
    for (const g of ["color", "size", "type", "space", "font", "chart"] as const) {
      for (const [k, v] of Object.entries(tokens[g])) {
        expect(v, `--${k}`).not.toBe(`var(--${k})`);
        expect(seen.has(k), `--${k} is in ${seen.get(k)} and ${g}`).toBe(false);
        seen.set(k, g);
      }
    }
  });
  it("keeps the accent and breakpoints the app relies on", () => {
    expect(tokens.color.primary).toBe("#27da8e");
    expect(breakpointPx).toMatchObject({ md: 768, lg: 1024, xl: 1440 });
  });
});
