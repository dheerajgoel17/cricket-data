import test, { afterEach, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { MISSING_TOKEN, config, createScheduler, decide } from "../../scheduler/worker.js";
import { DAY, JOBS, MIN, nextSlot, parseCron, slotStart } from "../../scheduler/slots.js";
import { lagReport, slotsBetween, table } from "../../scheduler/measure.mjs";

const iso = (ms) => new Date(ms).toISOString();
const T = Date.parse("2026-11-02T10:50:00Z"); // a Monday; at this minute every job has a slot behind it: scraper 10:37, value-bets 10:30, site 10:50, balls 10:47
const ago = (min) => iso(T - min * MIN);
const TOKEN = "tok-abc-123456";
const env = { GITHUB_DISPATCH_TOKEN: TOKEN, GITHUB_REPO: "own/repo" };
const job = (file) => JOBS.find((j) => j.file === file);
const FILES = JOBS.map((j) => j.file);

beforeEach(() => { mock.method(console, "error", () => {}); mock.method(console, "log", () => {}); });
afterEach(() => mock.restoreAll());

/** A stand-in for the GitHub API. runs[file] is a list of runs (newest first) or an HTTP status to fail the listing with; post[file] is the status the dispatch answers (204 by default) or "network". */
function fakeGithub({ runs = {}, post = {} } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url), parts = u.pathname.split("/"), file = parts.at(-2), kind = parts.at(-1), method = init.method || "GET";
    calls.push({ method, file, kind, host: u.host, path: u.pathname, query: Object.fromEntries(u.searchParams), headers: init.headers || {}, body: init.body });
    if (kind === "runs") {
      const list = runs[file] ?? [];
      if (typeof list === "number") return Response.json({ message: "API rate limit exceeded" }, { status: list });
      const want = u.searchParams.get("event");
      return Response.json({ workflow_runs: list.filter((r) => !want || r.event === want) });
    }
    const code = post[file] ?? 204;
    if (code === "network") throw new TypeError("fetch failed");
    return code === 204 ? new Response(null, { status: 204 }) : Response.json({ message: `refused ${TOKEN}` }, { status: code });
  };
  return { fetchImpl, calls, posts: () => calls.filter((c) => c.method === "POST") };
}
const run = (minAgo, over = {}) => ({ event: "schedule", status: "completed", conclusion: "success", created_at: ago(minAgo), ...over });
const outcome = (res, file) => res.jobs.find((j) => j.workflow === file);

// ---- slot rules ----------------------------------------------------------------------------------------------------------------------------------------------------------------------

const D0 = Date.parse("2026-11-02T00:00:00Z");
const slotsOfDay = (j) => {
  const out = [];
  for (let t = D0; t < D0 + DAY; t += MIN) if (slotStart(j, t) === t) out.push(iso(t).slice(11, 16));
  return out;
};
const hh = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

test("slot rules across a whole day: scraper at :07 and :37, value-bets at :30 (all 24 hours), site at :50, balls at :47 of every second hour", () => {
  assert.deepEqual(slotsOfDay(job("scraper-update.yml")), hh.flatMap((h) => [`${h}:07`, `${h}:37`]));
  assert.deepEqual(slotsOfDay(job("value-bets.yml")), hh.map((h) => `${h}:30`));
  assert.deepEqual(slotsOfDay(job("site.yml")), hh.map((h) => `${h}:50`));
  assert.deepEqual(slotsOfDay(job("balls-update.yml")), ["00:47", "02:47", "04:47", "06:47", "08:47", "10:47", "12:47", "14:47", "16:47", "18:47", "20:47", "22:47"]);
});

