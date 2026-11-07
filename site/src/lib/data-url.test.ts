import { describe, expect, it } from "vitest";
import { dataUrl } from "./data-url";

const M = { "index.json": "ab12", "p/7.json": "cd34" };

describe("dataUrl", () => {
  it("adds the file's version to an absolute or relative data URL", () => {
    expect(dataUrl("/data/index.json", M)).toBe("/data/index.json?v=ab12");
    expect(dataUrl("/data/p/7.json", M)).toBe("/data/p/7.json?v=cd34");
    expect(dataUrl("data/index.json", M)).toBe("data/index.json?v=ab12");
  });
  it("leaves a file the build did not hash, and a page with no manifest, as they were", () => {
    expect(dataUrl("/data/meta.json", M)).toBe("/data/meta.json");
    expect(dataUrl("/data/index.json", undefined)).toBe("/data/index.json");
  });
});
