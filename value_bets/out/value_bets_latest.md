# Cricket value bets - 2026-11-17 22:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 257 prices
- **feedg**: ok, 8 prices, 1 events
- **feedh**: error - IncompleteRead: IncompleteRead(68926 bytes read)
- **feedk**: ok, 156 prices, 5 events
- **feede**: ok, 516 prices, 28 events
- **feedf**: ok, 348 prices, 22 events
- **feedj**: ok, 776 prices, 18 events
- **feedi**: ok, 1956 prices, 57 events

Matches starting in next 168h: **40**, markets priced: **298**, value bets: **4** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-18 09:00 IST | Australia vs England | G9181 batter_sixes | Mitchell Marsh under 0.5 | 2.62 @ feedi_d | 2.36 | 0.5004 | 11.4% | 1.75% | medium |
| 11-18 09:00 IST | Australia vs England | To score a Half-Century | Cooper Connolly 50+ no | 1.39 @ feedk_leoal | 1.31 | 0.8349 | 6.0% | 2.00% | medium |
| 11-19 10:10 IST | Hobart Hurricanes (Women) vs Perth Scorchers (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.10 @ feedi_d | 1.98 | 0.5826 | 6.2% | 1.40% | low |
| 11-20 13:40 IST | Adelaide Strikers vs Melbourne Renegades | Hayley Matthews To Score 50 | Hayley Matthews 50+ yes | 5.00 @ feede_lb | 4.51 | 0.2083 | 10.9% | 0.68% | medium |

### Why / notes per bet
- **Australia vs England / G9181 batter_sixes / Mitchell Marsh under 0.5** - why: Model 50% vs market 36% for under 0.5 sixes; form 2.0 sixes/inn recency-weighted ODI (n_eff 21.5; last 5: 0, 4, 2, 2, 5), bats in 97% of games played; at Bellerive Oval, Hobart: 1 inns avg 0.0; vs England: 16 inns avg 1.0; context adj: venue environment +4%. Notes: 2 market source(s) for fair price; model 0.500 vs market 0.362; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / To score a Half-Century / Cooper Connolly 50+ no** - why: Model 83% vs market 70% for 50+ runs; form 31.3 runs/inn recency-weighted ODI (n_eff 16.1; last 5: 0, 27, 23, 10, 38), bats in 87% of games played; vs England: 2 inns avg 13.5. Notes: 5 market source(s) for fair price; model 0.835 vs market 0.703; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Hobart Hurricanes (Women) vs Perth Scorchers (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 58% vs market 44% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 80.7; last 5: 1, 4, 8, 1, 9), bats in 97% of games played; at Allan Border Field, Brisbane: 20 inns avg 3.4; context adj: venue environment +9%, at this venue -4%, team H2H context +1%; weather: cloud cover 85%. Notes: 1 market source(s) for fair price; model 0.583 vs market 0.443; assumes bet void if player doesn't bat/bowl - check book rules
- **Adelaide Strikers vs Melbourne Renegades / Hayley Matthews To Score 50 / Hayley Matthews 50+ yes** - why: Model 21% vs market 23% for 50+ runs; form 27.3 runs/inn recency-weighted T20 (n_eff 81.8; last 5: 3, 1, 49, 59, 7), bats in 99% of games played; vs Adelaide Strikers Women: 1 inns avg 49.0; context adj: team H2H context +8%. Notes: 3 market source(s) for fair price; model 0.208 vs market 0.233; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

Unmatched team names (add to mappings/teams.csv): AL Barkat (male), Andhra (W) (female), Andhra (Women) (female), Baroda (W) (female), Baroda (Women) (female), Karnataka (W) (female), Karnataka (Women) (female), Maharashtra (W) (female), Maharashtra (Women) (female), Omr Checker (male), Pak Xi (male), Railways (W) (female), Railways (Women) (female), Royal Champs (male), Sunny 11 Pratishtan (male), Vidarbha (W) (female), Vidarbha (Women) (female)

Runtime 352.8s. Snapshot: `odds_20261117T163040Z.jsonl.gz`
