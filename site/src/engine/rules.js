// Betting-exchange settlement rules used across the site (kept in one place so the UI can print them).
export const RULES = [
  "T20 summary markets are void unless at least 80% of the scheduled overs (96 balls) were bowled in BOTH innings; ODI likewise (240 of 300 balls); The Hundred 80 of 100; T10 48 of 60; 60-over 288 of 360.",
  "Tests: summary markets are void unless there is a result, or at least 300 overs (5-day) / 200 overs (4-day) were bowled.",
  "30s = scores of 30-49, 50s = 50-99, 100s = 100+. Double-digit = 10+. Single-digit = 1-9 (ducks are not single-digit).",
  "Team-specific markets count only the team batting first.",
  "Retired hurt is not a wicket. Penalty runs count. Super overs are ignored.",
  "A player named in the XI who never reaches the crease (or never bowls) has his bat (or bowl) bets voided: shown as VOID and left out of hit rates. Not in the XI at all = DNP.",
  "Formats are never mixed: T20 form never feeds ODI or Test numbers. T20 = T20 + T20I, ODI = ODI + 50-over List A, Test = Tests only, The Hundred / T10 / 60-over are their own formats; first-class cricket is not included.",
];

export const STATS = {
  runs: { label: "Runs", side: "bat", key: "r", step: 1 },
  balls: { label: "Balls faced", side: "bat", key: "b", step: 1 },
  fours: { label: "Fours", side: "bat", key: "f", step: 1 },
  sixes: { label: "Sixes", side: "bat", key: "s", step: 1 },
  wickets: { label: "Wickets", side: "bowl", key: "w", step: 1 },
  runs_conceded: { label: "Runs conceded", side: "bowl", key: "c", step: 1 },
  balls_bowled: { label: "Balls bowled", side: "bowl", key: "n", step: 1 },
  // the "player performance" market: runs + 20 per wicket + 10 per catch + 25 per stumping, from his batting, bowling and fielding in the match; named in the XI and doing none of it is 0, not void
  points: { label: "Player performance", side: "all", key: "pts", step: 1, zeroIfNamed: true },
};

/** Stat aliases people actually type. */
export const STAT_WORDS = {
  runs: "runs", run: "runs", score: "runs", scores: "runs", scored: "runs", scoring: "runs",
  balls: "balls", faced: "balls", deliveries: "balls",
  fours: "fours", four: "fours", "4s": "fours", boundaries: "fours",
  sixes: "sixes", six: "sixes", "6s": "sixes", sixers: "sixes", maximums: "sixes",
  wickets: "wickets", wicket: "wickets", wkts: "wickets", wickts: "wickets", scalps: "wickets",
  conceded: "runs_conceded", expensive: "runs_conceded", leaked: "runs_conceded",
  points: "points", performance: "points", fantasy: "points",
};
