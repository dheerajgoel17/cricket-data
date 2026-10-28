import { beforeEach, describe, expect, it } from "vitest";
import { LIVE_CACHE_MS, readLive, saveLive } from "./live-cache";

const body = { asOf: "2026-10-28T09:00:00Z", matches: [{ status: "live" }] };
const NOW = Date.parse("2026-10-28T09:00:00Z");

beforeEach(() => localStorage.clear());

describe("live body kept on the device", () => {
  it("gives back what was saved, with when it was saved", () => {
    saveLive(body, NOW);
    expect(readLive(NOW + 60e3)).toEqual({ t: NOW, body });
  });
  it("gives nothing when nothing was saved", () => { expect(readLive(NOW)).toBeNull(); });
  it("lets go of a body once it is old enough for a match to have started or ended", () => {
    saveLive(body, NOW);
    expect(readLive(NOW + LIVE_CACHE_MS - 1)).not.toBeNull();
    expect(readLive(NOW + LIVE_CACHE_MS)).toBeNull();
  });
  it("does not trust a body dated in the future (a wrong clock)", () => {
    saveLive(body, NOW + 3600e3);
    expect(readLive(NOW)).toBeNull();
  });
  it("does not keep an error body or anything without a match list", () => {
    saveLive(null, NOW);
    saveLive({ error: "timeout" }, NOW);
    expect(readLive(NOW)).toBeNull();
  });
  it("shrugs off damaged storage", () => {
    localStorage.setItem("live-body-v1", "{not json");
    expect(readLive(NOW)).toBeNull();
    localStorage.setItem("live-body-v1", JSON.stringify({ t: NOW, body: { matches: "x" } }));
    expect(readLive(NOW)).toBeNull();
  });
});
