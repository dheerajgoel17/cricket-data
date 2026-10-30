import { afterEach, describe, expect, it } from "vitest";
import { initGa, resolveGaId } from "./ga";

describe("GA", () => {
  afterEach(() => { document.getElementById("ga4")?.remove(); });

  it("accepts only a G- measurement id", () => {
    expect(resolveGaId("")).toBe("");
    expect(resolveGaId("  ")).toBe("");
    expect(resolveGaId("UA-123")).toBe("");
    expect(resolveGaId("G-TEST")).toBe("G-TEST");
  });

  it("does not inject a tag without an id", () => {
    initGa("");
    expect(document.getElementById("ga4")).toBeNull();
  });

  it("injects the tag without a consent prompt", () => {
    initGa("G-TEST");
    const s = document.getElementById("ga4") as HTMLScriptElement;
    expect(s).toBeTruthy();
    expect(s.src).toContain("G-TEST");
    expect(s.async).toBe(true);
  });
});
