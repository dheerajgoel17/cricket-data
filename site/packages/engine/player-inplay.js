// "What happened before from here" for a batter in the middle of an innings: his own past innings that were in the same spot (runs after the same number of balls faced).
// Pure functions of the progression rows (`Store.playerProgression`); every number is a count of past innings, not a model. Team innings are in `inplay.js`.
import { suggestLines, summarize } from "./stats.js";

/** Balls faced at which the data keeps his runs. Between 10 and 30 balls the live score sits between two of them (a straight line between checkpoints); beyond 30 the gap to his final score is too wide to read. */
export const PLAYER_BALLS = [10, 20, 30];
export const PLAYER_RANGE = [10, 30];
/** How far his past runs at the same point may sit from the live ones: 15% of them, at least 3. */
export const PLAYER_BAND = { pct: 0.15, min: 3 };
/** Fewest similar innings a figure is shown without a "small sample" note. */
export const PLAYER_MIN_SAMPLE = 6;

export const playerBand = (runs) => { const w = Math.max(PLAYER_BAND.min, Math.round(runs * PLAYER_BAND.pct)); return [Math.max(0, runs - w), runs + w]; };

/** Checkpoints of one past innings: [balls, runs] from the start, the 10 / 20 / 30 marks he reached and his end. */
export function progressPoints(row) {
  const pts = [[0, 0]];
  PLAYER_BALLS.forEach((b, i) => { if (row.x?.[i] != null) pts.push([b, row.x[i]]); });
  if (row.b > pts[pts.length - 1][0]) pts.push([row.b, row.r]);
  return pts;
}

/** His runs after `balls` balls in a past innings, read between checkpoints; null if the innings ended before. */
export function playerRunsAt(row, balls) {
  if (!(row.b >= balls)) return null;
  const pts = progressPoints(row);
  for (let i = 1; i < pts.length; i++) {
    const [b1, r1] = pts[i], [b0, r0] = pts[i - 1];
    if (balls <= b1) return b1 === b0 ? r1 : r0 + ((r1 - r0) * (balls - b0)) / (b1 - b0);
  }
  return pts[pts.length - 1][1];
}

/**
 * His own innings in the same spot as the live one: `rows` from `playerProgression`, `fmt` the format index (never mixed), `state` `{ balls, runs }`, `line` an optional score to count over / under.
 * `{ n, band, values, summary, ladder, low }` like `conditionalReport` (the values are his final scores). Null outside `PLAYER_RANGE` balls.
 */
export function playerConditional(store, rows, { fmt, state, line = null }) {
  if (!(state.balls >= PLAYER_RANGE[0] && state.balls <= PLAYER_RANGE[1])) return null;
  const band = playerBand(state.runs);
  const values = (rows || []).filter((r) => store.M.f[r.m] === fmt).flatMap((r) => {
    const at = playerRunsAt(r, state.balls);
    return at != null && at >= band[0] && at <= band[1] ? [r.r] : [];
  });
  const step = state.runs >= 30 ? 10 : 5;
  const lines = suggestLines(values, step, 5);
  return { n: values.length, band, state, values, summary: summarize(values, line), ladder: lines.map((l) => summarize(values, l)), low: values.length < PLAYER_MIN_SAMPLE };
}
