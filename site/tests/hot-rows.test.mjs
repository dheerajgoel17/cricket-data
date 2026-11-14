import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { booksOf, groupByChip, historyRecord, isLiveLine, lineKey, matchChipId, missingLiveLines, patchHotQuotes, prematchLines, rowLineKey, scoreLine, seedRow } from "@cricket/engine/hot-rows.js";
import { buildDoc, wantedLines } from "../scripts/hot-rows.mjs";
import { fixtureDir, loadFixture } from "./helpers.mjs";

const NOW = Date.parse("2026-11-03T05:00:00Z");
const KOHLI = "3e808d3b";
const line = (o = {}) => ({ pid: KOHLI, stat: "runs", fmt: "T20", line: 20.5, match: "Alpha vs Beta", competition: "T20I", team: "Alpha", start_utc: "2026-11-03T09:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 1.85, under: 1.95 }], ...o });
const FIXTURE = { id: "2026-11-03-alpha-v-beta", a: "Alpha", b: "Beta", start: "2026-11-03T09:00Z", fmt: "T20", venue: "Test Ground, Town" };

async function dataDir(lines) {
  const dir = await mkdtemp(join(tmpdir(), "hot-rows-"));
  await cp(join(fixtureDir, "data"), join(dir, "data"), { recursive: true });
  await writeFile(join(dir, "data", "fixtures.json"), JSON.stringify([FIXTURE]));
  await writeFile(join(dir, "book_lines.json"), JSON.stringify({ generated_at_utc: "2026-11-03T04:50:00Z", lines }));
  return { data: join(dir, "data"), lines: join(dir, "book_lines.json") };
}

test("the published history, read back with the line's own books, is the row scored from scratch", async () => {
  const { store, rz } = await loadFixture();
  const l = line(), byChip = groupByChip([l]), year = "2026";
  await store.shard(store.shardOf(store.P.id.indexOf(KOHLI)));
  const row = await scoreLine({ store, rz, l, byChip, fixtures: [FIXTURE], now: NOW, year });
  assert.ok(row && row.l10.played > 0, "the fixture player has games");
  assert.equal(row.venue, "Test Ground, Town");
  const rec = JSON.parse(JSON.stringify(historyRecord(row)));
  const b = booksOf(l, byChip, NOW);
  assert.deepEqual(seedRow({ store, l, b, rec }), row);
  assert.deepEqual(seedRow({ store: null, l, b, rec }), row, "without the player's data, from the record alone");
});

test("a seed is not used when the books' main line moved, when it is for another player, or when there is none", async () => {
  const { store, rz } = await loadFixture();
  const l = line(), byChip = groupByChip([l]);
  await store.shard(store.shardOf(store.P.id.indexOf(KOHLI)));
  const rec = historyRecord(await scoreLine({ store, rz, l, byChip, fixtures: [FIXTURE], now: NOW, year: "2026" }));
  const moved = line({ line: 25.5 });
  assert.equal(seedRow({ store, l: moved, b: booksOf(moved, groupByChip([moved]), NOW), rec }), null);
  assert.equal(seedRow({ store, l, b: booksOf(l, byChip, NOW), rec: { ...rec, idx: rec.idx + 1 } }), null);
  assert.equal(seedRow({ store, l, b: booksOf(l, byChip, NOW), rec: undefined }), null);
});

test("a live line is a row of its own and is not published", () => {
  const live = line({ books: [{ source: "bet365", kind: "bookmaker", over: 1.9, under: 1.9, live: true }] });
  assert.equal(isLiveLine(live), true);
  assert.notEqual(lineKey(live), lineKey(line()));
  assert.match(lineKey(line()), /\|$/);
  assert.deepEqual(wantedLines([line(), live], NOW).map(lineKey), [lineKey(line())]);
  // a Test is one chip whatever day it is priced for; a limited-overs line groups by UTC date
  assert.equal(matchChipId("A vs B", "2026-11-03T09:00:00Z", "Test"), matchChipId("A vs B", "2026-11-04T09:00:00Z", "Test"));
  assert.notEqual(matchChipId("A vs B", "2026-11-03T09:00:00Z", "T20"), matchChipId("A vs B", "2026-11-04T09:00:00Z", "T20"));
});

test("live poll helpers: prematch filter, missing live rows, quote patch without rescoring history", () => {
  const pre = line(), live = line({ books: [{ source: "bet365", kind: "bookmaker", over: 1.9, under: 1.9, live: true, opened: 20.5 }] });
  const moved = line({ line: 22.5, books: [{ source: "bet365", kind: "bookmaker", over: 2.1, under: 1.7, live: true, opened: 20.5 }] });
  assert.deepEqual(prematchLines([pre, live]).map(lineKey), [lineKey(pre)]);
  const scored = [{ pid: KOHLI, stat: "runs", fmt: "T20", match: "Alpha vs Beta", start: "2026-11-03T09:00:00Z", inn: 0, line: 20.5, over: 1.9, under: 1.9, quotes: [{ source: "bet365", over: 1.9, under: 1.9, live: true }], l10: { hit: 4, played: 10 }, prior: 0.5 }];
  assert.equal(rowLineKey(scored[0]), lineKey(live));
  assert.deepEqual(missingLiveLines(scored, [pre, live]), []);
  assert.equal(missingLiveLines([], [pre, live]).map(lineKey).join(), lineKey(live));
  const patched = patchHotQuotes(scored, [pre, moved], NOW);
  assert.equal(patched[0].line, 22.5);
  assert.equal(patched[0].over, 2.1);
  assert.equal(patched[0].l10.hit, 4, "history is left alone");
});

test("wantedLines keeps priced pre-match lines inside the window and nothing else", () => {
  const keep = line(), old = line({ pid: "x1", start_utc: "2026-10-30T09:00:00Z" }), far = line({ pid: "x2", start_utc: "2026-11-20T09:00:00Z" }), bare = line({ pid: "x3", books: [] });
  assert.deepEqual(wantedLines([keep, old, far, bare], NOW), [keep]);
});

test("the script writes the history of each priced line under its key, and fails on an empty build", async () => {
  const { data, lines } = await dataDir([line(), line({ line: 25.5 }), line({ stat: "fours", line: 1.5 }), line({ pid: "unknown0", stat: "runs" })]);
  const doc = await buildDoc({ dataDir: data, linesPath: lines, now: NOW });
  assert.equal(doc.v, 1);
  assert.equal(doc.generated_at_utc, "2026-11-03T05:00:00Z");
  assert.equal(doc.lines_generated_at_utc, "2026-11-03T04:50:00Z");
  assert.equal(doc.build, "2026-11-03T07:21Z");
  assert.ok(doc.rows[lineKey(line())], "the runs line is there");
  assert.ok(!doc.rows[lineKey(line({ pid: "unknown0" }))], "a player not in the data has no row");
  assert.equal(doc.scored, Object.keys(doc.rows).length);
  assert.equal(doc.scored + doc.skipped, doc.lines);
  assert.equal(doc.lines, 3, "two lines of one player and stat are one key, one row");
  assert.equal(JSON.parse(JSON.stringify(doc.rows)) && Object.values(JSON.parse(JSON.stringify(doc.rows))).every((r) => ["idx", "name", "line", "prior", "opp", "venue", "l5", "l10", "season", "h2h", "ven", "last", "max"].every((f) => f in r)), true, "every row keeps the fields the guard asks for once written as JSON");
  assert.deepEqual(Object.keys(doc.rows[lineKey(line())]).sort(), ["h2h", "idx", "l10", "l5", "last", "line", "max", "name", "opp", "prior", "season", "settled", "ven", "venue"].sort());
  await writeFile(join(data, "fixtures.json"), "[]");
  await assert.rejects(buildDoc({ dataDir: data, linesPath: lines, now: NOW }), /no fixtures/);
  assert.match(await readFile(lines, "utf8"), /Alpha vs Beta/);
});
