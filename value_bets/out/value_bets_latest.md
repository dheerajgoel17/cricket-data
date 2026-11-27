# Cricket value bets - 2026-11-27 14:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1560 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 347 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedl**: ok, 266 prices, 16 events
- **feedk**: ok, 130 prices, 5 events
- **feede**: ok, 192 prices, 10 events
- **feedf**: ok, 258 prices, 5 events
- **feedj**: ok, 642 prices, 11 events
- **feedh**: ok, 953 prices, 39 events

Matches starting in next 168h: **32**, markets priced: **387**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-27 15:40 IST | Perth Scorchers (W) vs Hobart Hurricanes (W) | Batter Total Match Fours | BL Mooney under 3.5 | 2.10 @ moviodds_bet365 | 1.91 | 0.6007 | 9.8% | 2.00% | medium |
| 11-28 13:40 IST | Sydney Thunder (W) vs Sydney Sixers (W) | Batsman Match Runs | P Litchfield under 25.5 | 1.83 @ moviodds_bet365 | 1.75 | 0.6185 | 5.1% | 1.53% | medium |

### Why / notes per bet
- **Perth Scorchers (W) vs Hobart Hurricanes (W) / Batter Total Match Fours / BL Mooney under 3.5** - why: Model 60% vs market 46% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 81.6; last 5: 3, 0, 1, 4, 8), bats in 97% of games played; venue unknown/unmatched (venue terms neutral); context adj: team H2H context +1%. Notes: 2 market source(s) for fair price; model 0.601 vs market 0.459; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Sydney Thunder (W) vs Sydney Sixers (W) / Batsman Match Runs / P Litchfield under 25.5** - why: Model 62% vs market 54% for under 25.5 runs; form 26.2 runs/inn recency-weighted T20 (n_eff 71.7; last 5: 121, 26, 28, 1, 13), bats in 96% of games played; at Drummoyne Oval, Sydney: 15 inns avg 24.1; context adj: team H2H context -1%; weather: rain chance up to 94%, high humidity 89%, cloud cover 99%. Notes: 2 market source(s) for fair price; model 0.618 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 94% rain chance, 0.8 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-28 10:10 IST Melbourne Renegades (W) vs Melbourne Stars (W) / Team - Top Batter / C Webb @ 13.00 (moviodds_bet365): edge 39.6%, model 0.0862, market 0.1188
- 11-28 10:10 IST Melbourne Renegades vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 64.7%, model 0.0809, market 0.1254

Unmatched team names (add to mappings/teams.csv): Central Hinds (W) (female), Central Hinds (female), Central Hinds (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Lokseva Academy (male), Majees Titan (male), Muscat Shaheens (W) (female), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), Roma Gladiatori (male), South Zone (W) (female), South Zone (male), Speedworld Security Solutions (male), Wadi Kabir Royals (W) (female), West Zone (W) (female), West Zone (male)

Runtime 126.6s. Snapshot: `odds_20261127T083039Z.jsonl.gz`