test("slotStart is the latest slot at or before now: exactly on a slot, one millisecond before it, at T, and across midnight, a month and a year", () => {
  const at = (s) => Date.parse(s);
  assert.equal(iso(slotStart(job("scraper-update.yml"), at("2026-11-02T10:37:00.000Z"))), "2026-11-02T10:37:00.000Z");
  assert.equal(iso(slotStart(job("scraper-update.yml"), at("2026-11-02T10:36:59.999Z"))), "2026-11-02T10:07:00.000Z");
  assert.deepEqual(FILES.map((f) => iso(slotStart(job(f), T))), ["2026-11-02T10:37:00.000Z", "2026-11-02T10:30:00.000Z", "2026-11-02T10:50:00.000Z", "2026-11-02T10:47:00.000Z"]);
  // 00:05 UTC: the day's first slots have not come yet, yesterday's last ones count
  assert.deepEqual(FILES.map((f) => iso(slotStart(job(f), at("2026-11-02T00:05:00Z")))), ["2026-11-01T23:37:00.000Z", "2026-11-01T23:30:00.000Z", "2026-11-01T23:50:00.000Z", "2026-11-01T22:47:00.000Z"]);
  assert.equal(iso(slotStart(job("balls-update.yml"), at("2026-12-01T00:10:00Z"))), "2026-11-30T22:47:00.000Z");
  assert.equal(iso(slotStart(job("balls-update.yml"), at("2027-01-01T00:10:00Z"))), "2026-12-31T22:47:00.000Z");
  // an odd hour still belongs to the even hour's slot
  assert.equal(iso(slotStart(job("balls-update.yml"), at("2026-11-02T11:59:00Z"))), "2026-11-02T10:47:00.000Z");
});

test("nextSlot is the first slot strictly after now", () => {
  assert.equal(iso(nextSlot(job("scraper-update.yml"), T)), "2026-11-02T11:07:00.000Z");
  assert.equal(iso(nextSlot(job("site.yml"), T)), "2026-11-02T11:50:00.000Z", "now is a slot: the next one is an hour later");
  assert.equal(iso(nextSlot(job("balls-update.yml"), T)), "2026-11-02T12:47:00.000Z");
  assert.equal(iso(nextSlot(job("value-bets.yml"), Date.parse("2026-11-02T23:45:00Z"))), "2026-11-03T00:30:00.000Z");
});

test("parseCron reads the minute and hour fields and refuses what the Worker does not model", () => {
  assert.deepEqual(parseCron("47 */2 * * *"), { minutes: [47], hours: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] });
  assert.deepEqual(parseCron("7,37 * * * *").minutes, [7, 37]);
  assert.equal(parseCron("7,37 * * * *").hours.length, 24);
  for (const bad of ["0 0 1 * *", "0 7 * * 0", "*/0 * * * *", "61 * * * *", "1-5 * * * *", "30 *", "x * * * *"]) assert.throws(() => parseCron(bad), /cron/, bad);
});

test("each job's cron is the one its workflow keeps as the fallback, and every one of them can be dispatched by hand", () => {
  for (const j of JOBS) {
    const text = readFileSync(new URL(`../../.github/workflows/${j.file}`, import.meta.url), "utf8");
    assert.ok(text.includes(`cron: "${j.cron}"`), `${j.file} keeps cron "${j.cron}"`);
    assert.match(text, /^\s*workflow_dispatch:/m, `${j.file} has workflow_dispatch`);
  }
});

// ---- the skip rules ------------------------------------------------------------------------------------------------------------------------------------------------------------------

test("nothing has run: every due job is dispatched once, with the documented request (GET the runs first, then POST {ref}) and no token anywhere but the Authorization header", async () => {
  const gh = fakeGithub(), s = createScheduler({ fetchImpl: gh.fetchImpl });
  const res = await s.tick(env, T);
  assert.equal(res.ok, true);
  assert.deepEqual(res.counts, { dispatched: 4, skipped: 0, failed: 0 });
  assert.deepEqual(gh.posts().map((c) => c.file).sort(), [...FILES].sort());
  for (const f of FILES) {
    const get = gh.calls.findIndex((c) => c.file === f && c.method === "GET"), post = gh.calls.findIndex((c) => c.file === f && c.method === "POST");
    assert.ok(get >= 0 && get < post, `${f}: the runs are read before the dispatch`);
    assert.deepEqual(gh.calls[get].query, { branch: "main", per_page: "5" });
    const c = gh.calls[post];
    assert.equal(c.host, "api.github.com");
    assert.equal(c.path, `/repos/own/repo/actions/workflows/${f}/dispatches`);
    assert.equal(c.body, '{"ref":"main"}');
    assert.equal(c.headers.Authorization, `Bearer ${TOKEN}`);
    assert.equal(c.headers.Accept, "application/vnd.github+json");
    assert.ok(c.headers["User-Agent"]);
  }
  assert.ok(!JSON.stringify(res).includes(TOKEN));
});

