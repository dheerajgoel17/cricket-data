# Cricket value bets - 2026-11-17 21:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 253 prices
- **feedg**: ok, 8 prices, 1 events
- **feedk**: ok, 156 prices, 6 events
- **feede**: ok, 484 prices, 28 events
- **feedh**: ok, 1003 prices, 50 events
- **feedf**: ok, 348 prices, 22 events
- **feedj**: ok, 704 prices, 17 events
- **feedi**: ok, 1866 prices, 52 events

Matches starting in next 168h: **47**, markets priced: **375**, value bets: **5** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-18 09:00 IST | Australia vs England | G9181 batter_sixes | Mitchell Marsh under 0.5 | 2.62 @ feedi_d | 2.36 | 0.5004 | 11.4% | 1.75% | medium |
| 11-18 09:00 IST | Australia vs England | To score a Half-Century | Cooper Connolly 50+ no | 1.39 @ feedk_leoal | 1.31 | 0.8349 | 6.3% | 2.00% | medium |
| 11-18 09:00 IST | Australia vs England | To score 50 - Ben Duckett | Ben Duckett 50+ yes | 3.40 @ feedi_d | 3.23 | 0.3079 | 5.3% | 0.55% | medium |
| 11-19 10:10 IST | Hobart Hurricanes (Women) vs Perth Scorchers (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.10 @ feedi_d | 1.98 | 0.5826 | 6.2% | 1.40% | low |
| 11-20 13:40 IST | Adelaide Strikers vs Melbourne Renegades | Hayley Matthews To Score 50 | Hayley Matthews 50+ yes | 5.00 @ feede_lb | 4.69 | 0.2083 | 6.5% | 0.41% | medium |

### Why / notes per bet
- **Australia vs England / G9181 batter_sixes / Mitchell Marsh under 0.5** - why: Model 50% vs market 36% for under 0.5 sixes; form 2.0 sixes/inn recency-weighted ODI (n_eff 21.5; last 5: 0, 4, 2, 2, 5), bats in 97% of games played; at Bellerive Oval, Hobart: 1 inns avg 0.0; vs England: 16 inns avg 1.0; context adj: venue environment +4%. Notes: 2 market source(s) for fair price; model 0.500 vs market 0.362; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / To score a Half-Century / Cooper Connolly 50+ no** - why: Model 83% vs market 71% for 50+ runs; form 31.3 runs/inn recency-weighted ODI (n_eff 16.1; last 5: 0, 27, 23, 10, 38), bats in 87% of games played; vs England: 2 inns avg 13.5. Notes: 5 market source(s) for fair price; model 0.835 vs market 0.707; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Australia vs England / To score 50 - Ben Duckett / Ben Duckett 50+ yes** - why: Model 31% vs market 31% for 50+ runs; form 44.7 runs/inn recency-weighted ODI (n_eff 25.0; last 5: 9, 9, 167, 105, 29), bats in 98% of games played; vs Australia: 8 inns avg 61.0. Notes: 5 market source(s) for fair price; model 0.308 vs market 0.311; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Hobart Hurricanes (Women) vs Perth Scorchers (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 58% vs market 44% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 80.7; last 5: 1, 4, 8, 1, 9), bats in 97% of games played; at Allan Border Field, Brisbane: 20 inns avg 3.4; context adj: venue environment +9%, at this venue -4%, team H2H context +1%; weather: cloud cover 85%. Notes: 1 market source(s) for fair price; model 0.583 vs market 0.443; assumes bet void if player doesn't bat/bowl - check book rules
- **Adelaide Strikers vs Melbourne Renegades / Hayley Matthews To Score 50 / Hayley Matthews 50+ yes** - why: Model 21% vs market 22% for 50+ runs; form 27.3 runs/inn recency-weighted T20 (n_eff 81.8; last 5: 3, 1, 49, 59, 7), bats in 99% of games played; vs Adelaide Strikers Women: 1 inns avg 49.0; context adj: team H2H context +8%. Notes: 2 market source(s) for fair price; model 0.208 vs market 0.217; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

Unmatched team names (add to mappings/teams.csv): AL Barkat (male), Andhra (W) (female), Baroda (W) (female), Central (male), Karnataka (W) (female), Maharashtra (W) (female), Pak Xi (male), Railways (W) (female), Royal Champs (male), Vidarbha (W) (female)

Runtime 159.8s. Snapshot: `odds_20261117T153039Z.jsonl.gz`
