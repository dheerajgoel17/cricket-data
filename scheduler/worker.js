// The data workflows' clock, as a Cloudflare Worker on a one-minute Cron Trigger (GitHub's own cron is best-effort and runs hours apart). Each minute it works out, for every job in slots.js, the latest slot that has started
// and, if that slot has no run yet, starts the workflow through the REST API (workflow_dispatch). The workflows keep their own `schedule:` as a fallback, so a late GitHub run never doubles one: a run created inside the slot, or one still running, means "skip".
// Worker secret (never in this file): GITHUB_DISPATCH_TOKEN, a fine-grained token limited to this repository with Actions read and write. Worker variables (wrangler.jsonc): GITHUB_REPO (owner/name) and DISPATCH_REF (default main).
// Nothing in a tick throws: a failing job is logged and counted and the others carry on. GET /status says what each job last did (no secrets).
import { JOBS, MIN, HOUR, nextSlot, slotStart } from "./slots.js";

const API = "https://api.github.com";
const UA = "cricket-data-scheduler";
const FETCH_MS = 8000;
const RETRY_MS = 5 * MIN; // after a failed dispatch, wait this long before asking again (in this instance)
const STUCK_MS = 2 * HOUR; // a run still "running" after this long (the workflows time out at 30-45 min) no longer blocks a new one
const STATUS_TTL_MS = 30e3;
const PER_PAGE = 5;
const PR_EVENTS = new Set(["pull_request", "pull_request_target"]); // dry runs on a branch: they commit nothing, so they never stand in for the real run

export const MISSING_TOKEN = "GITHUB_DISPATCH_TOKEN is not set (cd scheduler && npx wrangler secret put GITHUB_DISPATCH_TOKEN): nothing was dispatched";

export const config = (env) => {
  const token = String(env?.GITHUB_DISPATCH_TOKEN || "").trim(), repo = String(env?.GITHUB_REPO || "").trim(), ref = String(env?.DISPATCH_REF || "main").trim();
  if (!token) return { error: MISSING_TOKEN };
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return { error: "GITHUB_REPO is not set to owner/name (a Worker variable in wrangler.jsonc): nothing was dispatched" };
  return { token, repo, ref };
};

const short = (e) => String(e?.message || e).slice(0, 160);

