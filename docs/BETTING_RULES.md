# Cricket betting: how the markets work and how books settle them

Research notes (2026-10-28) so lines, filters and offerings follow what bookmakers actually do. Read with `docs/EDGE_CASES.md` (how the site settles) and
`docs/PROJECT_GUIDE.md` section 1 (exchange rules we adopted). Section 6 lists where the product differs from the books and what to do about it.

**Sources and confidence.** High: the full published cricket rulebook of a large UK bookmaker (every market below marked UK-A comes from it), the NZ TAB cricket
rules (Rule 13.11, in force 28 Oct 2023) and one casino sportsbook's house rules. Medium (search excerpts, the pages block direct fetches): bet365, Sportsbet and
PointsBet (Australia), TAB (Australia), the shared platform terms behind Unibet-style books, Smarkets, Paddy Power, Betfred, an older Ladbrokes rulebook. Low: the
Indian "fancy" exchange markets (only promotional pages were reachable) and the Betfair Exchange's own cricket rules (blocked). Rules change and differ by book,
jurisdiction and market: **treat every number here as "typical", and never hard-code one book's rule as the rule.**

## 1. What the books offer (market families)

| family | typical line | examples |
|---|---|---|
| Player over/under | x.5 (so no push) | runs, fours, sixes, wickets, balls faced; Test lines for the first innings or for the match |
| Player ladders (Yes/No) | fixed rungs | to score 10/20/30/40, a 50, a 100 (a "half-century" is 49.5 for us); to hit a six; "at least N runs" ladders are often Yes-only |
| Ranged | bands | batter runs 0-9, 10-19 ... "X+"; innings runs bands (the exchange uses 10-run bands) |
| Team / innings totals | x.5 | runs, fours, sixes, wickets, extras, ducks, run outs; second-innings totals are priced before the match too |
| Match totals | x.5 | match fours, match sixes, match boundaries, total runs, highest over |
| Outright / head to head | price | top batter or bowler (match, team, innings, series), batter v batter, bowler v bowler, player points |
| Time windows | x.5 | runs in over N, first over, powerplay / group of overs, Test sessions, opening partnership, runs at fall of Nth wicket |
| Exchange / "fancy" | Yes/No at a rate | session (runs in the first N overs), innings total ("lambi"), player runs, partnership; platform-specific, see 5 |

## 2. Settlement conventions (what nearly every book does)

