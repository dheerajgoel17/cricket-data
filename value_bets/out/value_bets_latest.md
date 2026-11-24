# Cricket value bets - 2026-11-24 14:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1820 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 387 prices
- **feedl**: ok, 574 prices, 18 events
- **feedk**: ok, 192 prices, 5 events
- **feede**: ok, 396 prices, 19 events
- **feedf**: ok, 370 prices, 10 events
- **feedj**: ok, 705 prices, 13 events
- **feedh**: ok, 1289 prices, 35 events
- **feedi**: ok, 1965 prices, 25 events

Matches starting in next 168h: **29**, markets priced: **445**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-24 20:00 IST | Gulf Giants vs MI Emirates | G9181 batter_sixes | Kusal Perera under 0.5 | 2.20 @ feedi_d | 1.99 | 0.576 | 10.5% | 2.00% | medium |
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |
| 11-26 13:40 IST | Sydney Sixers (Women) vs Melbourne Stars (Women) | G2506 batter_runs | Ellyse Perry under 29.5 | 1.85 @ feedi_d | 1.75 | 0.6365 | 5.7% | 1.68% | medium |

### Why / notes per bet
- **Gulf Giants vs MI Emirates / G9181 batter_sixes / Kusal Perera under 0.5** - why: Model 58% vs market 44% for under 0.5 sixes; form 0.7 sixes/inn recency-weighted T20 (n_eff 51.2; last 5: 2, 0, 0, 1, 0), bats in 92% of games played; at Dubai International Cricket Stadium, Dubai: 12 inns avg 0.4; vs Gulf Giants: 4 inns avg 0.0; context adj: venue environment -3%. Notes: 2 market source(s) for fair price; model 0.576 vs market 0.442; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 82%, cloud cover 95%. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers (Women) vs Melbourne Stars (Women) / G2506 batter_runs / Ellyse Perry under 29.5** - why: Model 64% vs market 52% for under 29.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 82%, cloud cover 95%. Notes: 3 market source(s) for fair price; model 0.637 vs market 0.518; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 47.8%, model 0.0764, market 0.1105
- 11-25 20:00 IST Dubai Capitals vs Desert Vipers / G2808 / Babar Azam @ 8.50 (feedi_d): edge 32.4%, model None, market 0.1558

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Lokseva Academy (male), North Zone (W) (female), Pondicherry (male), Sunny 11 Pratishtan (male)

Runtime 292.9s. Snapshot: `odds_20261124T083038Z.jsonl.gz`
