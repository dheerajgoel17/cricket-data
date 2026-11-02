#!/usr/bin/env node
// How late do the data workflows start? For each job in slots.js and each complete slot in the window, finds the first run created inside that slot and reports its lag, who started it
// (GitHub's own "schedule" or this Worker's "workflow_dispatch") and the slots that got no run at all. Run it before and after deploying the Worker to see the gap close.
//   node scheduler/measure.mjs [--days 3 | --from 2026-11-01T00:00Z --to 2026-11-02T00:00Z] [--limit 500] [--repo owner/name] [--json]
// Reads the run lists with the GitHub CLI (`gh`, already signed in); no token is handled here. Pull-request runs are ignored (they commit nothing).
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { JOBS, MIN, HOUR, nextSlot } from "./slots.js";

const PR_EVENTS = new Set(["pull_request", "pull_request_target"]);
export const ON_TIME_MIN = 5;

/** The slots that started in [from, to) and ended by `to` (the slot still in progress is not judged). */
export function slotsBetween(job, from, to) {
  const out = [];
  for (let s = nextSlot(job, from - 1); nextSlot(job, s) <= to; s = nextSlot(job, s)) out.push(s);
  return out;
}

const pct = (sorted, p) => (sorted.length ? sorted[Math.ceil(p * sorted.length) - 1] : null);
const round = (x) => (x == null ? null : Math.round(x * 10) / 10);

/** runs: [{ createdAt, event }] (any order). Lags are in minutes; percentiles are nearest-rank. */
export function lagReport(runs, job, from, to) {
  const rs = runs.filter((r) => !PR_EVENTS.has(r.event)).map((r) => ({ t: Date.parse(r.createdAt), event: r.event })).sort((a, b) => a.t - b.t);
  const slots = slotsBetween(job, from, to), lags = [], firstBy = {};
  for (const s of slots) {
    const end = nextSlot(job, s), first = rs.find((r) => r.t >= s && r.t < end);
    if (!first) continue;
    lags.push((first.t - s) / MIN);
    firstBy[first.event] = (firstBy[first.event] || 0) + 1;
  }
  const inWindow = rs.filter((r) => r.t >= from && r.t < to);
  let gap = 0;
  for (let i = 1; i < inWindow.length; i++) gap = Math.max(gap, inWindow[i].t - inWindow[i - 1].t);
  const sorted = [...lags].sort((a, b) => a - b);
  return {
    workflow: job.file, slots: slots.length, covered: lags.length, missed: slots.length - lags.length, on_time: lags.filter((l) => l <= ON_TIME_MIN).length,
    p50_min: round(pct(sorted, 0.5)), p90_min: round(pct(sorted, 0.9)), max_min: round(sorted.at(-1) ?? null), longest_gap_h: round(gap / HOUR), first_run_by: firstBy,
  };
}

export function table(rows) {
  const head = ["workflow", "slots", "run", "missed", `<=${ON_TIME_MIN}m`, "p50 min", "p90 min", "max min", "gap h", "first run by"];
  const body = rows.map((r) => [r.workflow, r.slots, r.covered, r.missed, r.on_time, r.p50_min ?? "-", r.p90_min ?? "-", r.max_min ?? "-", r.longest_gap_h, Object.entries(r.first_run_by).map(([k, v]) => `${k} ${v}`).join(", ") || "-"].map(String));
  const w = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  return [head, ...body].map((r) => r.map((c, i) => c.padEnd(w[i])).join("  ").trimEnd()).join("\n");
}

function arg(name, args) {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? null : args[i + 1] ?? "";
}

function main(args) {
  const to = arg("to", args) ? Date.parse(arg("to", args)) : Date.now(), days = Number(arg("days", args) || 3);
  const from = arg("from", args) ? Date.parse(arg("from", args)) : to - days * 24 * HOUR, limit = arg("limit", args) || "500", repo = arg("repo", args);
  if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error("--from / --to must be dates such as 2026-11-01T00:00Z");
  const rows = JOBS.map((job) => {
    const out = execFileSync("gh", ["run", "list", "--workflow", job.file, "--limit", limit, "--json", "createdAt,event", ...(repo ? ["--repo", repo] : [])], { encoding: "utf8", maxBuffer: 64e6 });
    return lagReport(JSON.parse(out), job, from, to);
  });
  console.log(args.includes("--json") ? JSON.stringify({ from: new Date(from).toISOString(), to: new Date(to).toISOString(), rows }, null, 2) : `${new Date(from).toISOString()} .. ${new Date(to).toISOString()}\n${table(rows)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); } catch (e) { console.error(`measure: ${e.message}`); process.exit(1); }
}
