import { afterEach, describe, expect, it } from "vitest";
import { audienceParams, initGa, resolveGaId } from "./ga";

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

  it("tags a Linux headless UA as a bot and keeps a search query as the source", () => {
    const bot = audienceParams(
      { userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120", language: "en", platform: "Linux x86_64", webdriver: true },
      { href: "https://x.test/player/1?utm_source=twitter", search: "?utm_source=twitter" },
      { referrer: "", title: "x" },
    );
    expect(bot.is_bot).toBe(1);
    expect(bot.traffic_source).toBe("twitter");
    expect(bot.device_category).toBe("desktop");
    const person = audienceParams(
      { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", language: "en-GB", platform: "iPhone" },
      { href: "https://x.test/", search: "" },
      { referrer: "https://www.google.com/search?q=x", title: "x" },
    );
    expect(person.is_bot).toBe(0);
    expect(person.device_category).toBe("mobile");
    expect(person.traffic_source).toBe("www.google.com");
    expect(person.traffic_medium).toBe("referral");
  });
});
