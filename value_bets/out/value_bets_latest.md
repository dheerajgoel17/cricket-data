# Cricket value bets - 2026-11-24 21:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2084 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 386 prices
- **feedl**: ok, 514 prices, 20 events
- **feedk**: ok, 192 prices, 5 events
- **feedf**: ok, 208 prices, 4 events
- **feede**: ok, 452 prices, 17 events
- **feedj**: ok, 541 prices, 7 events
- **feedh**: ok, 1422 prices, 47 events
- **feedi**: ok, 1881 prices, 37 events

Matches starting in next 168h: **34**, markets priced: **478**, value bets: **3** (new alerts: 2). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-27 13:45 IST | Australia vs England | G9181 batter_sixes | Aneurin Donald under 0.5 | 2.75 @ feedi_d | 2.39 | 0.4133 | 15.2% | 2.00% | medium |
| 11-27 13:45 IST | Australia vs England | G9181 batter_sixes | Jake Fraser-McGurk under 0.5 | 2.75 @ feedi_d | 2.40 | 0.4932 | 14.7% | 2.00% | medium |
| 11-27 13:45 IST | Australia vs England | Aneurin Donald To Score 50 | Aneurin Donald 50+ yes | 5.00 @ feede_lb | 4.50 | 0.2192 | 11.2% | 0.70% | medium |

### Why / notes per bet
- **Australia vs England / G9181 batter_sixes / Aneurin Donald under 0.5** - why: Model 41% vs market 42% for under 0.5 sixes; form 2.2 sixes/inn recency-weighted T20 (n_eff 34.2; last 5: 9, 0, 0, 1, 1), bats in 98% of games played; vs Australia: 2 inns avg 4.5; context adj: venue environment -3%. Notes: 2 market source(s) for fair price; model 0.413 vs market 0.423; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / G9181 batter_sixes / Jake Fraser-McGurk under 0.5** - why: Model 49% vs market 35% for under 0.5 sixes; form 1.3 sixes/inn recency-weighted T20 (n_eff 34.5; last 5: 3, 0, 0, 5, 1), bats in 96% of games played; vs England: 3 inns avg 1.7; context adj: venue environment -3%. Notes: 2 market source(s) for fair price; model 0.493 vs market 0.355; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / Aneurin Donald To Score 50 / Aneurin Donald 50+ yes** - why: Model 22% vs market 23% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 34.2; last 5: 85, 10, 13, 21, 12), bats in 98% of games played; vs Australia: 2 inns avg 47.5. Notes: 4 market source(s) for fair price; model 0.219 vs market 0.225; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), Central Zone (Women) (female), Central Zone (male), East Zone (W) (female), East Zone (Women) (female), East Zone (male), Ias Invincibles (male), Mustafa Fragrance (male), North East Zone (W) (female), North East Zone (Women) (female), North East Zone (male), North Zone (W) (female), North Zone (Women) (female), North Zone (male), South Zone (W) (female), South Zone (Women) (female), South Zone (male), West Zone (W) (female), West Zone (Women) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 270.2s. Snapshot: `odds_20261124T153039Z.jsonl.gz`
