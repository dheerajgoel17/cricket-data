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
| Two matches between the same sides on consecutive days | both kept | a scraped game one day off a Base game is a duplicate only if the batter-run totals match |
| Same fixture in Base and scraped | Base wins | deduped on teams + date (+/-1 day) |
| The Hundred / T10 / 60-over | their own formats | never mixed with T20 or ODI |
| A T20 in a Test series (e.g. Afghanistan vs Zimbabwe) | format on the line vs the fixture | a Test's 6-day book window must not take the T20's fancy |
| Playing name vs registry surname (Chamari Athapaththu / AC Jayangani) | the same player | `player_aliases.csv` plus `SURNAME_ALIAS`; live matching uses ids first |
| Afghanistan men's matches (Base withholds them) | kept as scraped, used in Match Fancy when they qualify | `q === 1` (innings from balls, or from the scorecard totals). Totals-only rows stay out so missing fours are not shown as 0 |
| A women's T20 of the same country name | its own team index | men and women are never mixed; Match Fancy also passes `gender` |
| Test at close of play (stumps / lunch / tea) | still live, with scores and the session line | the source's status 2 without a result is a day break, not the end; `/api/live` keeps it for 6 days |
| First-class (MDM) | not included | not a Test |

## Known gaps
How the books settle each of these (and what to change) is in `docs/BETTING_RULES.md`, section 6.

* Whether a named 12th man / impact sub counts as "in the XI" differs between books; we treat every named player as in.
* Per-innings Test props (rather than whole-match) are not modelled.
* Rain-curtailed games still count for player props (only summary markets apply the void rules); add a filter if your book voids them.
* Scraped matches carry no ball-by-ball detail, so position / innings order filters skip them.
