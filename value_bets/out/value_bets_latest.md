# Cricket value bets - 2026-11-25 02:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **moviodds_bet365**: ok, 2373 prices
- **smarkets**: ok, 441 prices
- **feedk**: ok, 256 prices, 7 events
- **feedl**: ok, 568 prices, 36 events
- **feedf**: ok, 208 prices, 4 events
- **feedj**: ok, 565 prices, 7 events
- **feede**: ok, 608 prices, 33 events
- **feedh**: ok, 2111 prices, 71 events
- **feedi**: ok, 2314 prices, 41 events, stopped time budget

Matches starting in next 168h: **57**, markets priced: **640**, value bets: **4** (new alerts: 2). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-25 13:40 IST | Melbourne Renegades (Women) vs Brisbane Heat (Women) | G9182 batter_fours | Sophie Molineux under 1.5 | 2.00 @ feedi_d | 1.83 | 0.6263 | 9.1% | 2.00% | medium |
| 11-25 13:40 IST | Melbourne Renegades vs Brisbane Heat | M13710 batter_fours | Orla Prendergast over 1.5 | 1.92 @ feedj_d | 1.82 | 0.5746 | 5.7% | 1.55% | medium |
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |
| 11-27 13:45 IST | Australia vs England | Aneurin Donald To Score 50 | Aneurin Donald 50+ yes | 5.00 @ feede_lb | 4.58 | 0.2192 | 9.1% | 0.57% | medium |

### Why / notes per bet
- **Melbourne Renegades (Women) vs Brisbane Heat (Women) / G9182 batter_fours / Sophie Molineux under 1.5** - why: Model 63% vs market 48% for under 1.5 fours; form 1.8 fours/inn recency-weighted T20 (n_eff 33.2; last 5: 8, 7, 1, 0, 1), bats in 70% of games played; at Junction Oval, Melbourne: 18 inns avg 1.8; context adj: venue environment +11%. Notes: 3 market source(s) for fair price; model 0.626 vs market 0.480; assumes bet void if player doesn't bat/bowl - check book rules
- **Melbourne Renegades vs Brisbane Heat / M13710 batter_fours / Orla Prendergast over 1.5** - why: Model 57% vs market 53% for over 1.5 fours; form 2.8 fours/inn recency-weighted T20 (n_eff 42.6; last 5: 2, 0, 6, 2, 2), bats in 92% of games played; at Junction Oval, Melbourne: 2 inns avg 4.0; context adj: venue environment +11%, at this venue +3%. Notes: 3 market source(s) for fair price; model 0.575 vs market 0.531; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.3; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0; weather: high humidity 86%. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / Aneurin Donald To Score 50 / Aneurin Donald 50+ yes** - why: Model 22% vs market 22% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 34.2; last 5: 85, 10, 13, 21, 12), bats in 98% of games played; vs Australia: 2 inns avg 47.5. Notes: 4 market source(s) for fair price; model 0.219 vs market 0.217; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 47.8%, model 0.0764, market 0.1105

Unmatched team names (add to mappings/teams.csv): Boland Rocks (male), Central (male), Central Zone (W) (female), Central Zone (Women) (female), Central Zone (male), East Zone (W) (female), East Zone (Women) (female), East Zone (male), Elite Cricket Academy (male), Faisalabad Region (male), Ghubra Giants (W) (female), Ias Invincibles (male), Karachi Region Blues (male), Lahore Region Whites (male), Majees Titan (male), Multan Region (male), Muscat Shaheens (W) (female), Muscat Thunders (W) (female), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (Women) (female), North East Zone (male), North Zone (W) (female), North Zone (Women) (female), North Zone (male), Oca Invincibles (W) (female), Peshawar Blues (male), Sialkot Blues (male), South Zone (W) (female), South Zone (Women) (female), South Zone (male), Sunny 11 Pratishtan (male), West Zone (W) (female), West Zone (Women) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 270.1s. Snapshot: `odds_20261124T203040Z.jsonl.gz`
