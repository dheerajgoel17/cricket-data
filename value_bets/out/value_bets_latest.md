# Cricket value bets - 2026-11-23 16:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1817 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 307 prices
- **feedl**: ok, 584 prices, 14 events
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=firefox155)
- **feedk**: ok, 140 prices, 4 events
- **feedj**: ok, 551 prices, 7 events
- **feede**: ok, 404 prices, 18 events
- **feedh**: ok, 1116 prices, 31 events
- **feedf**: ok, 350 prices, 13 events

Matches starting in next 168h: **25**, markets priced: **374**, value bets: **1** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |

### Why / notes per bet
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.4; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 48.5%, model 0.0778, market 0.1105

Unmatched team names (add to mappings/teams.csv): South Australia Redbacks (male)

Runtime 146.0s. Snapshot: `odds_20261123T103031Z.jsonl.gz`