test("the ref comes from the DISPATCH_REF variable (default main)", async () => {
  const gh = fakeGithub();
  await createScheduler({ fetchImpl: gh.fetchImpl }).tick({ ...env, DISPATCH_REF: "release" }, T);
  assert.ok(gh.posts().every((c) => c.body === '{"ref":"release"}'));
  assert.ok(gh.calls.filter((c) => c.method === "GET").every((c) => c.query.branch === "release"));
});

// value-bets' slot at T is 10:30 (20 minutes ago); the table lists what its run list can look like and whether a dispatch follows
const SKIP_CASES = [
  ["a run created inside the slot (GitHub's own cron firing late) means skip", [run(5)], "skipped", "run-in-slot"],
  ["a run created exactly at the slot start counts as inside it", [run(20)], "skipped", "run-in-slot"],
  ["a run still in progress, even from the slot before, means skip", [run(25, { status: "in_progress", conclusion: null })], "skipped", "running"],
  ["a queued run means skip", [run(40, { status: "queued", conclusion: null })], "skipped", "running"],
  ["a run that has been 'running' for over two hours is stuck and does not block", [run(130, { status: "in_progress", conclusion: null })], "dispatched"],
  ["a finished run from the slot before does not count for this one", [run(21)], "dispatched"],
  ["no runs at all: dispatch", [], "dispatched"],
  ["a pull-request dry run inside the slot is not the real run", [run(5, { event: "pull_request" })], "dispatched"],
  ["a pull-request dry run still in progress does not block", [run(5, { event: "pull_request", status: "in_progress", conclusion: null })], "dispatched"],
  ["a run another event started (a push) inside the slot counts", [run(5, { event: "push" })], "skipped", "run-in-slot"],
  ["a dispatched run inside the slot counts", [run(2, { event: "workflow_dispatch" })], "skipped", "run-in-slot"],
];
for (const [name, runs, action, reason] of SKIP_CASES) {
  test(`skip rules: ${name}`, async () => {
    const gh = fakeGithub({ runs: { "value-bets.yml": runs } }), s = createScheduler({ fetchImpl: gh.fetchImpl });
    const res = await s.tick(env, T);
    const o = outcome(res, "value-bets.yml");
    assert.equal(o.action, action);
    if (reason) assert.equal(o.reason, reason);
    assert.equal(gh.posts().filter((c) => c.file === "value-bets.yml").length, action === "dispatched" ? 1 : 0);
    assert.equal(o.slot, "2026-11-02T10:30:00.000Z");
  });
}

test("decide is pure: the same runs and clock give the same answer", () => {
  const runs = { workflow_runs: [run(5)] };
  assert.deepEqual(decide(job("value-bets.yml"), runs, T), decide(job("value-bets.yml"), runs, T));
  assert.equal(decide(job("value-bets.yml"), runs, T).action, "skip");
  assert.equal(decide(job("value-bets.yml"), { workflow_runs: [] }, T).action, "dispatch");
  assert.equal(decide(job("value-bets.yml"), {}, T).action, "dispatch");
});

test("a slot that is handled costs no further calls; the next slot of that job is looked at again, the others stay quiet", async () => {
  const gh = fakeGithub(), s = createScheduler({ fetchImpl: gh.fetchImpl });
  await s.tick(env, T);
  assert.equal(gh.calls.length, 8);
  const again = await s.tick(env, T + MIN);
  assert.equal(gh.calls.length, 8, "the minute after: nothing asked, nothing sent");
  assert.deepEqual(again.jobs, []);
  const later = await s.tick(env, Date.parse("2026-11-02T11:07:00Z")); // scraper's next slot only
  assert.deepEqual(later.jobs.map((j) => [j.workflow, j.action, j.slot]), [["scraper-update.yml", "dispatched", "2026-11-02T11:07:00.000Z"]]);
  assert.equal(gh.calls.length, 10);
});

test("a run that is still going when the next slot starts is waited for, then the late slot is dispatched as soon as it has finished", async () => {
  const runs = { "balls-update.yml": [run(5, { status: "in_progress", conclusion: null })] }; // started at 10:45, before balls' 10:47 slot
  const gh = fakeGithub({ runs }), s = createScheduler({ fetchImpl: gh.fetchImpl });
  assert.equal(outcome(await s.tick(env, T), "balls-update.yml").reason, "running");
  assert.equal(outcome(await s.tick(env, T + MIN), "balls-update.yml").reason, "running", "asked again every minute while it runs");
  runs["balls-update.yml"] = [run(6, { status: "completed" })];
  assert.equal(outcome(await s.tick(env, T + 2 * MIN), "balls-update.yml").action, "dispatched");
  assert.equal(gh.posts().filter((c) => c.file === "balls-update.yml").length, 1);
});

