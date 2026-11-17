# Cricket value bets - 2026-11-17 16:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 263 prices
- **feedg**: ok, 8 prices, 1 events
- **feedk**: ok, 88 prices, 4 events
- **feede**: ok, 488 prices, 28 events
- **feedh**: ok, 868 prices, 45 events
- **feedi**: ok, 1197 prices, 44 events
- **feedf**: ok, 364 prices, 23 events

Matches starting in next 168h: **38**, markets priced: **289**, value bets: **4** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-18 09:00 IST | Australia vs England | G9181 batter_sixes | Mitchell Marsh under 0.5 | 2.62 @ feedi_d | 2.38 | 0.5004 | 10.3% | 1.59% | low |
| 11-18 09:00 IST | Australia vs England | To score a Half-Century | Cooper Connolly 50+ no | 1.39 @ feedk_leoal | 1.31 | 0.8349 | 6.3% | 2.00% | medium |
| 11-18 09:00 IST | Australia vs England | To score 50 - Ben Duckett | Ben Duckett 50+ yes | 3.40 @ feedi_d | 3.21 | 0.3079 | 6.1% | 0.63% | medium |
| 11-19 10:10 IST | Hobart Hurricanes (Women) vs Perth Scorchers (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.10 @ feedi_d | 1.98 | 0.5826 | 6.2% | 1.40% | low |

### Why / notes per bet
- **Australia vs England / G9181 batter_sixes / Mitchell Marsh under 0.5** - why: Model 50% vs market 35% for under 0.5 sixes; form 2.0 sixes/inn recency-weighted ODI (n_eff 21.5; last 5: 0, 4, 2, 2, 5), bats in 97% of games played; at Bellerive Oval, Hobart: 1 inns avg 0.0; vs England: 16 inns avg 1.0; context adj: venue environment +4%. Notes: 1 market source(s) for fair price; model 0.500 vs market 0.355; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / To score a Half-Century / Cooper Connolly 50+ no** - why: Model 83% vs market 71% for 50+ runs; form 31.3 runs/inn recency-weighted ODI (n_eff 16.1; last 5: 0, 27, 23, 10, 38), bats in 87% of games played; vs England: 2 inns avg 13.5. Notes: 4 market source(s) for fair price; model 0.835 vs market 0.707; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Australia vs England / To score 50 - Ben Duckett / Ben Duckett 50+ yes** - why: Model 31% vs market 32% for 50+ runs; form 44.7 runs/inn recency-weighted ODI (n_eff 25.0; last 5: 9, 9, 167, 105, 29), bats in 98% of games played; vs Australia: 8 inns avg 61.0. Notes: 4 market source(s) for fair price; model 0.308 vs market 0.315; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Hobart Hurricanes (Women) vs Perth Scorchers (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 58% vs market 44% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 80.7; last 5: 1, 4, 8, 1, 9), bats in 97% of games played; at Allan Border Field, Brisbane: 20 inns avg 3.4; context adj: venue environment +9%, at this venue -4%, team H2H context +1%; weather: cloud cover 95%. Notes: 1 market source(s) for fair price; model 0.583 vs market 0.443; assumes bet void if player doesn't bat/bowl - check book rules

Unmatched team names (add to mappings/teams.csv): Central (male), Mountaineers (male), Royal Champs (male)

Runtime 200.9s. Snapshot: `odds_20261117T103035Z.jsonl.gz`
