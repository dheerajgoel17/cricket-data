# Cricket value bets - 2026-11-27 18:28 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1566 prices
- **smarkets**: ok, 289 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedl**: ok, 306 prices, 12 events
- **feedk**: ok, 138 prices, 5 events
- **feede**: ok, 122 prices, 7 events
- **feedf**: ok, 242 prices, 4 events
- **feedj**: ok, 423 prices, 6 events
- **feedh**: ok, 793 prices, 38 events

Matches starting in next 168h: **29**, markets priced: **351**, value bets: **1** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-28 13:40 IST | Sydney Thunder (W) vs Sydney Sixers (W) | Batsman Match Runs | P Litchfield under 25.5 | 1.83 @ moviodds_bet365 | 1.75 | 0.6185 | 5.1% | 1.53% | medium |

### Why / notes per bet
- **Sydney Thunder (W) vs Sydney Sixers (W) / Batsman Match Runs / P Litchfield under 25.5** - why: Model 62% vs market 54% for under 25.5 runs; form 26.2 runs/inn recency-weighted T20 (n_eff 71.7; last 5: 121, 26, 28, 1, 13), bats in 96% of games played; at Drummoyne Oval, Sydney: 15 inns avg 24.1; context adj: team H2H context -1%; weather: rain chance up to 90%, high humidity 90%, cloud cover 100%. Notes: 2 market source(s) for fair price; model 0.618 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 90% rain chance, 0.7 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-28 10:10 IST Melbourne Renegades (W) vs Melbourne Stars (W) / Team - Top Batter / C Webb @ 13.00 (moviodds_bet365): edge 45.5%, model 0.0991, market 0.1188
- 11-28 10:10 IST Melbourne Renegades vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 56.3%, model 0.0771, market 0.1188

Unmatched team names (add to mappings/teams.csv): Central Hinds (W) (female), Central Hinds (female), Central Hinds (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Majees Titan (male), Muscat Shaheens (W) (female), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), South Zone (W) (female), South Zone (male), Wadi Kabir Royals (W) (female), West Zone (W) (female), West Zone (male)

Runtime 115.2s. Snapshot: `odds_20261127T125831Z.jsonl.gz`