// ---- failures ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test("a failing job (dispatch refused, network error, run list refused) is logged and counted and never stops the others", async () => {
  const gh = fakeGithub({ runs: { "value-bets.yml": 403 }, post: { "scraper-update.yml": "network", "site.yml": 500 } }), s = createScheduler({ fetchImpl: gh.fetchImpl });
  const res = await s.tick(env, T);
  assert.equal(res.ok, false);
  assert.deepEqual(res.counts, { dispatched: 1, skipped: 0, failed: 3 });
  assert.match(outcome(res, "scraper-update.yml").error, /fetch failed/);
  assert.match(outcome(res, "value-bets.yml").error, /HTTP 403: API rate limit exceeded/);
  assert.match(outcome(res, "site.yml").error, /HTTP 500: refused \*\*\*/, "GitHub's message is kept, the token in it is not");
  assert.equal(outcome(res, "balls-update.yml").action, "dispatched", "the job after three failures still ran");
  assert.deepEqual(gh.posts().map((c) => c.file).sort(), ["balls-update.yml", "scraper-update.yml", "site.yml"]);
  const logged = JSON.stringify(console.error.mock.calls);
  assert.ok(logged.includes("scheduler:") && logged.includes("HTTP 403"), "the failure is logged");
  assert.ok(!logged.includes(TOKEN) && !JSON.stringify(res).includes(TOKEN), "the token is in neither the log nor the result");
});

test("a failed dispatch is retried after five minutes, not every minute", async () => {
  const gh = fakeGithub({ post: { "value-bets.yml": 500 } }), s = createScheduler({ fetchImpl: gh.fetchImpl });
  assert.equal(outcome(await s.tick(env, T), "value-bets.yml").action, "failed");
  const n = gh.calls.length;
  await s.tick(env, T + MIN);
  await s.tick(env, T + 4 * MIN);
  assert.equal(gh.calls.length, n, "no call inside the five minutes");
  gh.calls.length = 0;
  const res = await s.tick(env, T + 5 * MIN);
  assert.equal(outcome(res, "value-bets.yml").action, "failed", "tried again, still refused");
  assert.deepEqual(gh.calls.map((c) => [c.file, c.method]), [["value-bets.yml", "GET"], ["value-bets.yml", "POST"]], "and only that job");
});

test("when the refusal clears, the retry dispatches the slot", async () => {
  const post = { "value-bets.yml": 502 }, gh = fakeGithub({ post }), s = createScheduler({ fetchImpl: gh.fetchImpl });
  await s.tick(env, T);
  post["value-bets.yml"] = 204;
  assert.equal(outcome(await s.tick(env, T + 5 * MIN), "value-bets.yml").action, "dispatched");
  gh.calls.length = 0;
  await s.tick(env, T + 6 * MIN);
  assert.equal(gh.calls.length, 0, "handled now");
});

test("a missing secret says so clearly and does nothing: no call to GitHub, an error in the result and the log", async () => {
  for (const [e, what] of [[{}, "GITHUB_DISPATCH_TOKEN is not set"], [{ GITHUB_REPO: "own/repo" }, "GITHUB_DISPATCH_TOKEN is not set"], [{ GITHUB_DISPATCH_TOKEN: TOKEN }, "GITHUB_REPO is not set"], [{ GITHUB_DISPATCH_TOKEN: "  ", GITHUB_REPO: "own/repo" }, "GITHUB_DISPATCH_TOKEN is not set"], [{ GITHUB_DISPATCH_TOKEN: TOKEN, GITHUB_REPO: "not a repo" }, "GITHUB_REPO is not set"]]) {
    const gh = fakeGithub(), s = createScheduler({ fetchImpl: gh.fetchImpl });
    const res = await s.tick(e, T);
    assert.equal(res.ok, false);
    assert.match(res.error, new RegExp(what));
    assert.match(res.error, /nothing was dispatched/);
    assert.deepEqual(res.jobs, []);
    assert.equal(gh.calls.length, 0, JSON.stringify(e));
  }
  assert.match(MISSING_TOKEN, /wrangler secret put GITHUB_DISPATCH_TOKEN/, "the message names the fix");
  assert.ok(console.error.mock.calls.length >= 5, "each tick logged the problem");
  assert.equal(config({}).error, MISSING_TOKEN);
});

