// Rule-based question parser. Used when the language model is unavailable or returns something unusable, and by tests.
// Output is a raw plan for sanitizePlan(); it never contains numbers other than the user's own line / years.
import { STAT_WORDS } from "./rules.js";
import { lev, norm } from "./util.js";

const FILLER = new Set(("a an the of in on at for to is are was were will would what whats what's how many much does do did has have had " +
  "get gets got hit hits score scores scored scoring who when which player batter batsman bowler hitting more than less than at least most " +
  "over under line odds price fair chance probability prob prop props bet match matches innings game games please tell me show give stats stat " +
  "record rate percentage times often usually ever career form recent number no its it their his her with and or vs versus against v " +
  "from by as be been being can could should if then also just only into out up down about home away neutral first second bat batting " +
  "bowl bowling chase chasing opening open opener openers together partnership partnerships stand stands gets goes go out wicket " +
  "team teams total totals sides side").split(" "));

const FORMAT_WORDS = { t20: "T20", t20i: "T20", t20is: "T20", t20s: "T20", odi: "ODI", odis: "ODI", test: "Test", tests: "Test", hundred: "Hundred", t10: "T10", o60: "O60" };
const MARKET_WORDS = [
  [/\b(team total|team score|innings total|first innings (total|score))\b/, "team_runs"],
  [/\b(highest|biggest|most expensive) over\b/, "highest_over"],
  [/\b(most|biggest) (runs )?conceded\b|\bexpensive bowler\b/, "max_conceded"],
  [/\bmost wickets\b/, "max_wickets"], [/\bfirst over\b/, "first_over"],
  [/\bdouble[- ]?digit/, "match_double_digits"], [/\bsingle[- ]?digit/, "match_single_digits"],
  [/\b(30s|thirties)\b/, "match_30s"], [/\b(50s|fifties|half[- ]?centuries)\b/, "match_50s"], [/\b(100s|hundreds|centuries)\b/, "match_100s"],
  [/\bducks?\b/, "match_ducks"], [/\bextras\b/, "match_extras"], [/\brun[- ]?outs?\b/, "match_runouts"],
  [/\b(sixes|sixs|6s)\b/, "match_sixes"], [/\b(fours|4s)\b/, "match_fours"],
  [/\b(total runs|match total|match runs|runs in the match)\b/, "match_runs"], [/\bwickets\b/, "match_wickets"],
];

function fuzzyIn(word, dict) {
  if (dict[word]) return dict[word];
  if (word.length < 4) return null;
  const max = word.length >= 8 ? 2 : 1;
  for (const k of Object.keys(dict)) if (k.length >= 4 && lev(k, word, max) <= max) return dict[k];
  return null;
}

function takeRegex(text, rx) {
  const m = text.match(rx);
  if (!m) return [text, null];
  return [text.replace(m[0], " "), m];
}

