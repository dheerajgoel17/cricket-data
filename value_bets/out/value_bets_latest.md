# Cricket value bets - 2026-11-12 07:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1734 prices
- **feedk**: error - HTTPError: HTTP Error 410: Gone
- **smarkets**: ok, 446 prices
- **feedg**: ok, 40 prices, 5 events
- **feede**: ok, 538 prices, 17 events
- **feedh**: ok, 1182 prices, 33 events
- **feedf**: ok, 422 prices, 17 events

Matches starting in next 168h: **30**, markets priced: **414**, value bets: **1** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-13 09:00 IST | Australia vs England | Joe Root To Score 50 | Joe Root 50+ no | 1.50 @ feede_lb | 1.43 | 0.7187 | 5.2% | 2.00% | medium |

### Why / notes per bet
- **Australia vs England / Joe Root To Score 50 / Joe Root 50+ no** - why: Model 72% vs market 69% for 50+ runs; form 47.8 runs/inn recency-weighted ODI (n_eff 23.7; last 5: 5, 69, 33, 18, 15), bats in 93% of games played; venue unknown/unmatched (venue terms neutral); vs Australia: 18 inns avg 29.1; weather: cloud cover 100%. Notes: 2 market source(s) for fair price; model 0.719 vs market 0.688; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-13 07:30 IST New Zealand vs India / Batter Milestones / RG Sharma 100+ yes @ 10.00 (moviodds_bet365): edge 42.7%, model 0.1278, market 0.1549
- 11-13 07:30 IST New Zealand vs India / Batsman to score a Hundred in the match / RG Sharma 100+ yes @ 10.00 (moviodds_bet365): edge 41.1%, model 0.1278, market 0.1519

Unmatched team names (add to mappings/teams.csv): AL Barkat (male), Bangla Tigers (male), Elite Cricket Academy (male), Knight Fighters 11 (male), Lokseva Academy (male), Omr Checker (male), USA (W) (female)

Runtime 219.5s. Snapshot: `odds_20261112T013034Z.jsonl.gz`
