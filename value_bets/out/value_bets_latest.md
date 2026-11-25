# Cricket value bets - 2026-11-25 13:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2537 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 376 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feede**: error - URLError: <urlopen error [Errno -2] Name or service not known>
- **feedl**: ok, 629 prices, 34 events
- **feedk**: ok, 288 prices, 8 events
- **feedj**: ok, 766 prices, 16 events
- **feedh**: ok, 1878 prices, 77 events
- **feedf**: ok, 568 prices, 21 events

Matches starting in next 168h: **50**, markets priced: **566**, value bets: **4** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-25 20:00 IST | Dubai Capitals vs Desert Vipers | M13710 batter_fours | Francois du Plessis under 2.5 | 1.92 @ feedj_d | 1.82 | 0.5677 | 5.7% | 1.55% | medium |
| 11-26 10:10 IST | Sydney Thunder vs Adelaide Strikers | M13710 batter_fours | Laura Wolvaardt under 3.5 | 1.92 @ feedj_d | 1.81 | 0.5987 | 6.1% | 1.65% | medium |
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |
| 11-27 13:45 IST | Australia vs England | To score at least 50 Runs | Aneurin Donald 50+ yes | 5.00 @ feedk_leoal | 4.65 | 0.2191 | 7.6% | 0.47% | medium |

### Why / notes per bet
- **Dubai Capitals vs Desert Vipers / M13710 batter_fours / Francois du Plessis under 2.5** - why: Model 57% vs market 54% for under 2.5 fours; form 3.1 fours/inn recency-weighted T20 (n_eff 67.9; last 5: 3, 9, 3, 7, 2), bats in 96% of games played; at Dubai International Cricket Stadium, Dubai: 11 inns avg 3.5; context adj: at this venue +2%, team H2H context +5%. Notes: 2 market source(s) for fair price; model 0.568 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Thunder vs Adelaide Strikers / M13710 batter_fours / Laura Wolvaardt under 3.5** - why: Model 60% vs market 51% for under 3.5 fours; form 3.7 fours/inn recency-weighted T20 (n_eff 88.8; last 5: 4, 11, 4, 7, 2), bats in 98% of games played; at North Sydney Oval: 12 inns avg 2.7; context adj: venue environment +14%, at this venue -5%. Notes: 2 market source(s) for fair price; model 0.599 vs market 0.515; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.2; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 84%, cloud cover 82%. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / To score at least 50 Runs / Aneurin Donald 50+ yes** - why: Model 22% vs market 21% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 34.2; last 5: 85, 10, 13, 21, 12), bats in 98% of games played; vs Australia: 2 inns avg 47.5; weather: high humidity 90%. Notes: 4 market source(s) for fair price; model 0.219 vs market 0.212; milestone: assumes loses if player doesn't bat/bowl (void if not in XI); market fair anchored on feedk_leoal O/U 21.5 (de-vigged 0.500)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 10:10 IST Sydney Thunder (W) vs Adelaide Strikers (W) / Batsman Total Match Sixes / ME Bouchier over 0.5 @ 6.00 (moviodds_bet365): edge 68.6%, model 0.3201, market 0.249
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 47.8%, model 0.0764, market 0.1105

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), Ghubra Giants (W) (female), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Majees Titan (male), Multan Region (male), Muscat Shaheens (W) (female), Muscat Thunders (W) (female), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), Oca Invincibles (W) (female), Peshawar Blues (male), Sialkot Blues (male), South Zone (W) (female), South Zone (male), Sunny 11 Pratishtan (male), West Zone (W) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 196.2s. Snapshot: `odds_20261125T073037Z.jsonl.gz`