export function parseQuestion(question, rz, store) {
  const toNum = (x) => Number(String(x).replace("p", "."));
  let t = ` ${norm(question.replace(/(\d)\.(\d)/g, "$1p$2")).replace(/\b(\d+) s\b/g, "$1s")} `;
  const plan = { kind: "unknown", filters: {}, question };
  const note = [];

  // gender / format
  if (/\bwomen(s)?\b|\bfemale\b|\bladies\b/.test(t)) { plan.filters.gender = "female"; t = t.replace(/\b(women s|womens|women|female|ladies)\b/g, " "); }
  const words = t.split(" ").filter(Boolean);
  for (const w of words) { const f = FORMAT_WORDS[w] || (w.length >= 3 && fuzzyIn(w, FORMAT_WORDS)); if (f) { plan.filters.format = f; t = t.replace(new RegExp(`\\b${w}\\b`), " "); break; } }
  if (/\bone day\b/.test(t)) { plan.filters.format = "ODI"; t = t.replace(/\bone day\b/, " "); }

  // venue type, innings
  let m;
  if ((m = t.match(/\b(away|home|neutral)\b/))) plan.filters.venue_type = m[1];
  if (/\b(batting first|bat first|batted first|setting|1st innings|first innings)\b/.test(t)) plan.filters.innings = "first";
  if (/\b(chasing|chase|batting second|bat second|batted second|2nd innings|second innings)\b/.test(t)) plan.filters.innings = "second";
  t = t.replace(/\b(batting first|bat first|batted first|setting|1st innings|first innings|chasing|chase|batting second|bat second|batted second|2nd innings|second innings)\b/g, " ");

  // positions
  if ((m = t.match(/\b(?:at )?(?:number|no|pos|position|batting at)\s*(\d{1,2})\b/))) { plan.filters.position = [Number(m[1]), Number(m[1])]; t = t.replace(m[0], " "); }
  else if (/\b(top order)\b/.test(t)) plan.filters.position = [1, 3];
  else if (/\b(middle order)\b/.test(t)) plan.filters.position = [4, 6];
  else if (/\b(lower order|tail)\b/.test(t)) plan.filters.position = [7, 11];

  // last N, dates
  if ((m = t.match(/\blast (\d{1,3})\b/))) { plan.filters.last_n = Number(m[1]); t = t.replace(m[0], " "); }
  const year = new Date().getFullYear();
  if ((m = t.match(/\b(?:since|from|after)\s+(20\d\d|19\d\d)\b/))) { plan.filters.since = `${m[1]}-01-01`; t = t.replace(m[0], " "); }
  else if ((m = t.match(/\b(?:in|during)\s+(20\d\d)\b/))) { plan.filters.since = `${m[1]}-01-01`; plan.filters.until = `${m[1]}-12-31`; t = t.replace(m[0], " "); }
  else if (/\bthis year\b/.test(t)) { plan.filters.since = `${year}-01-01`; t = t.replace(/\bthis year\b/, " "); }
  else if (/\blast year\b/.test(t)) { plan.filters.since = `${year - 1}-01-01`; plan.filters.until = `${year - 1}-12-31`; t = t.replace(/\blast year\b/, " "); }

  // side + line
  if ((m = t.match(/\b(over|under|more than|less than|fewer than|above|below|exceed|exceeds|at least|o|u)\s*(\d+(?:p\d+)?)\b/))) {
    const w = m[1];
    const over = ["over", "more than", "above", "exceed", "exceeds", "at least", "o"].includes(w);
    plan.side = over ? "over" : "under";
    plan.line = w === "at least" ? toNum(m[2]) - 0.5 : toNum(m[2]);
    t = t.replace(m[0], " ");
  } else if ((m = t.match(/\b(\d+p5)\b/))) { plan.line = toNum(m[1]); plan.side = /\bunder|below|less|fewer\b/.test(t) ? "under" : "over"; t = t.replace(m[0], " "); }
  else if (/\bto (score|hit|get) (a )?(fifty|half century|50)\b/.test(t)) { plan.line = 49.5; plan.side = "over"; plan.stat = "runs"; }
  else if (/\b(fifty|half century)\b/.test(t) && !/\bfifties\b/.test(t)) { plan.line = 49.5; plan.side = "over"; plan.stat = "runs"; }
  else if (/\b(century|hundred)\b/.test(t) && !/\bcenturies|hundreds\b/.test(t)) { plan.line = 99.5; plan.side = "over"; plan.stat = "runs"; }
  if (!plan.side && /\b(under|below|fewer)\b/.test(t)) plan.side = "under";
  if (!plan.side && /\b(over|above|more)\b/.test(t)) plan.side = "over";

  // competition
  for (const k of ["t20 world cup", "world cup", "champions trophy", "asia cup", "ashes", "ipl", "bbl", "wbbl", "psl", "cpl", "sa20", "ilt20", "blast", "lpl", "bpl", "mlc", "wpl"]) {
    if (new RegExp(`\\b${k}\\b`).test(t) && rz.event(k)) { plan.competition = k; t = t.replace(new RegExp(`\\b${k}\\b`), " "); break; }
  }

  t = t.replace(/\bat (home|neutral)\b/g, " $1 ");
  // opposition: "vs X", "against X"
  [t, m] = takeRegex(t, /\b(?:vs|versus|against|v)\s+([a-z ]{2,30}?)(?=\s+(?:at|in|for|when|since|from|last|over|under|away|home|neutral|batting|chasing|odi|t20|test|sixes|fours|runs|wickets)\b|\s*$|\s+\d)/);
  if (m) plan.filters.opposition = m[1].trim();
  // venue: "at X"
  [t, m] = takeRegex(t, /\bat\s+([a-z' ]{3,40}?)(?=\s+(?:in|for|when|since|from|last|over|under|vs|against|batting|chasing|odi|t20|test)\b|\s*$|\s+\d)/);
  if (m) { const v = rz.venue(m[1]); if (v) plan.venue = v.name; else t += ` ${m[1]} `; }
  // "away from England" / "for England"
  [t, m] = takeRegex(t, /\b(?:away from|home to|home for|away for|for)\s+([a-z ]{3,25}?)(?=\s+(?:in|when|since|from|last|over|under|vs|against|batting|chasing|odi|t20|test)\b|\s*$|\s+\d)/);
  if (m) { const tm = rz.team(m[1], plan.filters.gender === "female" ? 1 : 0); if (tm) { plan.filters.for_team = m[1].trim(); plan.team = m[1].trim(); } else t += ` ${m[1]} `; }

  // stat
  const toks = t.split(" ").filter(Boolean);
  if (!plan.stat) for (const w of toks) { const s = fuzzyIn(w, STAT_WORDS); if (s) { plan.stat = s; break; } }
  if (/\bruns conceded|conceded\b/.test(t)) plan.stat = "runs_conceded";
  else if (/\bballs faced|balls\b/.test(t)) plan.stat = "balls";

  // intent
  const partnershipIntent = /\b(partnership|partnerships|open together|opens? with|who (gets|goes|is) out first|out first|bat together|opening stand|opening pair)\b|\b(open(s|ing)?)\b.*\b(and|with|&)\b/.test(t) || /\bwho gets out first\b/.test(norm(question));
  const marketMatch = MARKET_WORDS.find(([rx]) => rx.test(t));
  const topBatter = /\btop (batter|batsman|scorer|score)\b|\bmost runs\b.*\b(team|match)\b/.test(t);

  // names: whatever is left after dropping filler and the words we understood
  const leftover = [];
  let cur = [];
  for (const w of t.split(" ").filter(Boolean)) {
    const drop = FILLER.has(w) || STAT_WORDS[w] || /^\d/.test(w) || FORMAT_WORDS[w];
    if (drop) { if (cur.length) leftover.push(cur); cur = []; } else cur.push(w);
  }
  if (cur.length) leftover.push(cur);
  const isAnd = /\b(and|with|&)\b/.test(norm(question));
  const names = [];
  for (const run of leftover) {
    const c = rz.player(run.join(" "), { gender: plan.filters.gender === "female" ? 1 : null });
    if (c) names.push({ text: run.join(" "), score: c.score });
    else if (run.length > 1) for (const w of run) { const c1 = rz.player(w, { gender: plan.filters.gender === "female" ? 1 : null }); if (c1) names.push({ text: w, score: c1.score }); }
  }
  names.sort((a, b) => b.score - a.score);

  if (partnershipIntent && names.length >= 2 && isAnd) {
    plan.kind = "partnership";
    const pick = names.slice(0, 2).sort((a, b) => norm(question).indexOf(norm(a.text)) - norm(question).indexOf(norm(b.text)));
    plan.player = pick[0].text; plan.player2 = pick[1].text;
    plan.opening = /\b(open|opens|opening|openers?)\b/.test(t) || /\bopen\b/.test(norm(question));
    delete plan.filters.position;
    return plan;
  }
  const teamWord = /\b(team|side)\b/.test(norm(question));
  if ((marketMatch || topBatter) && (teamWord || !(names.length && plan.stat && !/\bmatch\b/.test(t)))) {
    plan.kind = topBatter && !marketMatch ? "top_batter" : "match_market";
    if (marketMatch) plan.market = marketMatch[1];
    const team = [...t.split(" ")].join(" ");
    for (const run of leftover) {
      const tm = rz.team(run.join(" "), plan.filters.gender === "female" ? 1 : 0);
      if (tm) { plan.team = run.join(" "); break; }
    }
    if (!plan.team && names.length && !plan.competition && !plan.venue) delete plan.player;
    if (plan.team && plan.market?.startsWith("match_") && /\b(team|batting first)\b/.test(t)) plan.market = plan.market.replace("match_", "team_");
    return plan;
  }
  if (names.length && plan.stat) {
    plan.kind = "player_prop";
    plan.player = names[0].text;
    if (plan.filters.position && /\bopen/.test(t)) plan.filters.position = [1, 2];
    if (plan.line == null) plan.side = null;
    return plan;
  }
  if (names.length && /\bopen/.test(norm(question))) plan.filters.position = [1, 2];
  return plan;
}
