// Slot rules for the scheduler Worker: one cron string per job, the same string the workflow keeps in its own `schedule:` as the fallback (site/tests/scheduler.test.mjs checks they agree).
// A slot is a moment the cron would fire (UTC). slotStart is the one pure function behind every decision: the latest slot at or before `now`.
// Only the minute and hour fields are read ("*", "N", "a,b", "*/n"); day, month and weekday must be "*".
export const JOBS = [
  { file: "scraper-update.yml", cron: "7,37 * * * *" },
  { file: "value-bets.yml", cron: "30 * * * *" },
  { file: "site.yml", cron: "50 * * * *" },
  { file: "balls-update.yml", cron: "47 */2 * * *" },
  { file: "inplay.yml", cron: "* * * * *" }, // the in-play snapshot: a one-minute run, so every minute is a slot (a run still going counts as "running" and the next minute starts it)
];

export const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;

const parseField = (text, max) => {
  const out = new Set();
  for (const part of text.split(",")) {
    const m = /^(?:\*\/([1-9]\d*)|(\*)|(\d+))$/.exec(part);
    if (!m || (m[3] != null && Number(m[3]) > max)) throw new Error(`unsupported cron field "${text}"`);
    if (m[3] != null) out.add(Number(m[3]));
    else for (let v = 0; v <= max; v += m[1] ? Number(m[1]) : 1) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
};

export const parseCron = (cron) => {
  const f = String(cron).trim().split(/\s+/);
  if (f.length !== 5 || f.slice(2).some((x) => x !== "*")) throw new Error(`unsupported cron "${cron}"`);
  return { minutes: parseField(f[0], 59), hours: parseField(f[1], 23) };
};

/** Every slot of the days around `now`, in order. */
const around = (job, now, days) => {
  const { minutes, hours } = parseCron(job.cron), day = Math.floor(now / DAY) * DAY, out = [];
  for (const d of days) for (const h of hours) for (const m of minutes) out.push(day + d * DAY + h * HOUR + m * MIN);
  return out.sort((a, b) => a - b);
};

/** The latest slot at or before `now` (ms since epoch). */
export const slotStart = (job, now) => around(job, +now, [-1, 0]).filter((t) => t <= now).at(-1);

/** The first slot strictly after `now`. */
export const nextSlot = (job, now) => around(job, +now, [0, 1]).find((t) => t > now);
