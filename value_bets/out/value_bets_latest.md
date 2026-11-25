# Cricket value bets - 2026-11-25 23:07 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1897 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 373 prices
- **feedk**: ok, 252 prices, 6 events
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedl**: ok, 512 prices, 40 events
- **feedj**: ok, 308 prices, 8 events
- **feedh**: ok, 1921 prices, 96 events
- **feede**: ok, 654 prices, 39 events
- **feedf**: ok, 642 prices, 20 events

Matches starting in next 168h: **55**, markets priced: **538**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-26 10:10 IST | Sydney Thunder vs Adelaide Strikers | M13710 batter_fours | Laura Wolvaardt under 3.5 | 1.92 @ feedj_d | 1.81 | 0.5987 | 6.1% | 1.65% | medium |
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | Ellyse Perry - Over/Under 29.5 Runs | Ellyse Perry under 29.5 | 1.83 @ feede_lb | 1.72 | 0.6366 | 6.4% | 1.92% | medium |

### Why / notes per bet
- **Sydney Thunder vs Adelaide Strikers / M13710 batter_fours / Laura Wolvaardt under 3.5** - why: Model 60% vs market 51% for under 3.5 fours; form 3.7 fours/inn recency-weighted T20 (n_eff 88.8; last 5: 4, 11, 4, 7, 2), bats in 98% of games played; at North Sydney Oval: 12 inns avg 2.7; context adj: venue environment +14%, at this venue -5%; weather: cloud cover 81%. Notes: 2 market source(s) for fair price; model 0.599 vs market 0.515; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers vs Melbourne Stars / Ellyse Perry - Over/Under 29.5 Runs / Ellyse Perry under 29.5** - why: Model 64% vs market 54% for under 29.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.2; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 83%. Notes: 2 market source(s) for fair price; model 0.637 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 10:10 IST Sydney Thunder (W) vs Adelaide Strikers (W) / Batsman Total Match Sixes / ME Bouchier over 0.5 @ 6.00 (moviodds_bet365): edge 68.6%, model 0.3201, market 0.249
- 11-26 13:40 IST Sydney Sixers (W) vs Melbourne Stars (W) / Batsman Total Match Sixes / AK Gardner under 0.5 @ 2.62 (moviodds_bet365): edge 36.1%, model 0.5409, market 0.5

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Lokseva Academy (male), Majees Titan (male), Multan Region (male), Muscat Shaheens (W) (female), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), Oca Invincibles (W) (female), Peshawar Blues (male), Sialkot Blues (male), South Zone (W) (female), South Zone (male), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), West Zone (W) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 228.0s. Snapshot: `odds_20261125T173700Z.jsonl.gz`
