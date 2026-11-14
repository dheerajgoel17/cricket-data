import { afterEach, beforeEach, expect, test } from "vitest";
import { EMPTY_TTL_MS, clearAdEmpty, isAdEmptyCached, markAdEmpty } from "./ad-fill";

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { sessionStorage.clear(); });

test("empty mark is remembered then expires", () => {
  const t0 = 1_000_000;
  expect(isAdEmptyCached("stats_top", "123", t0)).toBe(false);
  markAdEmpty("stats_top", "123", t0);
  expect(isAdEmptyCached("stats_top", "123", t0 + 1000)).toBe(true);
  expect(isAdEmptyCached("stats_top", "999", t0 + 1000)).toBe(false);
  expect(isAdEmptyCached("stats_top", "123", t0 + EMPTY_TTL_MS + 1)).toBe(false);
});

test("clearAdEmpty removes the mark so AdSense can try again", () => {
  markAdEmpty("player_detail_top", "123", 50);
  clearAdEmpty("player_detail_top", "123");
  expect(isAdEmptyCached("player_detail_top", "123", 60)).toBe(false);
});
