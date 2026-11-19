# Cricket value bets - 2026-11-19 16:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 478 prices
- **feedg**: ok, 0 prices, 0 events
- **feedk**: ok, 25 prices, 5 events
- **feede**: ok, 392 prices, 16 events
- **feedh**: ok, 874 prices, 46 events
- **feedj**: ok, 699 prices, 15 events
- **feedi**: ok, 1349 prices, 46 events
- **feedf**: ok, 368 prices, 26 events

Matches starting in next 168h: **32**, markets priced: **343**, value bets: **3** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-20 11:30 IST | Pakistan A vs United Arab Emirates | 1st innings - Shahdad, Muhammad to score 50 | Muhammad Shahdad 50+ yes | 4.35 @ feedf_p | 3.93 | 0.2419 | 10.6% | 0.79% | medium |
| 11-20 13:40 IST | Adelaide Strikers vs Melbourne Renegades | Hayley Matthews To Score 50 | Hayley Matthews 50+ yes | 5.00 @ feede_lb | 4.34 | 0.2082 | 15.3% | 0.95% | medium |
| 11-20 13:40 IST | Adelaide Strikers (Women) vs Melbourne Renegades (Women) | G9182 batter_fours | Laura Wolvaardt under 2.5 | 2.20 @ feedi_d | 2.03 | 0.5554 | 8.4% | 1.76% | medium |

### Why / notes per bet
- **Pakistan A vs United Arab Emirates / 1st innings - Shahdad, Muhammad to score 50 / Muhammad Shahdad 50+ yes** - why: Model 24% vs market 26% for 50+ runs; form 37.6 runs/inn recency-weighted ODI (n_eff 14.4; last 5: 0, 14, 21, 0, 79), bats in 96% of games played; venue unknown/unmatched (venue terms neutral). Notes: 2 market source(s) for fair price; model 0.242 vs market 0.264; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Adelaide Strikers vs Melbourne Renegades / Hayley Matthews To Score 50 / Hayley Matthews 50+ yes** - why: Model 21% vs market 25% for 50+ runs; form 27.3 runs/inn recency-weighted T20 (n_eff 81.6; last 5: 3, 1, 49, 59, 7), bats in 99% of games played; vs Adelaide Strikers Women: 1 inns avg 49.0; context adj: team H2H context +8%; weather: high humidity 77%. Notes: 4 market source(s) for fair price; model 0.208 vs market 0.249; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Adelaide Strikers (Women) vs Melbourne Renegades (Women) / G9182 batter_fours / Laura Wolvaardt under 2.5** - why: Model 56% vs market 44% for under 2.5 fours; form 3.7 fours/inn recency-weighted T20 (n_eff 87.5; last 5: 4, 7, 2, 0, 9), bats in 98% of games played; at Adelaide Oval, Adelaide: 11 inns avg 1.5; vs Melbourne Renegades Women: 1 inns avg 0.0; context adj: venue environment +5%, at this venue -13%, team H2H context -2%; weather: high humidity 77%. Notes: 2 market source(s) for fair price; model 0.555 vs market 0.442; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-21 20:00 IST Desert Vipers vs Mi Emirates / Top Batsman - Mi Emirates / Kieron Pollard @ 11.00 (feedh_d): edge 31.1%, model 0.1816, market 0.0856
- 11-20 13:40 IST Adelaide Strikers (Women) vs Melbourne Renegades (Women) / G9181 batter_sixes / Maia Bouchier over 0.5 @ 6.00 (feedi_d): edge 58.6%, model 0.2498, market 0.2763

Unmatched team names (add to mappings/teams.csv): AL Barkat (male), Elite Cricket Academy (male), Karnataka (W) (female), Karnataka (Women) (female), Lokseva Academy (male), Nhlangano Legends (male), Railways (W) (female), Railways (Women) (female), Royal Champs (male)

Runtime 215.0s. Snapshot: `odds_20261119T103036Z.jsonl.gz`
