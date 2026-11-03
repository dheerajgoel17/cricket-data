import { expectedEnd, homeProps, RESULTED_KEEP_MS } from "./home-props";

const H = 3600e3;
const start = Date.parse("2026-11-03T10:00:00Z");
const row = (name: string, fmt = "T20", at = start) => ({ name, fmt, start: new Date(at).toISOString() });
const done = new Set<string>();
const standing = (r: { name: string }) => (done.has(r.name) ? { state: "final" } : { state: "live" });

describe("homeProps", () => {
  beforeEach(() => done.clear());

  test("a T20 is expected over 4 hours after its start; a Test day 9, an ODI 8", () => {
    expect(expectedEnd(row("a"))).toBe(start + 4 * H);
    expect(expectedEnd(row("a", "ODI"))).toBe(start + 8 * H);
    expect(expectedEnd(row("a", "Test"))).toBe(start + 9 * H);
  });

  test("undecided rows come first and a resulted row yields its slot to a better undecided one", () => {
    done.add("a");
    const rows = [row("a"), row("b"), row("c")]; // a is first in Home order but has resulted
    expect(homeProps(rows, standing, start + 5 * H).map((r) => r.name)).toEqual(["b", "c", "a"]);
    expect(homeProps(rows, standing, start + 5 * H, 2).map((r) => r.name)).toEqual(["b", "c"]);
  });

  test("a resulted row stays until 6 hours after the expected end, then goes", () => {
    done.add("a");
    const rows = [row("a"), row("b")];
    const end = start + 4 * H;
    expect(homeProps(rows, standing, end + RESULTED_KEEP_MS - 1).map((r) => r.name)).toEqual(["b", "a"]);
    expect(homeProps(rows, standing, end + RESULTED_KEEP_MS).map((r) => r.name)).toEqual(["b"]);
  });

  test("with nothing undecided, a fresh resulted row is still listed", () => {
    done.add("a");
    expect(homeProps([row("a")], standing, start + 5 * H).map((r) => r.name)).toEqual(["a"]);
    expect(homeProps([row("a")], standing, start + 12 * H)).toEqual([]);
  });

  test("a row with no standing yet is undecided", () => {
    expect(homeProps([row("x")], () => null, start + 30 * H).map((r) => r.name)).toEqual(["x"]);
  });
});
