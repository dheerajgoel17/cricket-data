// Coarse score bands keep like situations together without treating every price tick as a new innings.
export function batterHistoryKey({ fmt, gender, balls, runs, line }) {
  if (!["T20", "ODI"].includes(fmt) || ![0, 1].includes(gender) ||
      ![balls, runs, line].every(Number.isFinite) || balls < 1 || runs < 0 || line < runs) return null;
  return [fmt, gender, Math.floor(balls / 6), Math.floor(runs / 5), Math.floor((line - runs) / 5)].join("|");
}
