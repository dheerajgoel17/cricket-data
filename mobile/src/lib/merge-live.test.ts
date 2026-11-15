/* eslint-disable @typescript-eslint/no-explicit-any */
import { mergeLiveLines, mergeLiveLinesSliced } from "@/lib/merge-live";

const doc = (): any => ({
  generated_at_utc: "2026-11-10T05:00:00Z",
  lines: [{ pid: "p-other", player: "Other", team: "India", fmt: "T20", stat: "runs", line: 10.5, match: "India vs Australia", competition: "T20", start_utc: "2026-11-10T06:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 1.8, under: 1.9 }] }],
  fancy: [],
});
const inplay = () => ({ asOf: "2026-11-10T07:00:00Z", matches: [{ home: "India", away: "Australia", fmt: "T20", lines: [{ kind: "player_runs", player: "Other", line: 18.5, over: 1.9, under: 1.85, book: "bet365" }, { kind: "player_runs", player: "Newbie", line: 8.5, over: 1.8, under: 1.9, book: "bet365" }] }] });
const liveDoc = (status: string) => ({ matches: [{ status, teams: [{ name: "India" }, { name: "Australia" }], innings: [] }] });
const store: any = { teams: [], P: { id: ["p-other", "p-new"], nm: ["Other", "Newbie"] } };
const rz: any = { players: (name: string) => (/other/i.test(name) ? [{ idx: 0, score: 20 }] : /newbie/i.test(name) ? [{ idx: 1, score: 20 }] : []) };

test("nothing is merged while no match is on, or before the stats are in", () => {
  const lines = doc();
  expect(mergeLiveLines(lines, inplay(), liveDoc("upcoming"), [], store, rz)).toBe(lines);
  expect(mergeLiveLines(lines, inplay(), liveDoc("live"), [], null, null)).toBe(lines);
  expect(mergeLiveLines(lines, { matches: [] }, liveDoc("live"), [], store, rz)).toBe(lines);
  expect(mergeLiveLines(undefined, inplay(), liveDoc("live"), [], store, rz)).toBeUndefined();
});

test("a batter nobody priced before the start gets his live line at once, marked live", () => {
  const out = mergeLiveLines(doc(), inplay(), liveDoc("live"), [], store, rz);
  expect(out.lines.filter((l: any) => l.pid === "p-new").map((l: any) => [l.line, !!l.books[0].live, l.books[0].over])).toEqual([[8.5, true, 1.8]]);
  expect(typeof out.live_sig).toBe("string");
});

test("a batter with a pre-match line keeps that row until his runs so far are past it", () => {
  const out = mergeLiveLines(doc(), inplay(), liveDoc("live"), [], store, rz);
  expect(out.lines.filter((l: any) => l.pid === "p-other").map((l: any) => l.line)).toEqual([10.5]); // no runs known on the live board: the live 18.5 is not added yet
});

test("repeated live snapshots reuse player links without reusing prices", () => {
  const resolver = { players: jest.fn(rz.players) };
  const before = doc();
  const original = JSON.stringify(before);
  mergeLiveLines(before, inplay(), liveDoc("live"), [], store, resolver);
  const calls = resolver.players.mock.calls.length;
  const next = inplay();
  next.matches[0].lines[1].over = 2.1;
  const out = mergeLiveLines(before, next, liveDoc("live"), [], store, resolver);
  expect(calls).toBeGreaterThan(0);
  expect(resolver.players).toHaveBeenCalledTimes(calls);
  expect(out.lines.find((l: any) => l.pid === "p-new").books[0].over).toBe(2.1);
  expect(JSON.stringify(before)).toBe(original);
});

test("the sliced merge gives the same lines, looking each unknown name up once and resting in between", async () => {
  const calls: string[] = [];
  const fresh = (): any => ({ players: (name: string) => { calls.push(name); return rz.players(name); } });
  const plain = mergeLiveLines(doc(), inplay(), liveDoc("live"), [], store, fresh());
  calls.length = 0;
  const resolver = fresh();
  let rests = 0;
  const sliced = await mergeLiveLinesSliced(doc(), inplay(), liveDoc("live"), [], store, resolver, async () => { rests++; }, 0);
  expect(sliced.lines).toEqual(plain.lines);
  expect(sliced.fancy).toEqual(plain.fancy);
  expect(rests).toBeGreaterThan(0);
  const first = calls.length;
  expect(new Set(calls).size).toBe(first); // each name searched once
  await mergeLiveLinesSliced(doc(), inplay(), liveDoc("live"), [], store, resolver, async () => {}, 0);
  expect(calls.length).toBe(first); // the day's links are kept: a later snapshot searches for nobody
});
