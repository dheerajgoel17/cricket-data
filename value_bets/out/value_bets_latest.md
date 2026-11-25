# Cricket value bets - 2026-11-25 16:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2245 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 458 prices
- **feedk**: ok, 252 prices, 6 events
- **feedl**: ok, 627 prices, 34 events
- **feedj**: ok, 622 prices, 13 events
- **feedh**: ok, 1990 prices, 77 events
- **feede**: ok, 544 prices, 33 events
- **feedf**: ok, 584 prices, 20 events
- **feedi**: ok, 2179 prices, 33 events

Matches starting in next 168h: **51**, markets priced: **618**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-25 20:00 IST | Dubai Capitals vs Desert Vipers | G9182 batter_fours | Faf du Plessis under 2.5 | 2.00 @ feedi_d | 1.86 | 0.574 | 7.2% | 1.81% | medium |
| 11-26 10:10 IST | Sydney Thunder vs Adelaide Strikers | M13710 batter_fours | Laura Wolvaardt under 3.5 | 1.92 @ feedj_d | 1.81 | 0.5987 | 6.1% | 1.65% | medium |
| 11-27 13:45 IST | Australia vs England | Aneurin Donald To Score 50 | Aneurin Donald 50+ yes | 5.00 @ feede_lb | 4.67 | 0.2191 | 7.0% | 0.44% | medium |

### Why / notes per bet
- **Dubai Capitals vs Desert Vipers / G9182 batter_fours / Faf du Plessis under 2.5** - why: Model 57% vs market 51% for under 2.5 fours; form 3.1 fours/inn recency-weighted T20 (n_eff 68.9; last 5: 0, 3, 9, 3, 7), bats in 96% of games played; at Dubai International Cricket Stadium, Dubai: 12 inns avg 3.2; context adj: team H2H context +5%. Notes: 3 market source(s) for fair price; model 0.574 vs market 0.505; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Thunder vs Adelaide Strikers / M13710 batter_fours / Laura Wolvaardt under 3.5** - why: Model 60% vs market 51% for under 3.5 fours; form 3.7 fours/inn recency-weighted T20 (n_eff 88.8; last 5: 4, 11, 4, 7, 2), bats in 98% of games played; at North Sydney Oval: 12 inns avg 2.7; context adj: venue environment +14%, at this venue -5%. Notes: 2 market source(s) for fair price; model 0.599 vs market 0.515; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / Aneurin Donald To Score 50 / Aneurin Donald 50+ yes** - why: Model 22% vs market 21% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 34.2; last 5: 85, 10, 13, 21, 12), bats in 98% of games played; vs Australia: 2 inns avg 47.5; weather: high humidity 90%. Notes: 6 market source(s) for fair price; model 0.219 vs market 0.210; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 10:10 IST Sydney Thunder (W) vs Adelaide Strikers (W) / Batsman Total Match Sixes / ME Bouchier over 0.5 @ 6.00 (moviodds_bet365): edge 68.6%, model 0.3201, market 0.249

Unmatched team names (add to mappings/teams.csv): Boland Rocks (male), Central (male), Central Zone (W) (female), Central Zone (Women) (female), Central Zone (male), East Zone (W) (female), East Zone (Women) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), Ghubra Giants (W) (female), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Majees Titan (male), Multan Region (male), Muscat Shaheens (W) (female), Muscat Thunders (W) (female), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (Women) (female), North East Zone (male), North Zone (W) (female), North Zone (Women) (female), North Zone (male), Oca Invincibles (W) (female), Peshawar Blues (male), Sialkot Blues (male), South Zone (W) (female), South Zone (Women) (female), South Zone (male), Sunny 11 Pratishtan (male), Tasmanian Tigers (male), West Zone (W) (female), West Zone (Women) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 238.4s. Snapshot: `odds_20261125T103037Z.jsonl.gz`
