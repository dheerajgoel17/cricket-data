# Cricket value bets - 2026-11-25 01:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2056 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 441 prices
- **feedh**: error - IncompleteRead: IncompleteRead(346129 bytes read)
- **feedk**: ok, 256 prices, 7 events
- **feedl**: ok, 554 prices, 35 events
- **feedf**: ok, 208 prices, 4 events
- **feedj**: ok, 536 prices, 7 events
- **feede**: ok, 608 prices, 33 events
- **feedi**: ok, 2502 prices, 48 events

Matches starting in next 168h: **52**, markets priced: **530**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |
| 11-27 13:45 IST | Australia vs England | Aneurin Donald To Score 50 | Aneurin Donald 50+ yes | 5.00 @ feede_lb | 4.48 | 0.2192 | 11.6% | 0.72% | medium |

### Why / notes per bet
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 86%. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / Aneurin Donald To Score 50 / Aneurin Donald 50+ yes** - why: Model 22% vs market 23% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 34.2; last 5: 85, 10, 13, 21, 12), bats in 98% of games played; vs Australia: 2 inns avg 47.5. Notes: 5 market source(s) for fair price; model 0.219 vs market 0.226; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 47.8%, model 0.0764, market 0.1105

Unmatched team names (add to mappings/teams.csv): Boland Rocks (male), Central Zone (W) (female), Central Zone (Women) (female), East Zone (W) (female), East Zone (Women) (female), Elite Cricket Academy (male), Faisalabad Region (male), Ghubra Giants (W) (female), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Majees Titan (male), Multan Region (male), Muscat Shaheens (W) (female), Muscat Thunders (W) (female), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (Women) (female), North Zone (W) (female), North Zone (Women) (female), Oca Invincibles (W) (female), Peshawar Blues (male), Pondicherry (male), Sialkot Blues (male), South Zone (W) (female), South Zone (Women) (female), Sunny 11 Pratishtan (male), West Zone (W) (female), West Zone (Women) (female), Yalla Shabab Giants (male)

Runtime 243.3s. Snapshot: `odds_20261124T193038Z.jsonl.gz`