* **Source:** the official scorecard (UK-A: the tournament's official scorecard, else a public scorecard site). Settlement can be delayed until a doubtful result is resolved.
* **Super over:** nothing in it counts, in any market (runs, wickets, fours, sixes, extras, ducks, catches).
* **Fours and sixes** count only when scored off the bat; overthrows, all-run fours and extras do not. A "boundary" market counts fours and sixes. (Our parser already drops `non_boundary` fours.)
* **Not out / declared:** the score stands; a declared or all-out innings is complete.
* **Retired hurt:** runs stand; if he returns they add up, if not the score when he left is the result; it is **not a wicket**. Retired **out** is a wicket. A timed-out or retired-out dismissal counts as on the previous ball.
* **Substitutes:** a concussion or tactical substitute: the player replaced and the replacement are both treated as having played a full part (UK-A). Ordinary fielding substitutes do not bat or bowl.
* **Extras and penalty runs** count for team and over markets, not for player runs. Penalty runs added after an innings ends do not count for that innings.
* **Result already determined:** if the outcome cannot change (the line has been passed, or the batter is out) the bet settles normally even if the match is then cut short. Only an undetermined bet is voided.
* **Tie / dead heat:** top-batter and top-bowler ties are dead heats (bowlers first split on fewest runs conceded). A tied match is settled by the official competition rule (a super over or bowl-off only if the competition uses one).
* **Abandoned / no result:** void unless the official competition rules give a winner (a DLS result counts). A match cancelled before a ball is void unless replayed within 48 hours of its listed start, or an official reserve day exists (then bets run on).
* **Venue changes** stand unless the match moves to the opponent's ground (or another country).

### 2.1 "Player did not bat" is not one rule

| situation | over/under on his runs | Yes/No ladder (to score N, to hit a six) | top batter / matchbet |
|---|---|---|---|
| not in the XI | void (everyone) | void | void (most), stands for series outrights |
| named in the XI, never bats | **void** (UK-A, William Hill UK, Paddy Power, Betfred, Sportsbet, PointsBet); older NZ rules and one casino sportsbook settle it as a **loss** | **loses** if he is in the XI (UK-A: "settled regardless of whether the player reaches the crease") | **loses** (Smarkets, bet365, UK-A) |
| reaches the crease, faces no ball, not out | stands (PointsBet); Sportsbet needs a ball bowled while he is at the crease; the shared platform terms: reach the crease while a ball is bowled | stands | stands |
| retired hurt, returns | runs add up | as left | as left |

So one stat can be **void** for one book and **a loser** for another. Hit rates that drop "VOID" games are right for an over/under and wrong for a ladder or a top-batter market.

### 2.2 Rain and reduced overs: the thresholds differ by book and market

Measured against the overs scheduled **at the time the bet was placed** (a pre-match line is judged against the original schedule).

| market | UK-A | NZ TAB | other |
|---|---|---|---|
| player runs / balls faced / fall of wicket (limited overs) | void if under **80%** of scheduled overs in either innings, unless determined | n/a | Smarkets and an older Ladbrokes rulebook: 80%; the shared platform terms: a 50 / 100 bet voids only if the cut is **10%+** (any cut if the innings was 10 overs or fewer) |
| team innings runs | 80% of the innings; once a ball is bowled TAB (Australia) settles on whatever was scored | void if overs cut **more than 20%** or the innings is under 10 overs | Smarkets: 80% |
| match fours / sixes / extras / wickets / ducks | 80% of overs scheduled, or the match is complete with at least 80% scheduled | void at a 20%+ cut | a regulator-filed rulebook for match sixes: void at a cut of 10+ overs (50-over) or 4+ (T20) after the bet, which is the same 20% |
| top batter / top bowler | void under **50%** of scheduled overs; the "to win and be top scorer" doubles need 25 (50-over) / 20 (40-over) / 10 (T20) overs unless all out or the chase ends sooner | 25 / 20 / 10 (T20 bowler 15) | an older Ladbrokes rule: 20 (T20 10) |
| runs in an over / session | the over must be completed; a session needs **20 overs** bowled | 6-over runs stand unless 6 overs are not completed | |
| match winner | official result, a DLS result stands; no result = void | | |

The Hundred counts balls, not overs (5-ball overs, 100 balls): 80 of 100 is the 80%.

### 2.3 Test and first-class

* **First innings only is common for pre-match player markets.** UK-A: "for pre-match bets, only the batter's first innings will count" (player runs, balls faced, a 50 or 100, bowler wickets), and top batter / bowler, team v team most fours / sixes / extras / run outs and highest opening partnership count only each team's first innings. bet365: its head-to-head batter market is first innings only in a Test, some match-level markets say all innings of the match count, and the wording for its batter match-runs market was not conclusive. Feed K's Test event prices "Player's Total Runs - Innings 1" separately. **The scope is per book and per market; it must be a field on the line, not assumed.**
* **Minimum play:** a drawn first-class match voids most markets under **200 overs** bowled (NZ TAB: 200 overs for most unlimited-overs markets; its page text is ambiguous), an incomplete innings under **60 overs** voids innings runs, top batter / bowler need **60 overs** in the innings (a casino rulebook) or 50 (UK-A double markets), a session needs 20 overs. "All out or declared" counts as a natural end, so a short innings still settles.
* Declaration = the innings is complete. A follow-on is its own market. DLS does not apply in Tests. A Test abandoned for a non-weather reason voids open bets (Smarkets).
* Draw: a draw is a real result in a Test; where it is offered, draw bets win and a tie is a dead heat between the sides (UK-A: draw bets lose if the official result is a tie).
* **Bets on a future innings stay valid whatever happens in the current one** (UK-A), which is why second-innings team lines exist before the match.
* A player's "Innings 1" is his own team's first innings (Feed K's Test event prices it for both sides' batters; inferred from the labels), while a team-runs "first innings" market can mean the first innings of the match: label them differently.

## 3. Lines

* **Half-lines (x.5)** dominate; a **whole-number line** needs push handling (stake back) and exists on the exchange line markets and some books. Our chart already has a push state.
* **Over and under are priced separately** (a two-way book has a margin; no-vig probability needs both prices, see `overProb`). A Yes-only ladder rung has no margin to remove.
* **Alternative lines / ladders** are the same player at many rungs; the books' main line is the one nearest evens.
* **Different books quote different lines for the same player** (live data 2026-10-28: Ladbrokes 14.5 v bet365 17.5 for the same batter). That is line shopping: the useful object is "this player, this stat, this scope: every book's line and price".
* A pre-match line is set for a scheduled-length match; the 80% rule is judged against that.
* Quarter and Asian-style lines are not used in cricket.

## 4. In-play

* Books keep pricing a started match: next over, session, next wicket, innings and team totals for the innings in progress, **second-innings totals after the first innings ends** (for example a team's fours at 33.5 in the second innings), player runs for a batter at the crease.
* A bet struck in play is judged against the overs scheduled **when it was placed**, and a "determined" bet (line already passed) always settles.
* In-play lines move every ball, so an hourly snapshot is stale by design; a live line needs its own short-lived feed and a freshness stamp.

## 5. Exchange and "fancy" markets

* The Betfair Exchange lists innings runs as 10-run bands ("250 or more") and "line" markets on the exchange (over/under a runs line); a declared or all-out innings is complete. Its own cricket rules were not reachable; the sportsbook rules page says the sportsbook rules do **not** apply to the Exchange.
* **Indian-style fancy markets** (low confidence): *session* = runs in the first N overs (6, 10, 15, 20) quoted as a line with Yes/No at a rate; *lambi* = a full-innings total; *khado* = a shorter span or range of the innings; also player runs, partnership and "runs at fall of wicket". Each platform sets its own stakes and settlement rules; typical lines: if the session overs are not completed the bet is void or "deleted" unless the line was already passed. These need a primary source before we encode a rule.

## 6. What this means for the product

Gaps are ranked by how much a wrong or mixed number would mislead a user. File references are where the work belongs.

**A. Scope on every line (highest priority).** A Test player line is either **match total** or **first innings** (or second), and books differ. Add an innings scope to published lines, the archive key and settlement (`src/value_bets/booklines.py`, `archive.py`, `site/packages/engine/live.js` `settleLines`), chart each scope against the matching data (`site/packages/engine/props.js` already has an innings filter; today a Test is aggregated per match), and **never show two scopes as one line**. EDGE_CASES already lists this as a known gap.

**B. Void policy per market kind, not one rule.** Today "named in the XI, never batted" is VOID everywhere and excluded from hit rates. That matches an over/under (void) but not a Yes/No ladder, "to hit a six" or a top-batter market, where books count it as a loss. Tag each line with a `void_policy` (`void` / `loss`) and have the hit-rate and settlement code follow it; keep the exchange rule as the default for over/unders.

**C. Rain-shortened games.** We count curtailed games for player props; books void them under the thresholds in 2.2 unless the line was already passed or the batter was out. Add a "valid matches only" toggle for player props (the summary markets already have the 80% rule), and make `settleLines` mark a priced line **Void** when its match is shortened and the outcome is undetermined.

**D. Definitions to keep matching the books.** Fours and sixes off the bat only (done); super over ignored (done); retired hurt is not a wicket (done); a replaced and a replacing (concussion or impact) player both count as having played (we treat every named player as in the XI, which is the same outcome for bats and bowls); penalty runs and extras count for team and over markets only. To check: overthrow boundaries in the ball-by-ball data.

**E. Line shopping UI and data.** Show every book's line and price per player and stat (not only the main line), mark the best price and the friendliest line, keep prices two-sided where possible and flag Yes-only rungs as one-sided. Cards for this are open.

**F. Filters that mirror how a book prices or settles a prop** (add only where the engine has the data):
* innings scope: 1st / 2nd / both (Test), and "batting first / chasing" for limited overs (a chase is capped by the target);
* valid matches only (full overs / no DLS), starting XI only, minimum balls or overs;
* batting position and opposition, venue and venue type, home/away, tournament and phase, last N (all present or cheap);
* with ball-by-ball detail only: powerplay and over-range splits, pace v spin, first-over and opening-partnership markets. Scraped matches carry no ball-by-ball detail, so these skip them.

**G. Offerings worth adding after A to C**, in order of how often books price them and how well our data settles them: player balls faced, a 50 / 100 ladder as Yes/No, team innings fours and sixes, top batter and bowler per team (dead-heat and minimum-overs rules above), batter v batter matchbets, first-over and powerplay runs, opening partnership.

**H. In-play.** Out of scope for the hourly pipeline: needs a separate fast path (the 15-second live function), a freshness stamp on every in-play price, and pre-match archive files left alone (props are never deleted).

## 7. Still to verify

* bet365's scope per market in a Test (first innings v whole match) from its own pages (direct fetches are blocked; confirm in a browser).
* The Betfair Exchange's cricket market rules and the William Hill and Ladbrokes current rulebooks.
* Primary rules for the Indian fancy exchanges (session void rules, abandoned and shortened matches).
* How each of our feeds' labels map to scope (for example a book's "Innings 1" is the first team innings; a "Player's Total Runs" in a Test is the match unless the label says otherwise).
