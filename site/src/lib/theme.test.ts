import { describe, expect, it } from "vitest";
import { paintTheme, parsePref, resolvedTheme } from "./theme";

describe("theme", () => {
  it("defaults unknown storage to dark", () => {
    expect(parsePref(null)).toBe("dark");
    expect(parsePref("")).toBe("dark");
    expect(parsePref("sepia")).toBe("dark");
  });

  it("keeps a stored preference", () => {
    expect(parsePref("light")).toBe("light");
    expect(parsePref("dark")).toBe("dark");
    expect(parsePref("system")).toBe("system");
  });

  it("resolves system against the OS", () => {
    expect(resolvedTheme("light", true)).toBe("light");
    expect(resolvedTheme("dark", false)).toBe("dark");
    expect(resolvedTheme("system", true)).toBe("dark");
    expect(resolvedTheme("system", false)).toBe("light");
  });

  it("paints html.dark and color-scheme", () => {
    const meta = { content: "dark", setAttribute(_: string, v: string) { this.content = v; } };
    const doc = {
      documentElement: { classList: { dark: true, toggle(name: string, on: boolean) { if (name === "dark") this.dark = on; } }, style: { colorScheme: "dark" } },
      querySelector: () => meta,
    };
    paintTheme("light", doc as unknown as Document);
    expect(doc.documentElement.classList.dark).toBe(false);
    expect(doc.documentElement.style.colorScheme).toBe("light");
    expect(meta.content).toBe("light");
  });
});
