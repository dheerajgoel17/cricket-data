# Cricket value bets - 2026-11-25 00:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2068 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 441 prices
- **feedl**: ok, 537 prices, 33 events
- **feedk**: ok, 256 prices, 7 events
- **feedf**: ok, 208 prices, 4 events
- **feedj**: ok, 557 prices, 7 events
- **feede**: ok, 608 prices, 33 events
- **feedh**: ok, 2099 prices, 71 events
- **feedi**: ok, 2524 prices, 48 events

Matches starting in next 168h: **58**, markets priced: **630**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |
| 11-27 13:45 IST | Australia vs England | Aneurin Donald To Score 50 | Aneurin Donald 50+ yes | 5.00 @ feede_lb | 4.48 | 0.2192 | 11.6% | 0.72% | medium |
| 11-27 13:45 IST | Australia vs England | G9181 batter_sixes | Jake Fraser-McGurk under 0.5 | 2.62 @ feedi_d | 2.40 | 0.4932 | 9.5% | 1.46% | medium |

### Why / notes per bet
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / Aneurin Donald To Score 50 / Aneurin Donald 50+ yes** - why: Model 22% vs market 23% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 34.2; last 5: 85, 10, 13, 21, 12), bats in 98% of games played; vs Australia: 2 inns avg 47.5. Notes: 5 market source(s) for fair price; model 0.219 vs market 0.226; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Australia vs England / G9181 batter_sixes / Jake Fraser-McGurk under 0.5** - why: Model 49% vs market 35% for under 0.5 sixes; form 1.3 sixes/inn recency-weighted T20 (n_eff 34.5; last 5: 3, 0, 0, 5, 1), bats in 96% of games played; vs England: 3 inns avg 1.7; context adj: venue environment -3%. Notes: 2 market source(s) for fair price; model 0.493 vs market 0.355; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 47.8%, model 0.0764, market 0.1105
- 11-25 20:00 IST Dubai Capitals vs Desert Vipers / G2808 / Babar Azam @ 8.50 (feedi_d): edge 30.3%, model None, market 0.1532

Unmatched team names (add to mappings/teams.csv): Boland Rocks (male), Central (male), Central Zone (W) (female), Central Zone (Women) (female), Central Zone (male), East Zone (W) (female), East Zone (Women) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), Ghubra Giants (W) (female), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Majees Titan (male), Multan Region (male), Muscat Shaheens (W) (female), Muscat Thunders (W) (female), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (Women) (female), North East Zone (male), North Zone (W) (female), North Zone (Women) (female), North Zone (male), Oca Invincibles (W) (female), Peshawar Blues (male), Pondicherry (male), Sialkot Blues (male), South Zone (W) (female), South Zone (Women) (female), South Zone (male), Sunny 11 Pratishtan (male), West Zone (W) (female), West Zone (Women) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 251.2s. Snapshot: `odds_20261124T183041Z.jsonl.gz`
