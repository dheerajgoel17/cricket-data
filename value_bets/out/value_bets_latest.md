# Cricket value bets - 2026-11-26 01:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1889 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 364 prices
- **feedj**: skipped - Feed J listing HTTP 503
- **feedk**: ok, 252 prices, 6 events
- **feedl**: ok, 522 prices, 40 events
- **feedh**: ok, 2071 prices, 102 events
- **feede**: ok, 690 prices, 40 events
- **feedf**: ok, 650 prices, 20 events
- **feedi**: ok, 1614 prices, 33 events, stopped time budget

Matches starting in next 168h: **61**, markets priced: **578**, value bets: **4** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-26 13:40 IST | Sydney Sixers (Women) vs Melbourne Stars (Women) | G2506 batter_runs | Ellyse Perry under 29.5 | 1.85 @ feedi_d | 1.75 | 0.6366 | 5.7% | 1.68% | medium |
| 11-26 20:00 IST | Abu Dhabi Knight Riders vs MI Emirates | G9182 batter_fours | Andre Russell under 1.5 | 1.91 @ feedi_d | 1.52 | 0.6985 | 25.6% | 2.00% | medium |
| 11-26 20:00 IST | Abu Dhabi Knight Riders vs MI Emirates | G9182 batter_fours | Nicholas Pooran under 1.5 | 2.10 @ feedi_d | 1.96 | 0.5246 | 7.3% | 1.66% | medium |
| 11-26 20:00 IST | Abu Dhabi Knight Riders vs MI Emirates | Batter Total Match Fours | ADS Fletcher under 1.5 | 2.20 @ moviodds_bet365 | 2.07 | 0.5318 | 6.2% | 1.29% | medium |

### Why / notes per bet
- **Sydney Sixers (Women) vs Melbourne Stars (Women) / G2506 batter_runs / Ellyse Perry under 29.5** - why: Model 64% vs market 52% for under 29.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.2; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 84%, cloud cover 75%. Notes: 3 market source(s) for fair price; model 0.637 vs market 0.518; assumes bet void if player doesn't bat/bowl - check book rules
- **Abu Dhabi Knight Riders vs MI Emirates / G9182 batter_fours / Andre Russell under 1.5** - why: Model 70% vs market 62% for under 1.5 fours; form 1.1 fours/inn recency-weighted T20 (n_eff 87.3; last 5: 1, 0, 2, 2, 3), bats in 89% of games played; vs MI Emirates: 8 inns avg 1.5; context adj: venue environment -4%, team H2H context -7%. Notes: 2 market source(s) for fair price; model 0.698 vs market 0.625; assumes bet void if player doesn't bat/bowl - check book rules
- **Abu Dhabi Knight Riders vs MI Emirates / G9182 batter_fours / Nicholas Pooran under 1.5** - why: Model 52% vs market 50% for under 1.5 fours; form 1.9 fours/inn recency-weighted T20 (n_eff 120.5; last 5: 1, 3, 0, 2, 2), bats in 97% of games played; vs Abu Dhabi Knight Riders: 8 inns avg 1.6; context adj: venue environment -4%, team H2H context +8%. Notes: 2 market source(s) for fair price; model 0.525 vs market 0.500; assumes bet void if player doesn't bat/bowl - check book rules
- **Abu Dhabi Knight Riders vs MI Emirates / Batter Total Match Fours / ADS Fletcher under 1.5** - why: Model 53% vs market 44% for under 1.5 fours; form 2.4 fours/inn recency-weighted T20 (n_eff 56.4; last 5: 1, 1, 6, 0, 4), bats in 97% of games played; context adj: venue environment -4%, team H2H context -7%. Notes: 2 market source(s) for fair price; model 0.532 vs market 0.443; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers (W) vs Melbourne Stars (W) / Batsman Total Match Sixes / AK Gardner under 0.5 @ 2.62 (moviodds_bet365): edge 36.1%, model 0.5409, market 0.5

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (Women) (female), Central Zone (male), East Zone (W) (female), East Zone (Women) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Lokseva Academy (male), Majees Titan (male), Multan Region (male), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (Women) (female), North East Zone (male), North Zone (W) (female), North Zone (Women) (female), North Zone (male), Peshawar Blues (male), Sialkot Blues (male), South Zone (W) (female), South Zone (Women) (female), South Zone (male), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), Tasmanian Tigers (male), West Zone (W) (female), West Zone (Women) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 266.4s. Snapshot: `odds_20261125T193035Z.jsonl.gz`
