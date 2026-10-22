# Edge cases: how the site settles and displays player props

Rule of thumb: **the chart and hit rates only count games where the bet would have been live.** Everything else is shown, labelled, and left out.

| situation | what we show | why / how |
|---|---|---|
| Batted / bowled | the value | normal |
| Named in the XI, **never reached the crease** (or never bowled) | **VOID** (gold) | exchange rule: the bet is void. Needs the named XI per match (`xi` in the player shard) |
| **Not named in the XI** | **DNP** (grey) | the team had a fixture, he was not in it |
| XI list missing / incomplete (a side with < 9 or > 13 names; scraped scorecards with < 10) | **N/A** | `xq = 0` on the match: neither DNP nor VOID can be claimed, so it counts for nothing |
| Impact sub / 12th man named but unused | VOID | named in the list, no row; matches how bookmakers treat "named" players. 12-13 names appear in ~3% of matches |
| Player only appears as non-striker (run out, not out at the end) | value 0 | he reached the crease, so the bet stands |
| Retired hurt before facing a ball | VOID | no batting row |
| Super over | ignored | never counted in any stat |
| Test: batted in one innings only | counted for the match | match-level aggregate; DNB in both innings -> VOID |
| Match abandoned / reduced (DLS) | counted for players who played | summary markets use the 80% / 300-200 over rules instead; filter "valid matches only" removes reduced games |
| Player is on international duty, his franchise plays | DNP for the franchise fixture | not in that XI |
| Player moved clubs | each team's fixtures only from his first to last appearance there | per-team span |
| Player active in Tests but not T20 any more | no run of T20 DNPs | "active" is judged on his last innings **in the same format** (120 days) |
| Player retired / long inactive | later fixtures not blamed on him | same 120-day rule |
| Two matches between the same sides on consecutive days | both kept | a scraped game one day off a Cricsheet game is a duplicate only if the batter-run totals match |
| Same fixture in Cricsheet and scraped | Cricsheet wins | deduped on teams + date (+/-1 day) |
| The Hundred | its own format | never mixed with T20 |
| First-class (MDM) | not included | not a Test |

## Known gaps
* Whether a named 12th man / impact sub counts as "in the XI" differs between books; we treat every named player as in.
* Per-innings Test props (rather than whole-match) are not modelled.
* Rain-curtailed games still count for player props (only summary markets apply the void rules); add a filter if your book voids them.
* Scraped matches carry no ball-by-ball detail, so position / innings order filters skip them.
