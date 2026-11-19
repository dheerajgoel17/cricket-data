# Cricket value bets - 2026-11-20 02:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **feedi**: error - HTTP 403: <!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta http-equiv="Content-Type" content="text/htm
- **smarkets**: ok, 568 prices
- **feedk**: ok, 116 prices, 5 events
- **feedg**: ok, 24 prices, 3 events
- **feede**: ok, 926 prices, 34 events
- **feedh**: ok, 1672 prices, 68 events
- **feedj**: ok, 956 prices, 21 events
- **feedf**: ok, 580 prices, 27 events

Matches starting in next 168h: **48**, markets priced: **405**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-20 11:30 IST | Pakistan A vs United Arab Emirates | 1st innings - Shahdad, Muhammad to score 50 | Muhammad Shahdad 50+ yes | 4.35 @ feedf_p | 4.08 | 0.2419 | 6.7% | 0.50% | medium |
| 11-20 13:40 IST | Adelaide Strikers vs Melbourne Renegades | Hayley Matthews To Score 50 | Hayley Matthews 50+ yes | 5.00 @ feede_lb | 4.34 | 0.2082 | 15.1% | 0.94% | medium |

### Why / notes per bet
- **Pakistan A vs United Arab Emirates / 1st innings - Shahdad, Muhammad to score 50 / Muhammad Shahdad 50+ yes** - why: Model 24% vs market 25% for 50+ runs; form 37.6 runs/inn recency-weighted ODI (n_eff 14.4; last 5: 0, 14, 21, 0, 79), bats in 96% of games played. Notes: 3 market source(s) for fair price; model 0.242 vs market 0.248; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Adelaide Strikers vs Melbourne Renegades / Hayley Matthews To Score 50 / Hayley Matthews 50+ yes** - why: Model 21% vs market 25% for 50+ runs; form 27.3 runs/inn recency-weighted T20 (n_eff 81.6; last 5: 3, 1, 49, 59, 7), bats in 99% of games played; vs Adelaide Strikers Women: 1 inns avg 49.0; context adj: team H2H context +8%; weather: high humidity 77%. Notes: 3 market source(s) for fair price; model 0.208 vs market 0.248; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-21 20:00 IST Desert Vipers vs Mi Emirates / Top Batsman - Mi Emirates / Kieron Pollard @ 11.00 (feedh_d): edge 33.0%, model 0.1866, market 0.0856

Unmatched team names (add to mappings/teams.csv): Elite Cricket Academy (male), Karnataka (W) (female), Larkana Region (male), Lokseva Academy (male), Omr Checker (male), Peshawar Region (male), Railways (W) (female), Speedworld Security Solutions (male)

Runtime 263.3s. Snapshot: `odds_20261119T203039Z.jsonl.gz`
