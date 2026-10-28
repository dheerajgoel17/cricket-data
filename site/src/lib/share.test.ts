import { describe, expect, it } from "vitest";
import { shareFixtureUrl, sharePlayerUrl } from "./share";

describe("share links", () => {
  it("name the player, and his stat and line when there is one", () => {
    expect(sharePlayerUrl("https://x.test/", 12)).toBe("https://x.test/share/player/12");
    expect(sharePlayerUrl("https://x.test", 12, "runs", 24.5)).toBe("https://x.test/share/player/12/runs/24.5");
    expect(sharePlayerUrl("https://x.test", 12, "runs", null)).toBe("https://x.test/share/player/12");
  });
  it("name a fixture by its id", () => expect(shareFixtureUrl("https://x.test", "2026-10-29-afghanistan-v-zimbabwe")).toBe("https://x.test/share/fixture/2026-10-29-afghanistan-v-zimbabwe"));
});
