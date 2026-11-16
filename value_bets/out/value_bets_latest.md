# Cricket value bets - 2026-11-16 18:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 253 prices
- **feedk**: ok, 124 prices, 5 events
- **feedg**: ok, 16 prices, 3 events
- **feede**: ok, 172 prices, 7 events
- **feedf**: ok, 122 prices, 5 events
- **feedh**: ok, 683 prices, 28 events
- **feedi**: ok, 1104 prices, 37 events

Matches starting in next 168h: **15**, markets priced: **207**, value bets: **3** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-18 09:00 IST | Australia vs England | To score a Half-Century | Cooper Connolly 50+ no | 1.39 @ feedk_leoal | 1.31 | 0.8348 | 5.8% | 2.00% | medium |
| 11-18 09:00 IST | Australia vs England | G9182 batter_fours | Josh Inglis under 2.5 | 2.10 @ feedi_d | 2.00 | 0.5721 | 5.2% | 1.18% | low |
| 11-19 03:30 IST | New Zealand vs India | Batsman Runs - Rahul, KL | KL Rahul under 29.5 | 1.87 @ feedh_d | 1.78 | 0.6374 | 5.1% | 1.45% | medium |

### Why / notes per bet
- **Australia vs England / To score a Half-Century / Cooper Connolly 50+ no** - why: Model 83% vs market 70% for 50+ runs; form 31.3 runs/inn recency-weighted ODI (n_eff 16.1; last 5: 0, 27, 23, 10, 38), bats in 88% of games played; vs England: 2 inns avg 13.5. Notes: 3 market source(s) for fair price; model 0.835 vs market 0.701; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Australia vs England / G9182 batter_fours / Josh Inglis under 2.5** - why: Model 57% vs market 44% for under 2.5 fours; form 3.1 fours/inn recency-weighted ODI (n_eff 21.3; last 5: 0, 2, 0, 11, 2), bats in 92% of games played; at Bellerive Oval, Hobart: 1 inns avg 2.0; vs England: 6 inns avg 2.0. Notes: 1 market source(s) for fair price; model 0.572 vs market 0.443; assumes bet void if player doesn't bat/bowl - check book rules
- **New Zealand vs India / Batsman Runs - Rahul, KL / KL Rahul under 29.5** - why: Model 64% vs market 50% for under 29.5 runs; form 36.8 runs/inn recency-weighted ODI (n_eff 22.2; last 5: 26, 3, 129, 12, 1), bats in 82% of games played; venue unknown/unmatched (venue terms neutral); vs New Zealand: 13 inns avg 38.4. Notes: 2 market source(s) for fair price; model 0.637 vs market 0.500; format guessed (ODI via last-meeting); assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-17 13:40 IST Adelaide Strikers (Women) vs Sydney Sixers (Women) / G9181 batter_sixes / Maia Bouchier over 0.5 @ 6.00 (feedi_d): edge 32.8%, model 0.2988, market 0.1579

Unmatched team names (add to mappings/teams.csv): Andhra (W) (female), Lahore Region Whites (male), Mashonaland Eagles (male), Mountaineers (male), Peshawar Blues (male), Royal Champs (male)

Runtime 123.0s. Snapshot: `odds_20261116T123039Z.jsonl.gz`
