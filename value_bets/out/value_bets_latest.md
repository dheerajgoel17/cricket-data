# Cricket value bets - 2026-11-24 00:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1568 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 449 prices
- **feedl**: ok, 572 prices, 28 events
- **feedk**: ok, 230 prices, 6 events
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedf**: ok, 448 prices, 15 events
- **feede**: ok, 718 prices, 34 events
- **feedh**: ok, 1722 prices, 60 events
- **feedj**: ok, 758 prices, 17 events

Matches starting in next 168h: **49**, markets priced: **480**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-24 11:00 IST | Maharashtra vs Tripura | Ruturaj Gaikwad To Score 50 | Ruturaj Gaikwad 50+ no | 1.40 @ feede_lb | 1.32 | 0.8366 | 6.4% | 2.00% | medium |
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |

### Why / notes per bet
- **Maharashtra vs Tripura / Ruturaj Gaikwad To Score 50 / Ruturaj Gaikwad 50+ no** - why: Model 84% vs market 70% for 50+ runs; form 31.2 runs/inn recency-weighted T20 (n_eff 29.1; last 5: 16, 15, 13, 42, 6), bats in 95% of games played; at Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur, New Chandigarh: 1 inns avg 1.0; vs Tripura: 1 inns avg 13.0; context adj: team H2H context -3%. Notes: 3 market source(s) for fair price; model 0.837 vs market 0.697; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.4; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 48.0%, model 0.0768, market 0.1105

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), East Zone (W) (female), Lokseva Academy (male), North East Zone (W) (female), North Zone (W) (female), Omr Checker (male), South Australia Redbacks (male), South Zone (W) (female), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), West Zone (W) (female)

Runtime 262.7s. Snapshot: `odds_20261123T183033Z.jsonl.gz`
