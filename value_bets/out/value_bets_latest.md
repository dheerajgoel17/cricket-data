# Cricket value bets - 2026-11-16 17:26 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 300 prices
- **feedk**: ok, 124 prices, 5 events
- **feede**: ok, 172 prices, 6 events
- **feedg**: ok, 16 prices, 3 events
- **feedf**: ok, 122 prices, 5 events
- **feedi**: ok, 979 prices, 35 events
- **feedh**: ok, 659 prices, 27 events

Matches starting in next 168h: **12**, markets priced: **191**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-18 09:00 IST | Australia vs England | To score a Half-Century | Cooper Connolly 50+ no | 1.39 @ feedk_leoal | 1.31 | 0.8348 | 5.8% | 2.00% | medium |
| 11-19 03:30 IST | New Zealand vs India | Batsman Runs - Rahul, KL | KL Rahul under 29.5 | 1.87 @ feedh_d | 1.78 | 0.6374 | 5.1% | 1.45% | medium |

### Why / notes per bet
- **Australia vs England / To score a Half-Century / Cooper Connolly 50+ no** - why: Model 83% vs market 70% for 50+ runs; form 31.3 runs/inn recency-weighted ODI (n_eff 16.1; last 5: 0, 27, 23, 10, 38), bats in 88% of games played; vs England: 2 inns avg 13.5. Notes: 3 market source(s) for fair price; model 0.835 vs market 0.701; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **New Zealand vs India / Batsman Runs - Rahul, KL / KL Rahul under 29.5** - why: Model 64% vs market 50% for under 29.5 runs; form 36.8 runs/inn recency-weighted ODI (n_eff 22.2; last 5: 26, 3, 129, 12, 1), bats in 82% of games played; venue unknown/unmatched (venue terms neutral); vs New Zealand: 13 inns avg 38.4. Notes: 2 market source(s) for fair price; model 0.637 vs market 0.500; format guessed (ODI via last-meeting); assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-17 13:40 IST Adelaide Strikers (Women) vs Sydney Sixers (Women) / G9181 batter_sixes / Maia Bouchier over 0.5 @ 6.00 (feedi_d): edge 32.8%, model 0.2988, market 0.1579

Unmatched team names (add to mappings/teams.csv): Andhra (W) (female), Royal Champs (male)

Runtime 99.8s. Snapshot: `odds_20261116T115606Z.jsonl.gz`
