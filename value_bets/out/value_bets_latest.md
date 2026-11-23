# Cricket value bets - 2026-11-23 12:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1873 prices
- **smarkets**: ok, 400 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **feedl**: ok, 685 prices, 15 events
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedk**: ok, 174 prices, 5 events
- **feede**: ok, 384 prices, 15 events
- **feedj**: ok, 834 prices, 11 events
- **feedh**: ok, 1289 prices, 29 events
- **feedf**: ok, 334 prices, 16 events

Matches starting in next 168h: **23**, markets priced: **418**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-24 13:45 IST | Australia vs England | M13711 batter_sixes | Tom Banton under 0.5 | 2.16 @ feedj_d | 2.00 | 0.5185 | 8.1% | 1.74% | medium |
| 11-24 13:45 IST | Australia vs England | M13710 batter_fours | Mitchell Marsh under 2.5 | 1.92 @ feedj_d | 1.78 | 0.5902 | 7.7% | 2.00% | medium |
| 11-24 13:45 IST | Australia vs England | M13710 batter_fours | Harry Brook under 2.5 | 1.77 @ feedj_d | 1.67 | 0.6522 | 6.2% | 2.00% | medium |

### Why / notes per bet
- **Australia vs England / M13711 batter_sixes / Tom Banton under 0.5** - why: Model 52% vs market 49% for under 0.5 sixes; form 1.0 sixes/inn recency-weighted T20 (n_eff 74.1; last 5: 1, 4, 0, 1, 1), bats in 92% of games played; venue unknown/unmatched (venue terms neutral); vs Australia: 4 inns avg 0.2. Notes: 2 market source(s) for fair price; model 0.519 vs market 0.485; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / M13710 batter_fours / Mitchell Marsh under 2.5** - why: Model 59% vs market 54% for under 2.5 fours; form 3.3 fours/inn recency-weighted T20 (n_eff 61.2; last 5: 3, 1, 5, 5, 5), bats in 96% of games played; venue unknown/unmatched (venue terms neutral); vs England: 7 inns avg 1.9; context adj: team H2H context -3%. Notes: 2 market source(s) for fair price; model 0.590 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / M13710 batter_fours / Harry Brook under 2.5** - why: Model 65% vs market 56% for under 2.5 fours; form 2.6 fours/inn recency-weighted T20 (n_eff 51.7; last 5: 4, 3, 1, 10, 7), bats in 92% of games played; venue unknown/unmatched (venue terms neutral); vs Australia: 4 inns avg 2.0; context adj: team H2H context -1%. Notes: 2 market source(s) for fair price; model 0.652 vs market 0.558; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 48.7%, model 0.0782, market 0.1105

Unmatched team names (add to mappings/teams.csv): South Australia Redbacks (male)

Runtime 124.2s. Snapshot: `odds_20261123T063032Z.jsonl.gz`
