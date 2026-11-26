# Cricket value bets - 2026-11-26 06:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2173 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 364 prices
- **feedk**: ok, 252 prices, 6 events
- **feedl**: ok, 548 prices, 40 events
- **feedh**: ok, 2071 prices, 104 events
- **feedj**: ok, 753 prices, 18 events
- **feede**: ok, 690 prices, 40 events
- **feedf**: ok, 650 prices, 21 events
- **feedi**: ok, 1489 prices, 30 events, stopped time budget

Matches starting in next 168h: **61**, markets priced: **640**, value bets: **4** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-26 20:00 IST | Abu Dhabi Knight Riders vs MI Emirates | Batsman Total Match Sixes | MM Ali under 0.5 | 2.62 @ moviodds_bet365 | 2.06 | 0.4677 | 27.4% | 2.00% | medium |
| 11-26 20:00 IST | Abu Dhabi Knight Riders vs MI Emirates | Batter Total Match Fours | ADS Fletcher under 1.5 | 2.20 @ moviodds_bet365 | 2.07 | 0.5321 | 6.2% | 1.30% | medium |
| 11-27 13:45 IST | Australia vs England | Batsman Total Match Sixes | J Fraser-McGurk under 0.5 | 2.62 @ moviodds_bet365 | 2.40 | 0.4933 | 9.5% | 1.46% | low |
| 11-27 20:00 IST | Sharjah Warriorz vs Dubai Capitals | Batsman Total Match Sixes | PI Walter under 0.5 | 2.62 @ moviodds_bet365 | 2.41 | 0.4877 | 8.8% | 1.36% | medium |

### Why / notes per bet
- **Abu Dhabi Knight Riders vs MI Emirates / Batsman Total Match Sixes / MM Ali under 0.5** - why: Model 47% vs market 50% for under 0.5 sixes; form 1.1 sixes/inn recency-weighted T20 (n_eff 95.2; last 5: 0, 0, 1, 3, 3), bats in 87% of games played; vs MI Emirates: 4 inns avg 1.2; context adj: venue environment +24%. Notes: 3 market source(s) for fair price; model 0.468 vs market 0.500; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Abu Dhabi Knight Riders vs MI Emirates / Batter Total Match Fours / ADS Fletcher under 1.5** - why: Model 53% vs market 44% for under 1.5 fours; form 2.4 fours/inn recency-weighted T20 (n_eff 57.3; last 5: 3, 1, 1, 6, 0), bats in 97% of games played; context adj: venue environment -4%, team H2H context -7%. Notes: 2 market source(s) for fair price; model 0.532 vs market 0.443; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Australia vs England / Batsman Total Match Sixes / J Fraser-McGurk under 0.5** - why: Model 49% vs market 35% for under 0.5 sixes; form 1.3 sixes/inn recency-weighted T20 (n_eff 34.4; last 5: 3, 0, 0, 5, 1), bats in 96% of games played; vs England: 3 inns avg 1.7; context adj: venue environment -3%; weather: rain chance up to 49%, high humidity 90%, cloud cover 88%. Notes: 1 market source(s) for fair price; model 0.493 vs market 0.355; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Sharjah Warriorz vs Dubai Capitals / Batsman Total Match Sixes / PI Walter under 0.5** - why: Model 49% vs market 35% for under 0.5 sixes; form 1.1 sixes/inn recency-weighted T20 (n_eff 49.1; last 5: 2, 4, 1, 8, 3), bats in 94% of games played; at Sharjah Cricket Stadium, Sharjah: 4 inns avg 1.5; context adj: venue environment +11%. Notes: 2 market source(s) for fair price; model 0.488 vs market 0.355; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 90.1%, model None, market 0.1268
- 11-26 13:40 IST Sydney Sixers (Women) vs Melbourne Stars (Women) / G2808 / Meg Lanning @ 7.00 (feedi_d): edge 51.6%, model None, market 0.2165
- 11-27 20:00 IST Sharjah Warriorz vs Dubai Capitals / Batter Milestones / SW Billings 50+ yes @ 9.00 (moviodds_bet365): edge 32.0%, model 0.1256, market 0.1639
- 11-27 20:00 IST Sharjah Warriorz vs Dubai Capitals / G2808 / James Rew @ 15.00 (feedi_d): edge 32.8%, model 0.093, market 0.0862

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (Women) (female), Central Zone (male), East Zone (W) (female), East Zone (Women) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), IAS Invincibles (male), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Lokseva Academy (male), Majees Titan (male), Multan Region (male), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (Women) (female), North East Zone (male), North Zone (W) (female), North Zone (Women) (female), North Zone (male), Peshawar Blues (male), Sialkot Blues (male), South Zone (W) (female), South Zone (Women) (female), South Zone (male), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), Tasmanian Tigers (male), West Zone (W) (female), West Zone (Women) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 299.3s. Snapshot: `odds_20261126T003038Z.jsonl.gz`
