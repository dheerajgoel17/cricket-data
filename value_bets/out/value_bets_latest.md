# Cricket value bets - 2026-11-18 10:09 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 336 prices
- **feedg**: ok, 0 prices, 1 events
- **feedk**: ok, 157 prices, 7 events
- **feede**: ok, 420 prices, 27 events
- **feedh**: ok, 984 prices, 60 events
- **feedj**: ok, 672 prices, 15 events
- **feedf**: ok, 346 prices, 22 events
- **feedi**: ok, 1695 prices, 57 events

Matches starting in next 168h: **44**, markets priced: **329**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-19 10:10 IST | Hobart Hurricanes (Women) vs Perth Scorchers (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.05 @ feedi_d | 1.94 | 0.5826 | 5.5% | 1.31% | medium |
| 11-19 13:40 IST | Brisbane Heat (Women) vs Sydney Thunder (Women) | G9181 batter_sixes | Grace Harris under 0.5 | 1.83 @ feedi_d | 1.68 | 0.6173 | 9.1% | 2.00% | medium |
| 11-20 13:41 IST | Adelaide Strikers vs Melbourne Renegades | Hayley Matthews To Score 50 | Hayley Matthews 50+ yes | 5.00 @ feede_lb | 4.46 | 0.2082 | 12.2% | 0.77% | medium |

### Why / notes per bet
- **Hobart Hurricanes (Women) vs Perth Scorchers (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 58% vs market 46% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 80.6; last 5: 1, 4, 8, 1, 9), bats in 97% of games played; at Allan Border Field, Brisbane: 20 inns avg 3.4; context adj: venue environment +9%, at this venue -4%, team H2H context +1%; weather: cloud cover 98%. Notes: 2 market source(s) for fair price; model 0.583 vs market 0.459; assumes bet void if player doesn't bat/bowl - check book rules
- **Brisbane Heat (Women) vs Sydney Thunder (Women) / G9181 batter_sixes / Grace Harris under 0.5** - why: Model 62% vs market 58% for under 0.5 sixes; form 0.7 sixes/inn recency-weighted T20 (n_eff 64.7; last 5: 2, 0, 0, 0, 2), bats in 91% of games played; at Allan Border Field, Brisbane: 23 inns avg 0.4; context adj: venue environment +29%; weather: high humidity 83%, cloud cover 99%. Notes: 2 market source(s) for fair price; model 0.617 vs market 0.578; assumes bet void if player doesn't bat/bowl - check book rules
- **Adelaide Strikers vs Melbourne Renegades / Hayley Matthews To Score 50 / Hayley Matthews 50+ yes** - why: Model 21% vs market 24% for 50+ runs; form 27.3 runs/inn recency-weighted T20 (n_eff 81.7; last 5: 3, 1, 49, 59, 7), bats in 99% of games played; vs Adelaide Strikers Women: 1 inns avg 49.0; context adj: team H2H context +8%; weather: high humidity 82%. Notes: 4 market source(s) for fair price; model 0.208 vs market 0.238; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-19 13:40 IST Brisbane Heat vs Sydney Thunder / M13711 batter_sixes / Orla Prendergast over 0.5 @ 5.60 (feedj_d): edge 30.6%, model 0.2868, market 0.1892

Unmatched team names (add to mappings/teams.csv): AL Barkat (male), Andhra (W) (female), Baroda (W) (female), Baroda (Women) (female), Central (male), Karnataka (W) (female), Maharashtra (W) (female), Maharashtra (Women) (female), Omr Checker (male), Pak Xi (male), Railways (W) (female), Sunny 11 Pratishtan (male), Vidarbha (W) (female), Vidarbha (Women) (female)

Runtime 359.9s. Snapshot: `odds_20261118T043912Z.jsonl.gz`