test("the cron handler never throws or rejects: missing secret, failing fetch, even a fetch that throws synchronously", async () => {
  const waited = [];
  const ctx = { waitUntil: (p) => waited.push(p) };
  const sync = () => { throw new Error("boom before any promise"); };
  for (const [e, fetchImpl] of [[{}, fakeGithub().fetchImpl], [env, fakeGithub({ runs: Object.fromEntries(FILES.map((f) => [f, 500])) }).fetchImpl], [env, sync]]) {
    await createScheduler({ fetchImpl }).scheduled({ scheduledTime: T }, e, ctx);
  }
  assert.equal(waited.length, 3);
  await Promise.all(waited); // none of them rejects
  const none = await createScheduler({ fetchImpl: fakeGithub().fetchImpl }).scheduled({ scheduledTime: T }, env, undefined);
  assert.equal(none.ok, true, "also without a ctx");
});

test("the cron handler uses the scheduled minute as its clock, so a late start still picks the right slot", async () => {
  const gh = fakeGithub(), waited = [];
  await createScheduler({ fetchImpl: gh.fetchImpl }).scheduled({ scheduledTime: T }, env, { waitUntil: (p) => waited.push(p) });
  assert.equal(waited.length, 1);
  assert.equal(gh.posts().length, 4);
});

test("the default export is a Worker with fetch and scheduled and, without secrets, calls nothing", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("the network must not be reached"); };
  try {
    assert.equal(typeof worker.fetch, "function");
    assert.equal(typeof worker.scheduled, "function");
    const res = await worker.scheduled({ scheduledTime: T }, {}, { waitUntil() {} });
    assert.equal(res.ok, false);
    assert.equal((await worker.fetch(new Request("https://w.test/status"), {})).status, 200);
  } finally { globalThis.fetch = real; }
});

// ---- GET /status ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

test("/status says per job what the last tick did and what GitHub lists, and carries no secret", async () => {
  const runs = {
    "site.yml": [run(1, { event: "push" }), run(3, { event: "workflow_dispatch", conclusion: "failure" }), run(63, { event: "schedule" })],
    "value-bets.yml": [run(5)],
  };
  const gh = fakeGithub({ runs }), s = createScheduler({ fetchImpl: gh.fetchImpl });
  await s.tick(env, T);
  const body = await s.status(env, T);
  assert.equal(body.ok, true);
  assert.equal(body.token, "set");
  assert.equal(body.now, "2026-11-02T10:50:00.000Z");
  assert.deepEqual(body.jobs.map((j) => j.workflow), FILES);
  const by = Object.fromEntries(body.jobs.map((j) => [j.workflow, j]));
  assert.equal(by["value-bets.yml"].cron, "30 * * * *");
  assert.equal(by["value-bets.yml"].slot, "2026-11-02T10:30:00.000Z");
  assert.equal(by["value-bets.yml"].next_slot, "2026-11-02T11:30:00.000Z");
  assert.deepEqual([by["value-bets.yml"].last_tick.action, by["value-bets.yml"].last_tick.reason], ["skipped", "run-in-slot"]);
  assert.equal(by["scraper-update.yml"].last_tick.action, "dispatched");
  assert.deepEqual(by["site.yml"].last_dispatched_run, { created_at: ago(3), event: "workflow_dispatch", status: "completed", conclusion: "failure" });
  assert.equal(by["site.yml"].latest_run.event, "push");
  assert.equal(by["scraper-update.yml"].last_dispatched_run, null);
  assert.deepEqual(body.instance, { since: "2026-11-02T10:50:00.000Z", ticks: 1, dispatched: 3, skipped: 1, failed: 0 });
  assert.ok(!JSON.stringify(body).includes(TOKEN));
});

