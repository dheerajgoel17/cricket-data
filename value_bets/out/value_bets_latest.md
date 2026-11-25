# Cricket value bets - 2026-11-25 20:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1873 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 373 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedk**: ok, 252 prices, 6 events
- **feedl**: ok, 515 prices, 40 events
- **feedj**: ok, 328 prices, 8 events
- **feede**: ok, 654 prices, 36 events
- **feedh**: ok, 1921 prices, 92 events
- **feedf**: ok, 642 prices, 20 events

Matches starting in next 168h: **52**, markets priced: **530**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | Ellyse Perry - Over/Under 29.5 Runs | Ellyse Perry under 29.5 | 1.83 @ feede_lb | 1.72 | 0.6366 | 6.4% | 1.92% | medium |
| 11-27 13:45 IST | Australia vs England | Aneurin Donald To Score 50 | Aneurin Donald 50+ yes | 5.00 @ feede_lb | 4.48 | 0.2191 | 11.7% | 0.73% | medium |

### Why / notes per bet
- **Sydney Sixers vs Melbourne Stars / Ellyse Perry - Over/Under 29.5 Runs / Ellyse Perry under 29.5** - why: Model 64% vs market 54% for under 29.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.2; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 83%. Notes: 2 market source(s) for fair price; model 0.637 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / Aneurin Donald To Score 50 / Aneurin Donald 50+ yes** - why: Model 22% vs market 23% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 34.2; last 5: 85, 10, 13, 21, 12), bats in 98% of games played; vs Australia: 2 inns avg 47.5; weather: rain chance up to 49%, high humidity 90%, cloud cover 97%. Notes: 5 market source(s) for fair price; model 0.219 vs market 0.227; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Lokseva Academy (male), Majees Titan (male), Multan Region (male), Muscat Shaheens (W) (female), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), Oca Invincibles (W) (female), Peshawar Blues (male), Sialkot Blues (male), South Zone (W) (female), South Zone (male), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), West Zone (W) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 156.7s. Snapshot: `odds_20261125T143048Z.jsonl.gz`
