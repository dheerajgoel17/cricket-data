# Cricket value bets - 2026-11-25 18:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2252 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 371 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedk**: ok, 284 prices, 7 events
- **feedl**: ok, 651 prices, 40 events
- **feede**: ok, 692 prices, 37 events
- **feedh**: ok, 2078 prices, 87 events
- **feedj**: ok, 738 prices, 16 events
- **feedf**: ok, 674 prices, 21 events

Matches starting in next 168h: **53**, markets priced: **584**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-25 20:00 IST | Dubai Capitals vs Desert Vipers | M13710 batter_fours | Francois du Plessis under 2.5 | 1.92 @ feedj_d | 1.81 | 0.574 | 6.3% | 1.70% | medium |
| 11-26 10:10 IST | Sydney Thunder vs Adelaide Strikers | M13710 batter_fours | Laura Wolvaardt under 3.5 | 1.92 @ feedj_d | 1.81 | 0.5987 | 6.1% | 1.65% | medium |
| 11-27 13:45 IST | Australia vs England | Aneurin Donald To Score 50 | Aneurin Donald 50+ yes | 5.00 @ feede_lb | 4.60 | 0.2191 | 8.7% | 0.54% | medium |

### Why / notes per bet
- **Dubai Capitals vs Desert Vipers / M13710 batter_fours / Francois du Plessis under 2.5** - why: Model 57% vs market 54% for under 2.5 fours; form 3.1 fours/inn recency-weighted T20 (n_eff 68.9; last 5: 0, 3, 9, 3, 7), bats in 96% of games played; at Dubai International Cricket Stadium, Dubai: 12 inns avg 3.2; context adj: team H2H context +5%. Notes: 2 market source(s) for fair price; model 0.574 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Thunder vs Adelaide Strikers / M13710 batter_fours / Laura Wolvaardt under 3.5** - why: Model 60% vs market 51% for under 3.5 fours; form 3.7 fours/inn recency-weighted T20 (n_eff 88.8; last 5: 4, 11, 4, 7, 2), bats in 98% of games played; at North Sydney Oval: 12 inns avg 2.7; context adj: venue environment +14%, at this venue -5%; weather: cloud cover 81%. Notes: 2 market source(s) for fair price; model 0.599 vs market 0.515; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / Aneurin Donald To Score 50 / Aneurin Donald 50+ yes** - why: Model 22% vs market 22% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 34.2; last 5: 85, 10, 13, 21, 12), bats in 98% of games played; vs Australia: 2 inns avg 47.5; weather: rain chance up to 49%, high humidity 90%, cloud cover 97%. Notes: 5 market source(s) for fair price; model 0.219 vs market 0.216; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 10:10 IST Sydney Thunder (W) vs Adelaide Strikers (W) / Batsman Total Match Sixes / ME Bouchier over 0.5 @ 6.00 (moviodds_bet365): edge 68.6%, model 0.3201, market 0.249

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), Ghubra Giants (W) (female), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Lokseva Academy (male), Majees Titan (male), Multan Region (male), Muscat Shaheens (W) (female), Muscat Thunders (W) (female), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), Oca Invincibles (W) (female), Peshawar Blues (male), Sialkot Blues (male), South Zone (W) (female), South Zone (male), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), West Zone (W) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 242.8s. Snapshot: `odds_20261125T123034Z.jsonl.gz`