test("/status is a GET on /status only, answers JSON, and is cached for 30 seconds", async () => {
  const gh = fakeGithub(), s = createScheduler({ fetchImpl: gh.fetchImpl });
  assert.equal((await s.fetch(new Request("https://w.test/"), env)).status, 404);
  assert.equal((await s.fetch(new Request("https://w.test/status", { method: "POST" }), env)).status, 404);
  assert.equal(gh.calls.length, 0, "other routes call nothing");
  const res = await s.fetch(new Request("https://w.test/status"), env);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /json/);
  assert.equal((await res.json()).jobs.length, 4);
  const n = gh.calls.length;
  assert.equal(n, 8, "two lookups per job");
  await s.status(env, Date.now() + 5e3);
  assert.equal(gh.calls.length, n, "served from the cache");
  await s.status(env, Date.now() + 40e3);
  assert.equal(gh.calls.length, 2 * n, "refreshed after 30 seconds");
});

test("/status with no token reports it, lists the slots and calls nothing", async () => {
  const gh = fakeGithub(), s = createScheduler({ fetchImpl: gh.fetchImpl });
  const body = await (await s.fetch(new Request("https://w.test/status"), {})).json();
  assert.equal(body.ok, false);
  assert.equal(body.token, "missing");
  assert.match(body.error, /GITHUB_DISPATCH_TOKEN is not set/);
  assert.equal(body.jobs.length, 4);
  assert.ok(body.jobs.every((j) => j.slot && j.next_slot && j.last_dispatched_run === null));
  assert.equal(gh.calls.length, 0);
});

test("/status shows a failing lookup as an error on that job, not a failed page", async () => {
  const gh = fakeGithub({ runs: { "site.yml": 403 } }), s = createScheduler({ fetchImpl: gh.fetchImpl });
  const body = await s.status(env, T);
  assert.match(body.jobs.find((j) => j.workflow === "site.yml").latest_run.error, /HTTP 403/);
  assert.equal(body.jobs.find((j) => j.workflow === "balls-update.yml").latest_run, null);
});

// ---- the measurement -----------------------------------------------------------------------------------------------------------------------------------------------------------------

test("slotsBetween lists the complete slots of a window and leaves out the one still in progress", () => {
  const vb = job("value-bets.yml");
  assert.deepEqual(slotsBetween(vb, Date.parse("2026-11-02T10:00:00Z"), Date.parse("2026-11-02T13:30:00Z")).map(iso), ["2026-11-02T10:30:00.000Z", "2026-11-02T11:30:00.000Z", "2026-11-02T12:30:00.000Z"]);
  assert.deepEqual(slotsBetween(vb, Date.parse("2026-11-02T10:30:00Z"), Date.parse("2026-11-02T12:29:59Z")).map(iso), ["2026-11-02T10:30:00.000Z"], "a slot starting exactly at `from` is in, 12:30 is not over yet");
  assert.equal(slotsBetween(job("balls-update.yml"), Date.parse("2026-11-02T00:47:00Z"), Date.parse("2026-11-03T00:47:00Z")).length, 12, "a day of slots, the last one ending exactly at the end");
});

test("lagReport counts the first run inside each slot: its lag, who started it, the slots with none, and the longest gap between runs", () => {
  const r = (t, event) => ({ createdAt: `2026-11-02T${t}:00Z`, event });
  const runs = [r("11:31", "workflow_dispatch"), r("10:41", "schedule"), r("12:35", "pull_request"), r("10:50", "schedule")];
  const rep = lagReport(runs, job("value-bets.yml"), Date.parse("2026-11-02T10:00:00Z"), Date.parse("2026-11-02T13:30:00Z"));
  assert.deepEqual(rep, {
    workflow: "value-bets.yml", slots: 3, covered: 2, missed: 1, on_time: 1,
    p50_min: 1, p90_min: 11, max_min: 11, longest_gap_h: 0.7, // 10:41 -> 10:50 -> 11:31: the longest gap is 41 minutes; the 10:50 run is the second in its slot so it has no lag of its own
    first_run_by: { schedule: 1, workflow_dispatch: 1 },
  });
  const empty = lagReport([], job("site.yml"), Date.parse("2026-11-02T00:00:00Z"), Date.parse("2026-11-02T06:00:00Z"));
  assert.deepEqual([empty.slots, empty.covered, empty.missed, empty.p50_min, empty.max_min, empty.longest_gap_h], [5, 0, 5, null, null, 0], "00:50 to 04:50; the 05:50 slot is not over at 06:00");
  assert.match(table([rep, empty]), /^workflow\s+slots\s+run\s+missed.*\nvalue-bets\.yml\s+3\s+2\s+1\s+1\s+1\s+11\s+11\s+0\.7\s+schedule 1, workflow_dispatch 1\nsite\.yml/);
});
