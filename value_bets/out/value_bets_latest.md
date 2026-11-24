# Cricket value bets - 2026-11-24 16:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2125 prices
- **smarkets**: ok, 359 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **feedl**: ok, 582 prices, 14 events
- **feedk**: ok, 192 prices, 5 events
- **feedf**: ok, 290 prices, 7 events
- **feede**: ok, 316 prices, 18 events
- **feedj**: ok, 236 prices, 4 events
- **feedh**: ok, 1269 prices, 31 events
- **feedi**: ok, 1804 prices, 25 events

Matches starting in next 168h: **34**, markets priced: **433**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-24 20:00 IST | Gulf Giants vs MI Emirates | G9182 batter_fours | Nicholas Pooran under 1.5 | 2.10 @ feedi_d | 2.00 | 0.5473 | 5.2% | 1.19% | medium |
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |
| 11-26 13:40 IST | Sydney Sixers (Women) vs Melbourne Stars (Women) | G2506 batter_runs | Ellyse Perry under 29.5 | 1.85 @ feedi_d | 1.75 | 0.6365 | 5.7% | 1.68% | medium |

### Why / notes per bet
- **Gulf Giants vs MI Emirates / G9182 batter_fours / Nicholas Pooran under 1.5** - why: Model 55% vs market 46% for under 1.5 fours; form 1.9 fours/inn recency-weighted T20 (n_eff 119.6; last 5: 3, 0, 2, 2, 3), bats in 97% of games played; at Dubai International Cricket Stadium, Dubai: 26 inns avg 1.8; vs Gulf Giants: 8 inns avg 2.9; context adj: at this venue -1%, team H2H context -4%. Notes: 2 market source(s) for fair price; model 0.547 vs market 0.463; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 82%, cloud cover 95%. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers (Women) vs Melbourne Stars (Women) / G2506 batter_runs / Ellyse Perry under 29.5** - why: Model 64% vs market 52% for under 29.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 82%, cloud cover 95%. Notes: 3 market source(s) for fair price; model 0.637 vs market 0.518; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 47.8%, model 0.0764, market 0.1105
- 11-25 20:00 IST Dubai Capitals vs Desert Vipers / G2808 / Babar Azam @ 8.50 (feedi_d): edge 32.4%, model None, market 0.1558

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (Women) (female), Central Zone (male), East Zone (W) (female), East Zone (Women) (female), East Zone (male), Lokseva Academy (male), North East Zone (W) (female), North East Zone (Women) (female), North East Zone (male), North Zone (W) (female), North Zone (Women) (female), North Zone (male), South Zone (W) (female), South Zone (Women) (female), South Zone (male), Sunny 11 Pratishtan (male), Tasmanian Tigers (male), West Zone (W) (female), West Zone (Women) (female), West Zone (male)

Runtime 174.4s. Snapshot: `odds_20261124T103037Z.jsonl.gz`
