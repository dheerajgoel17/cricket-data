# Cricket value bets - 2026-11-18 12:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 323 prices
- **feedg**: ok, 0 prices, 1 events
- **feedk**: ok, 157 prices, 7 events
- **feede**: ok, 338 prices, 21 events
- **feedj**: ok, 454 prices, 9 events
- **feedh**: ok, 926 prices, 69 events
- **feedf**: ok, 264 prices, 18 events
- **feedi**: ok, 1491 prices, 43 events

Matches starting in next 168h: **34**, markets priced: **304**, value bets: **4** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-19 10:10 IST | Hobart Hurricanes (Women) vs Perth Scorchers (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.10 @ feedi_d | 1.94 | 0.5826 | 8.1% | 1.83% | medium |
| 11-19 10:10 IST | Hobart Hurricanes (Women) vs Perth Scorchers (Women) | G9182 batter_fours | Freya Kemp under 1.5 | 1.91 @ feedi_d | 1.78 | 0.5645 | 7.1% | 1.95% | medium |
| 11-20 13:40 IST | Adelaide Strikers (Women) vs Melbourne Renegades (Women) | G9182 batter_fours | Laura Wolvaardt under 2.5 | 2.20 @ feedi_d | 2.07 | 0.5554 | 6.2% | 1.29% | low |
| 11-20 13:41 IST | Adelaide Strikers vs Melbourne Renegades | Hayley Matthews To Score 50 | Hayley Matthews 50+ yes | 5.00 @ feede_lb | 4.46 | 0.2082 | 12.2% | 0.77% | medium |

### Why / notes per bet
- **Hobart Hurricanes (Women) vs Perth Scorchers (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 58% vs market 46% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 80.6; last 5: 1, 4, 8, 1, 9), bats in 97% of games played; at Allan Border Field, Brisbane: 20 inns avg 3.4; context adj: venue environment +9%, at this venue -4%, team H2H context +1%; weather: cloud cover 98%. Notes: 2 market source(s) for fair price; model 0.583 vs market 0.459; assumes bet void if player doesn't bat/bowl - check book rules
- **Hobart Hurricanes (Women) vs Perth Scorchers (Women) / G9182 batter_fours / Freya Kemp under 1.5** - why: Model 56% vs market 56% for under 1.5 fours; form 1.6 fours/inn recency-weighted T20 (n_eff 53.2; last 5: 0, 2, 0, 2, 2), bats in 87% of games played; at Allan Border Field, Brisbane: 1 inns avg 0.0; context adj: venue environment +9%, at this venue -4%, team H2H context +1%; weather: cloud cover 98%. Notes: 2 market source(s) for fair price; model 0.564 vs market 0.558; assumes bet void if player doesn't bat/bowl - check book rules
- **Adelaide Strikers (Women) vs Melbourne Renegades (Women) / G9182 batter_fours / Laura Wolvaardt under 2.5** - why: Model 56% vs market 42% for under 2.5 fours; form 3.7 fours/inn recency-weighted T20 (n_eff 87.6; last 5: 4, 7, 2, 0, 9), bats in 98% of games played; at Adelaide Oval, Adelaide: 11 inns avg 1.5; vs Melbourne Renegades Women: 1 inns avg 0.0; context adj: venue environment +5%, at this venue -13%, team H2H context -2%; weather: high humidity 82%. Notes: 1 market source(s) for fair price; model 0.555 vs market 0.423; assumes bet void if player doesn't bat/bowl - check book rules
- **Adelaide Strikers vs Melbourne Renegades / Hayley Matthews To Score 50 / Hayley Matthews 50+ yes** - why: Model 21% vs market 24% for 50+ runs; form 27.3 runs/inn recency-weighted T20 (n_eff 81.7; last 5: 3, 1, 49, 59, 7), bats in 99% of games played; vs Adelaide Strikers Women: 1 inns avg 49.0; context adj: team H2H context +8%; weather: high humidity 82%. Notes: 4 market source(s) for fair price; model 0.208 vs market 0.238; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

Unmatched team names (add to mappings/teams.csv): AL Barkat (male), Baroda (W) (female), Baroda (Women) (female), Central (male), Karnataka (W) (female), Maharashtra (W) (female), Maharashtra (Women) (female), Omr Checker (male), Pak Xi (male), Sunny 11 Pratishtan (male), Vidarbha (W) (female), Vidarbha (Women) (female)

Runtime 225.7s. Snapshot: `odds_20261118T063037Z.jsonl.gz`
