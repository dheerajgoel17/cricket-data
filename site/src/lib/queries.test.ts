import { describe, expect, it } from "vitest";
import { STATE_MAX_AGE_MS, freshState } from "./queries";

const NOW = Date.parse("2026-10-31T12:00:00Z");

describe("freshState", () => {
  it("trusts the match-state table only while the job's last write is recent", () => {
    const doc = (min: number) => ({ updatedAt: new Date(NOW - min * 60_000).toISOString(), matches: [] });
    expect(freshState(doc(2), NOW)).not.toBeNull();
    expect(freshState(doc(STATE_MAX_AGE_MS / 60_000 + 1), NOW)).toBeNull(); // the job stopped: the site works the phase out itself
  });
  it("is null when there is no table (not configured, down, empty)", () => {
    expect(freshState(null, NOW)).toBeNull();
    expect(freshState({ matches: [] }, NOW)).toBeNull();
  });
});
