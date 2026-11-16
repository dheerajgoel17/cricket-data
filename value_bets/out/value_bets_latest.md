# Cricket value bets - 2026-11-16 12:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **feedk**: error - HTTPError: HTTP Error 410: Gone
- **smarkets**: ok, 591 prices
- **feedg**: ok, 16 prices, 2 events
- **feede**: ok, 428 prices, 15 events
- **feedh**: ok, 1059 prices, 41 events
- **feedf**: ok, 438 prices, 16 events
- **feedi**: ok, 1546 prices, 36 events

Matches starting in next 168h: **31**, markets priced: **352**, value bets: **1** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-19 10:10 IST | Hobart Hurricanes (Women) vs Perth Scorchers (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.10 @ feedi_d | 1.98 | 0.5826 | 6.2% | 1.40% | low |

### Why / notes per bet
- **Hobart Hurricanes (Women) vs Perth Scorchers (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 58% vs market 44% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 80.8; last 5: 1, 4, 8, 1, 9), bats in 97% of games played; at Allan Border Field, Brisbane: 20 inns avg 3.4; context adj: venue environment +9%, at this venue -4%, team H2H context +1%. Notes: 1 market source(s) for fair price; model 0.583 vs market 0.443; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-17 13:40 IST Adelaide Strikers (Women) vs Sydney Sixers (Women) / G9181 batter_sixes / Maia Bouchier over 0.5 @ 6.00 (feedi_d): edge 32.8%, model 0.2988, market 0.1579

Unmatched team names (add to mappings/teams.csv): Andhra (W) (female), Andhra (Women) (female), Bangla Tigers (male), Baroda (W) (female), Karnataka (W) (female), Maharashtra (W) (female), Nhlangano Legends (male), Pondicherry (male), Railways (W) (female), Royal Champs (male), Vidarbha (W) (female)

Runtime 120.1s. Snapshot: `odds_20261116T063036Z.jsonl.gz`
