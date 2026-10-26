// The instruction given to the language model. It only ever sees the question text, never any data,
// and may only return a query plan (see plan.js sanitizePlan). Numbers in answers come from the engine.
export const PLAN_SCHEMA = `{
  "kind": "player_prop" | "partnership" | "match_market" | "top_batter" | "unknown",
  "player": string|null,            // as written by the user; fix obvious typos ("Kohlli" -> "Kohli"), keep surname
  "player2": string|null,           // partnership questions only
  "stat": "runs"|"balls"|"fours"|"sixes"|"wickets"|"runs_conceded"|"balls_bowled"|null,
  "line": number|null,              // e.g. 0.5, 24.5. "to score a fifty" -> stat runs, line 49.5, side over
  "side": "over"|"under"|null,
  "market": "match_runs"|"match_wickets"|"match_fours"|"match_sixes"|"match_30s"|"match_50s"|"match_100s"|"match_double_digits"|"match_single_digits"|"match_ducks"|"highest_over"|"max_conceded"|"top_score"|"team_runs"|"team_wickets"|"team_fours"|"team_sixes"|"team_30s"|"team_50s"|"team_double_digits"|"team_single_digits"|"team_ducks"|"team_top_score"|"team_highest_over"|null,
  "team": string|null,              // team / country the question is about (match_market, top_batter, or the player's side)
  "venue": string|null,             // ground name or city
  "competition": string|null,       // IPL, BBL, PSL, World Cup, Ashes ...
  "opening": boolean,               // true when the pair are the opening partnership
  "scope": "innings"|"match",       // "match" only for Test aggregates across both innings
  "split_by": ["opposition"|"venue"|"venue_type"|"innings"|"position"|"year"|"competition"],
  "filters": {
    "format": "T20"|"ODI"|"Test"|"Hundred"|null,   // T20I counts as T20, List A as ODI; never combine formats
    "gender": "male"|"female"|null,
    "opposition": string|null,
    "venue_type": "home"|"away"|"neutral"|null,
    "for_team": string|null,             // whose home/away: "away from England" -> for_team England
    "innings": "first"|"second"|null,    // batting first / chasing
    "position": number|"lo-hi"|null,     // batting position, openers = "1-2"
    "since": "YYYY-MM-DD"|null, "until": "YYYY-MM-DD"|null,
    "last_n": number|null,
    "international": boolean|null
  }
}`;

export const EXAMPLES = [
  ["Harry Brook ODI sixes over 0.5 away from England",
    { kind: "player_prop", player: "Harry Brook", stat: "sixes", line: 0.5, side: "over", filters: { format: "ODI", venue_type: "away", for_team: "England" } }],
  ["when Banton and Duckett open, who gets out first",
    { kind: "partnership", player: "Banton", player2: "Duckett", opening: true, filters: {} }],
  ["kohlli t20 runs under 30.5 vs pakistan since 2024",
    { kind: "player_prop", player: "Kohli", stat: "runs", line: 30.5, side: "under", filters: { format: "T20", opposition: "Pakistan", since: "2024-01-01" } }],
  ["ipl match sixes over 14.5 at wankhede",
    { kind: "match_market", market: "match_sixes", line: 14.5, side: "over", venue: "Wankhede", competition: "IPL", filters: { format: "T20" } }],
];

export function buildPrompt(question, today) {
  const ex = EXAMPLES.map(([q, p]) => `Question: ${q}\nJSON: ${JSON.stringify(p)}`).join("\n\n");
  return {
    system: `You convert cricket statistics questions into a JSON query plan. Today is ${today}.
Reply with ONE JSON object and nothing else, using exactly this shape (omit nothing you are sure of, use null when unknown):
${PLAN_SCHEMA}

Rules:
- Never answer the question and never invent statistics. You only describe what to look up.
- Fix spelling mistakes in names and keywords. Keep the player's name as the user wrote it (surname matters most).
- Odds are decimal only. Ignore match-winner questions: use kind "unknown".
- "this year" = since ${today.slice(0, 4)}-01-01. "last year" = the previous calendar year.
- If the question is not about cricket statistics, return {"kind":"unknown"}.

${ex}`,
    user: `Question: ${String(question).slice(0, 300)}\nJSON:`,
  };
}
