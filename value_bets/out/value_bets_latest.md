# Cricket value bets - 2026-11-16 15:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 397 prices
- **feedg**: ok, 16 prices, 2 events
- **feedk**: ok, 124 prices, 5 events
- **feede**: ok, 284 prices, 10 events
- **feedf**: ok, 234 prices, 9 events
- **feedi**: ok, 1118 prices, 34 events
- **feedh**: ok, 806 prices, 31 events

Matches starting in next 168h: **17**, markets priced: **234**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-18 09:00 IST | Australia vs England | To score 50 - Ben Duckett | Ben Duckett 50+ yes | 3.40 @ feedi_d | 3.18 | 0.308 | 6.9% | 0.71% | medium |
| 11-18 09:00 IST | Australia vs England | To score a Half-Century | Cooper Connolly 50+ no | 1.39 @ feedk_leoal | 1.31 | 0.8348 | 6.3% | 2.00% | medium |
| 11-19 10:10 IST | Hobart Hurricanes (Women) vs Perth Scorchers (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.10 @ feedi_d | 1.98 | 0.5826 | 6.2% | 1.40% | low |

### Why / notes per bet
- **Australia vs England / To score 50 - Ben Duckett / Ben Duckett 50+ yes** - why: Model 31% vs market 32% for 50+ runs; form 44.7 runs/inn recency-weighted ODI (n_eff 25.0; last 5: 9, 9, 167, 105, 29), bats in 98% of games played; vs Australia: 8 inns avg 61.0. Notes: 3 market source(s) for fair price; model 0.308 vs market 0.319; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Australia vs England / To score a Half-Century / Cooper Connolly 50+ no** - why: Model 83% vs market 71% for 50+ runs; form 31.3 runs/inn recency-weighted ODI (n_eff 16.1; last 5: 0, 27, 23, 10, 38), bats in 88% of games played; vs England: 2 inns avg 13.5. Notes: 3 market source(s) for fair price; model 0.835 vs market 0.708; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Hobart Hurricanes (Women) vs Perth Scorchers (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 58% vs market 44% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 80.8; last 5: 1, 4, 8, 1, 9), bats in 97% of games played; at Allan Border Field, Brisbane: 20 inns avg 3.4; context adj: venue environment +9%, at this venue -4%, team H2H context +1%. Notes: 1 market source(s) for fair price; model 0.583 vs market 0.443; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-17 13:40 IST Adelaide Strikers (Women) vs Sydney Sixers (Women) / G9181 batter_sixes / Maia Bouchier over 0.5 @ 6.00 (feedi_d): edge 32.8%, model 0.2988, market 0.1579

Unmatched team names (add to mappings/teams.csv): Andhra (W) (female), Baroda (W) (female), Royal Champs (male)

Runtime 101.8s. Snapshot: `odds_20261116T093037Z.jsonl.gz`
