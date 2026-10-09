# Data dictionary

Files: `data/matches/YYYY-MM.csv.gz`, `data/players/YYYY-MM.csv.gz` (UTF-8 CSV, gzip). Months are by match start date.

## matches
| Column | Meaning |
|---|---|
| match_id | Cricsheet match id (or `prov-...` for provisional) |
| date | First day of the match (YYYY-MM-DD) |
| match_type | Cricsheet type: `T20` (includes T20Is), `ODI`, `ODM`, `Test`, `MDM`, `IT20`... |
| team_type | `international` or `club` |
| gender | `male` / `female` |
| event, venue | Competition and ground |
| team_a, team_b | Teams in Cricsheet order |
| toss_winner, toss_decision | `bat` / `field` |
| winner, result, result_margin | e.g. `win`, `12 runs`; `tie` / `no result` leave winner empty |
| player_of_match | `;`-separated |
| status | `canonical` (Cricsheet) or `provisional` |
| source | `cricsheet` or the provisional source name |

## players (one row per player named in the match, even with no involvement)
| Column | Meaning |
|---|---|
| match_id, date, player, player_id, team, opponent | `player_id` is Cricsheet's registry id |
| runs, balls, fours, sixes | Batting. `balls` excludes wides |
| wickets | Bowler credited wickets (not run outs / retired) |
| balls_bowled, runs_conceded | Legal balls; runs exclude byes and leg byes |
| catches | Includes caught-and-bowled |
| stumpings, run_outs | Fielding credits |
| points | `runs + 20*wickets + 10*catches + 25*stumpings` (a common "player performance" scoring) |
