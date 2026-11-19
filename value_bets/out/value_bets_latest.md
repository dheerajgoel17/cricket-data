# Cricket value bets - 2026-11-19 21:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 465 prices
- **feedg**: ok, 8 prices, 1 events
- **feedk**: ok, 116 prices, 5 events
- **feedi**: error - HTTP 403: <!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta http-equiv="Content-Type" content="text/htm
- **feede**: ok, 696 prices, 27 events
- **feedh**: ok, 1330 prices, 59 events
- **feedj**: ok, 851 prices, 19 events
- **feedf**: ok, 580 prices, 26 events

Matches starting in next 168h: **43**, markets priced: **349**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-20 11:30 IST | Pakistan A vs United Arab Emirates | 1st innings - Shahdad, Muhammad to score 50 | Muhammad Shahdad 50+ yes | 4.35 @ feedf_p | 3.83 | 0.2419 | 13.5% | 1.01% | medium |
| 11-20 13:40 IST | Adelaide Strikers vs Melbourne Renegades | Hayley Matthews To Score 50 | Hayley Matthews 50+ yes | 5.00 @ feede_lb | 4.34 | 0.2082 | 15.1% | 0.94% | medium |

### Why / notes per bet
- **Pakistan A vs United Arab Emirates / 1st innings - Shahdad, Muhammad to score 50 / Muhammad Shahdad 50+ yes** - why: Model 24% vs market 28% for 50+ runs; form 37.6 runs/inn recency-weighted ODI (n_eff 14.4; last 5: 0, 14, 21, 0, 79), bats in 96% of games played. Notes: 2 market source(s) for fair price; model 0.242 vs market 0.276; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Adelaide Strikers vs Melbourne Renegades / Hayley Matthews To Score 50 / Hayley Matthews 50+ yes** - why: Model 21% vs market 25% for 50+ runs; form 27.3 runs/inn recency-weighted T20 (n_eff 81.6; last 5: 3, 1, 49, 59, 7), bats in 99% of games played; vs Adelaide Strikers Women: 1 inns avg 49.0; context adj: team H2H context +8%; weather: high humidity 84%. Notes: 3 market source(s) for fair price; model 0.208 vs market 0.248; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-20 11:30 IST Pakistan A vs United Arab Emirates / 1st innings - Sharma, Aryansh to score 50 / Aryansh Sharma 50+ yes @ 6.50 (feedf_p): edge 32.2%, model 0.1633, market 0.2361

Unmatched team names (add to mappings/teams.csv): Elite Cricket Academy (male), Karnataka (W) (female), Lokseva Academy (male), Omr Checker (male), Railways (W) (female), Royal Champs (male), Speedworld Security Solutions (male)

Runtime 302.9s. Snapshot: `odds_20261119T153047Z.jsonl.gz`
