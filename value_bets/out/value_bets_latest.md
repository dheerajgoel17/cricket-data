# Cricket value bets - 2026-11-17 10:13 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 283 prices
- **feedg**: ok, 16 prices, 2 events
- **feedk**: ok, 100 prices, 6 events
- **feede**: ok, 400 prices, 23 events
- **feedh**: ok, 866 prices, 47 events
- **feedi**: ok, 1498 prices, 53 events
- **feedf**: ok, 410 prices, 24 events

Matches starting in next 168h: **42**, markets priced: **384**, value bets: **5** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-18 09:00 IST | Australia vs England | G9181 batter_sixes | Mitchell Marsh under 0.5 | 2.62 @ feedi_d | 2.38 | 0.5004 | 10.3% | 1.59% | low |
| 11-18 09:00 IST | Australia vs England | To score a Half-Century | Cooper Connolly 50+ no | 1.39 @ feedk_leoal | 1.31 | 0.8349 | 6.3% | 2.00% | medium |
| 11-18 09:00 IST | Australia vs England | To score 50 - Ben Duckett | Ben Duckett 50+ yes | 3.40 @ feedi_d | 3.21 | 0.3079 | 6.1% | 0.63% | medium |
| 11-19 03:30 IST | New Zealand vs India | Batsman Runs - Nicholls, Henry | Henry Nicholls under 24.5 | 1.87 @ feedh_d | 1.77 | 0.6416 | 5.4% | 1.56% | medium |
| 11-19 10:10 IST | Hobart Hurricanes (Women) vs Perth Scorchers (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.10 @ feedi_d | 1.98 | 0.5826 | 6.2% | 1.40% | low |

### Why / notes per bet
- **Australia vs England / G9181 batter_sixes / Mitchell Marsh under 0.5** - why: Model 50% vs market 35% for under 0.5 sixes; form 2.0 sixes/inn recency-weighted ODI (n_eff 21.5; last 5: 0, 4, 2, 2, 5), bats in 97% of games played; at Bellerive Oval, Hobart: 1 inns avg 0.0; vs England: 16 inns avg 1.0; context adj: venue environment +4%. Notes: 1 market source(s) for fair price; model 0.500 vs market 0.355; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / To score a Half-Century / Cooper Connolly 50+ no** - why: Model 83% vs market 71% for 50+ runs; form 31.3 runs/inn recency-weighted ODI (n_eff 16.1; last 5: 0, 27, 23, 10, 38), bats in 87% of games played; vs England: 2 inns avg 13.5. Notes: 4 market source(s) for fair price; model 0.835 vs market 0.707; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Australia vs England / To score 50 - Ben Duckett / Ben Duckett 50+ yes** - why: Model 31% vs market 32% for 50+ runs; form 44.7 runs/inn recency-weighted ODI (n_eff 25.0; last 5: 9, 9, 167, 105, 29), bats in 98% of games played; vs Australia: 8 inns avg 61.0. Notes: 4 market source(s) for fair price; model 0.308 vs market 0.315; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **New Zealand vs India / Batsman Runs - Nicholls, Henry / Henry Nicholls under 24.5** - why: Model 64% vs market 50% for under 24.5 runs; form 22.1 runs/inn recency-weighted ODI (n_eff 18.6; last 5: 11, 9, 10, 0, 24), bats in 92% of games played; venue unknown/unmatched (venue terms neutral); vs India: 20 inns avg 27.4. Notes: 2 market source(s) for fair price; model 0.642 vs market 0.500; format guessed (ODI via last-meeting); assumes bet void if player doesn't bat/bowl - check book rules
- **Hobart Hurricanes (Women) vs Perth Scorchers (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 58% vs market 44% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 80.7; last 5: 1, 4, 8, 1, 9), bats in 97% of games played; at Allan Border Field, Brisbane: 20 inns avg 3.4; context adj: venue environment +9%, at this venue -4%, team H2H context +1%; weather: cloud cover 97%. Notes: 1 market source(s) for fair price; model 0.583 vs market 0.443; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-17 13:40 IST Adelaide Strikers (Women) vs Sydney Sixers (Women) / G9181 batter_sixes / Maia Bouchier over 0.5 @ 6.00 (feedi_d): edge 32.8%, model 0.2988, market 0.1579

Unmatched team names (add to mappings/teams.csv): AL Barkat (male), Elite Cricket Academy (male), Mashonaland Eagles (male), Mountaineers (male), Pak Xi (male), Royal Champs (male), Speedworld Security Solutions (male)

Runtime 209.0s. Snapshot: `odds_20261117T044317Z.jsonl.gz`