/** One GitHub REST call for a workflow; anything but 2xx throws with the status and GitHub's own message (the token is scrubbed from it). */
const api = (cfg, fetchImpl) => async (method, path, body) => {
  const r = await fetchImpl(`${API}/repos/${cfg.repo}/actions/workflows/${path}`, {
    method, signal: AbortSignal.timeout(FETCH_MS), body: body ? JSON.stringify(body) : undefined,
    headers: { "User-Agent": UA, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", Authorization: `Bearer ${cfg.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!r.ok) {
    const said = await r.json().then((j) => j?.message, () => "");
    throw new Error(`HTTP ${r.status}${said ? `: ${String(said).replaceAll(cfg.token, "***")}` : ""}`);
  }
  return r.status === 204 ? null : r.json();
};

const runsPath = (file, cfg, extra = "") => `${file}/runs?branch=${encodeURIComponent(cfg.ref)}&per_page=${PER_PAGE}${extra}`;
const real = (runs) => (runs?.workflow_runs || []).filter((r) => !PR_EVENTS.has(r.event));
const brief = (r) => (r ? { created_at: r.created_at, event: r.event, status: r.status, conclusion: r.conclusion } : null);

/** What to do for one job at `now`: "dispatch", or why not. Pure, given the runs GitHub lists (newest first). */
export function decide(job, runs, now) {
  const slot = slotStart(job, now), mine = real(runs);
  if (mine.some((r) => Date.parse(r.created_at) >= slot)) return { slot, action: "skip", reason: "run-in-slot", handled: true };
  if (mine.some((r) => r.status !== "completed" && now - Date.parse(r.created_at) < STUCK_MS)) return { slot, action: "skip", reason: "running" };
  return { slot, action: "dispatch" };
}

export function createScheduler({ fetchImpl = (...a) => globalThis.fetch(...a), jobs: JOB_LIST = JOBS } = {}) {
  const memo = new Map(); // file -> { handled: slot ms, retryAt: ms }: this instance's memory, so a handled slot costs no further calls (a fresh instance just asks once more)
  const last = new Map(); // file -> what the latest tick did for it
  const stats = { since: null, ticks: 0, dispatched: 0, skipped: 0, failed: 0 };
  let cache = null;

  async function runJob(job, cfg, now) {
    const call = api(cfg, fetchImpl), m = memo.get(job.file) || {}, slot = slotStart(job, now);
    const out = (action, extra = {}) => {
      const o = { workflow: job.file, slot: new Date(slot).toISOString(), action, ...extra };
      last.set(job.file, { at: new Date(now).toISOString(), ...o });
      return o;
    };
    try {
      if (m.handled === slot) return { workflow: job.file, slot: new Date(slot).toISOString(), action: "idle" };
      if (m.retryAt > now) return { workflow: job.file, slot: new Date(slot).toISOString(), action: "idle", reason: "backoff" };
      const d = decide(job, await call("GET", runsPath(job.file, cfg)), now);
      if (d.action === "skip") {
        if (d.handled) memo.set(job.file, { handled: slot });
        return out("skipped", { reason: d.reason });
      }
      await call("POST", `${job.file}/dispatches`, { ref: cfg.ref });
      memo.set(job.file, { handled: slot });
      return out("dispatched");
    } catch (e) {
      memo.set(job.file, { ...m, retryAt: now + RETRY_MS });
      return out("failed", { error: short(e) });
    }
  }

  /** One cron tick. Resolves with what happened; never rejects. */
  async function tick(env, now = Date.now()) {
    stats.since ??= new Date(now).toISOString();
    stats.ticks++;
    const at = new Date(now).toISOString(), cfg = config(env);
    if (cfg.error) {
      console.error(`scheduler: ${cfg.error}`);
      return { ok: false, at, error: cfg.error, counts: { dispatched: 0, skipped: 0, failed: 0 }, jobs: [] };
    }
    const jobs = await Promise.all(JOB_LIST.map((j) => runJob(j, cfg, now).catch((e) => ({ workflow: j.file, action: "failed", error: short(e) }))));
    const counts = { dispatched: 0, skipped: 0, failed: 0 };
    for (const j of jobs) if (counts[j.action] != null) counts[j.action]++;
    for (const k of Object.keys(counts)) stats[k] += counts[k];
    const res = { ok: counts.failed === 0, at, counts, jobs: jobs.filter((j) => j.action !== "idle") };
    if (counts.failed) console.error(`scheduler: ${JSON.stringify(res)}`);
    else if (counts.dispatched) console.log(`scheduler: ${JSON.stringify(res)}`);
    return res;
  }

  /** The body of GET /status: the latest decision per job from this instance, plus what GitHub itself lists (the last dispatched run and the latest run). Cached for 30 s. */
  async function status(env, now = Date.now()) {
    if (cache && now - cache.at < STATUS_TTL_MS) return cache.body;
    const cfg = config(env), call = cfg.error ? null : api(cfg, fetchImpl);
    const jobs = await Promise.all(JOB_LIST.map(async (job) => {
      const slot = slotStart(job, now), row = { workflow: job.file, cron: job.cron, slot: new Date(slot).toISOString(), next_slot: new Date(nextSlot(job, now)).toISOString(), last_tick: last.get(job.file) || null, last_dispatched_run: null, latest_run: null };
      if (!call) return row;
      const [d, l] = await Promise.allSettled([call("GET", runsPath(job.file, cfg, "&event=workflow_dispatch")), call("GET", runsPath(job.file, cfg))]);
      row.last_dispatched_run = d.status === "fulfilled" ? brief(real(d.value)[0]) : { error: short(d.reason) };
      row.latest_run = l.status === "fulfilled" ? brief(real(l.value)[0]) : { error: short(l.reason) };
      return row;
    }));
    const body = { ok: !cfg.error, now: new Date(now).toISOString(), token: String(env?.GITHUB_DISPATCH_TOKEN || "").trim() ? "set" : "missing", ...(cfg.error ? { error: cfg.error } : {}), instance: { ...stats }, jobs };
    cache = { at: now, body };
    return body;
  }

  return {
    tick, status,
    async fetch(request, env) {
      if (request.method !== "GET" || new URL(request.url).pathname !== "/status") return new Response("not found", { status: 404 });
      try { return Response.json(await status(env), { headers: { "Cache-Control": "no-store" } }); }
      catch (e) { return Response.json({ ok: false, error: short(e) }, { status: 500 }); }
    },
    scheduled(event, env, ctx) {
      const run = tick(env, Number(event?.scheduledTime) || Date.now()).catch((e) => console.error(`scheduler: tick failed: ${short(e)}`));
      ctx?.waitUntil?.(run);
      return run;
    },
  };
}

export default createScheduler();
