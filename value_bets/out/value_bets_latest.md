# Cricket value bets - 2026-11-27 16:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1266 prices
- **smarkets**: ok, 333 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **feedl**: ok, 299 prices, 13 events
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedk**: ok, 96 prices, 4 events
- **feedf**: ok, 148 prices, 3 events
- **feede**: ok, 122 prices, 8 events
- **feedj**: ok, 529 prices, 8 events
- **feedh**: ok, 789 prices, 35 events

Matches starting in next 168h: **28**, markets priced: **300**, value bets: **1** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-28 13:40 IST | Sydney Thunder (W) vs Sydney Sixers (W) | Batsman Match Runs | P Litchfield under 25.5 | 1.83 @ moviodds_bet365 | 1.75 | 0.6185 | 5.1% | 1.53% | medium |

### Why / notes per bet
- **Sydney Thunder (W) vs Sydney Sixers (W) / Batsman Match Runs / P Litchfield under 25.5** - why: Model 62% vs market 54% for under 25.5 runs; form 26.2 runs/inn recency-weighted T20 (n_eff 71.7; last 5: 121, 26, 28, 1, 13), bats in 96% of games played; at Drummoyne Oval, Sydney: 15 inns avg 24.1; context adj: team H2H context -1%; weather: rain chance up to 94%, high humidity 89%, cloud cover 99%. Notes: 2 market source(s) for fair price; model 0.618 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 94% rain chance, 0.8 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-28 10:10 IST Melbourne Renegades (W) vs Melbourne Stars (W) / Team - Top Batter / C Webb @ 13.00 (moviodds_bet365): edge 45.5%, model 0.0991, market 0.1188
- 11-28 10:10 IST Melbourne Renegades vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 64.7%, model 0.0809, market 0.1254
- 11-28 13:40 IST Sydney Thunder (W) vs Sydney Sixers (W) / Batsman Total Match Sixes / AK Gardner under 0.5 @ 2.50 (moviodds_bet365): edge 30.9%, model 0.6029, market 0.459

Unmatched team names (add to mappings/teams.csv): Central Hinds (W) (female), Central Hinds (female), Central Hinds (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Lokseva Academy (male), Majees Titan (male), Muscat Shaheens (W) (female), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), South Zone (W) (female), South Zone (male), Speedworld Security Solutions (male), Wadi Kabir Royals (W) (female), West Zone (W) (female), West Zone (male)

Runtime 116.0s. Snapshot: `odds_20261127T103032Z.jsonl.gz`
