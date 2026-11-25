# Cricket value bets - 2026-11-25 21:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1869 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 354 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedk**: ok, 252 prices, 6 events
- **feedl**: ok, 515 prices, 40 events
- **feede**: ok, 654 prices, 38 events
- **feedj**: ok, 640 prices, 15 events
- **feedh**: ok, 1921 prices, 95 events
- **feedf**: ok, 642 prices, 20 events

Matches starting in next 168h: **53**, markets priced: **546**, value bets: **4** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-26 10:10 IST | Sydney Thunder vs Adelaide Strikers | M13710 batter_fours | Laura Wolvaardt under 3.5 | 1.92 @ feedj_d | 1.81 | 0.5987 | 6.1% | 1.65% | medium |
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | Ellyse Perry - Over/Under 29.5 Runs | Ellyse Perry under 29.5 | 1.83 @ feede_lb | 1.72 | 0.6366 | 6.4% | 1.92% | medium |
| 11-26 20:00 IST | Abu Dhabi Knight Riders vs Mi Emirates | M13710 batter_fours | Andre Russell under 1.5 | 1.87 @ feedj_d | 1.57 | 0.6985 | 19.3% | 2.00% | medium |
| 11-27 13:45 IST | Australia vs England | To score at least 50 Runs | Aneurin Donald 50+ yes | 5.00 @ feedk_leoal | 4.66 | 0.2191 | 7.4% | 0.46% | medium |

### Why / notes per bet
- **Sydney Thunder vs Adelaide Strikers / M13710 batter_fours / Laura Wolvaardt under 3.5** - why: Model 60% vs market 51% for under 3.5 fours; form 3.7 fours/inn recency-weighted T20 (n_eff 88.8; last 5: 4, 11, 4, 7, 2), bats in 98% of games played; at North Sydney Oval: 12 inns avg 2.7; context adj: venue environment +14%, at this venue -5%; weather: cloud cover 81%. Notes: 2 market source(s) for fair price; model 0.599 vs market 0.515; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers vs Melbourne Stars / Ellyse Perry - Over/Under 29.5 Runs / Ellyse Perry under 29.5** - why: Model 64% vs market 54% for under 29.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.2; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 83%. Notes: 2 market source(s) for fair price; model 0.637 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules
- **Abu Dhabi Knight Riders vs Mi Emirates / M13710 batter_fours / Andre Russell under 1.5** - why: Model 70% vs market 59% for under 1.5 fours; form 1.1 fours/inn recency-weighted T20 (n_eff 87.3; last 5: 1, 0, 2, 2, 3), bats in 89% of games played; vs MI Emirates: 8 inns avg 1.5; context adj: venue environment -4%, team H2H context -7%. Notes: 2 market source(s) for fair price; model 0.698 vs market 0.589; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / To score at least 50 Runs / Aneurin Donald 50+ yes** - why: Model 22% vs market 21% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 34.2; last 5: 85, 10, 13, 21, 12), bats in 98% of games played; vs Australia: 2 inns avg 47.5; weather: rain chance up to 49%, high humidity 90%, cloud cover 97%. Notes: 5 market source(s) for fair price; model 0.219 vs market 0.211; milestone: assumes loses if player doesn't bat/bowl (void if not in XI); market fair anchored on feedk_leoal O/U 21.5 (de-vigged 0.500)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 10:10 IST Sydney Thunder (W) vs Adelaide Strikers (W) / Batsman Total Match Sixes / ME Bouchier over 0.5 @ 6.00 (moviodds_bet365): edge 68.6%, model 0.3201, market 0.249

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Lokseva Academy (male), Majees Titan (male), Multan Region (male), Muscat Shaheens (W) (female), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), Oca Invincibles (W) (female), Peshawar Blues (male), Sialkot Blues (male), South Zone (W) (female), South Zone (male), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), West Zone (W) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 229.5s. Snapshot: `odds_20261125T153039Z.jsonl.gz`
