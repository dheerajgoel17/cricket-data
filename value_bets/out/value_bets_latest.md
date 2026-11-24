# Cricket value bets - 2026-11-24 17:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2137 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 360 prices
- **feedl**: ok, 602 prices, 17 events
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=firefox155)
- **feedk**: ok, 192 prices, 5 events
- **feedf**: ok, 262 prices, 5 events
- **feede**: ok, 352 prices, 15 events
- **feedj**: ok, 633 prices, 9 events
- **feedh**: ok, 1373 prices, 33 events

Matches starting in next 168h: **28**, markets priced: **417**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | Ellyse Perry - Over/Under 29.5 Runs | Ellyse Perry under 29.5 | 1.83 @ feede_lb | 1.72 | 0.6365 | 6.4% | 1.92% | medium |

### Why / notes per bet
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 82%, cloud cover 95%. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers vs Melbourne Stars / Ellyse Perry - Over/Under 29.5 Runs / Ellyse Perry under 29.5** - why: Model 64% vs market 54% for under 29.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 82%, cloud cover 95%. Notes: 2 market source(s) for fair price; model 0.637 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 47.8%, model 0.0764, market 0.1105

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), South Zone (W) (female), South Zone (male), West Zone (W) (female), West Zone (male)

Runtime 246.9s. Snapshot: `odds_20261124T113040Z.jsonl.gz`
