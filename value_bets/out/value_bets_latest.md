# Cricket value bets - 2026-11-24 11:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2092 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 434 prices
- **feedl**: ok, 654 prices, 26 events
- **feedk**: ok, 262 prices, 7 events
- **feede**: ok, 520 prices, 26 events
- **feedj**: ok, 627 prices, 13 events
- **feedh**: ok, 1568 prices, 49 events
- **feedf**: ok, 476 prices, 15 events
- **feedi**: ok, 2112 prices, 36 events

Matches starting in next 168h: **39**, markets priced: **536**, value bets: **5** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-24 13:45 IST | Australia vs England | G9181 batter_sixes | Tom Banton under 0.5 | 2.30 @ feedi_d | 2.01 | 0.5186 | 14.5% | 2.00% | medium |
| 11-24 13:45 IST | Australia vs England | G9182 batter_fours | Mitchell Marsh under 2.5 | 2.00 @ feedi_d | 1.85 | 0.5903 | 8.1% | 2.00% | medium |
| 11-24 13:45 IST | Australia vs England | G9182 batter_fours | Harry Brook under 2.5 | 1.80 @ feedi_d | 1.70 | 0.6523 | 6.0% | 1.86% | medium |
| 11-24 20:00 IST | Gulf Giants vs MI Emirates | G9181 batter_sixes | Kusal Perera under 0.5 | 2.20 @ feedi_d | 1.99 | 0.576 | 10.5% | 2.00% | medium |
| 11-26 13:40 IST | Sydney Sixers (Women) vs Melbourne Stars (Women) | G2506 batter_runs | Ellyse Perry under 29.5 | 1.85 @ feedi_d | 1.75 | 0.6365 | 5.7% | 1.68% | medium |

### Why / notes per bet
- **Australia vs England / G9181 batter_sixes / Tom Banton under 0.5** - why: Model 52% vs market 48% for under 0.5 sixes; form 1.0 sixes/inn recency-weighted T20 (n_eff 74.0; last 5: 1, 4, 0, 1, 1), bats in 92% of games played; venue unknown/unmatched (venue terms neutral); vs Australia: 4 inns avg 0.2. Notes: 2 market source(s) for fair price; model 0.519 vs market 0.481; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / G9182 batter_fours / Mitchell Marsh under 2.5** - why: Model 59% vs market 50% for under 2.5 fours; form 3.3 fours/inn recency-weighted T20 (n_eff 61.1; last 5: 3, 1, 5, 5, 5), bats in 96% of games played; venue unknown/unmatched (venue terms neutral); vs England: 7 inns avg 1.9; context adj: team H2H context -3%. Notes: 2 market source(s) for fair price; model 0.590 vs market 0.500; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / G9182 batter_fours / Harry Brook under 2.5** - why: Model 65% vs market 54% for under 2.5 fours; form 2.6 fours/inn recency-weighted T20 (n_eff 51.6; last 5: 4, 3, 1, 10, 7), bats in 92% of games played; venue unknown/unmatched (venue terms neutral); vs Australia: 4 inns avg 2.0; context adj: team H2H context -1%. Notes: 2 market source(s) for fair price; model 0.652 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Gulf Giants vs MI Emirates / G9181 batter_sixes / Kusal Perera under 0.5** - why: Model 58% vs market 44% for under 0.5 sixes; form 0.7 sixes/inn recency-weighted T20 (n_eff 51.2; last 5: 2, 0, 0, 1, 0), bats in 92% of games played; at Dubai International Cricket Stadium, Dubai: 12 inns avg 0.4; vs Gulf Giants: 4 inns avg 0.0; context adj: venue environment -3%. Notes: 2 market source(s) for fair price; model 0.576 vs market 0.442; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers (Women) vs Melbourne Stars (Women) / G2506 batter_runs / Ellyse Perry under 29.5** - why: Model 64% vs market 52% for under 29.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0. Notes: 3 market source(s) for fair price; model 0.637 vs market 0.518; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-25 20:00 IST Dubai Capitals vs Desert Vipers / G1007 / Shadab Khan @ 13.00 (feedi_d): edge 35.6%, model None, market 0.1043

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), East Zone (W) (female), Lokseva Academy (male), North East Zone (W) (female), North Zone (W) (female), Omr Checker (male), Pondicherry (male), South Zone (W) (female), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), West Zone (W) (female)

Runtime 351.2s. Snapshot: `odds_20261124T053040Z.jsonl.gz`
