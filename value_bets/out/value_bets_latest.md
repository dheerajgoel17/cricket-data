# Cricket value bets - 2026-11-19 10:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 481 prices
- **feedg**: ok, 12 prices, 2 events
- **feedk**: ok, 97 prices, 7 events
- **feedi**: error - HTTP 403: <!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta http-equiv="Content-Type" content="text/htm
- **feede**: ok, 362 prices, 19 events
- **feedj**: ok, 537 prices, 11 events
- **feedh**: ok, 1397 prices, 65 events
- **feedf**: ok, 412 prices, 28 events

Matches starting in next 168h: **35**, markets priced: **341**, value bets: **2** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-19 10:10 IST | Hobart Hurricanes vs Perth Scorchers | Beth Mooney - Over/Under 30.5 Runs | Beth Mooney under 30.5 | 1.83 @ feede_lb | 1.74 | 0.6241 | 5.4% | 1.61% | medium |
| 11-20 13:40 IST | Adelaide Strikers vs Melbourne Renegades | Hayley Matthews To Score 50 | Hayley Matthews 50+ yes | 5.00 @ feede_lb | 4.34 | 0.2082 | 15.1% | 0.94% | medium |

### Why / notes per bet
- **Hobart Hurricanes vs Perth Scorchers / Beth Mooney - Over/Under 30.5 Runs / Beth Mooney under 30.5** - why: Model 62% vs market 54% for under 30.5 runs; form 32.6 runs/inn recency-weighted T20 (n_eff 80.5; last 5: 7, 28, 80, 17, 58), bats in 97% of games played; at Allan Border Field, Brisbane: 20 inns avg 31.4; context adj: team H2H context +1%; weather: cloud cover 98%. Notes: 2 market source(s) for fair price; model 0.624 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules
- **Adelaide Strikers vs Melbourne Renegades / Hayley Matthews To Score 50 / Hayley Matthews 50+ yes** - why: Model 21% vs market 25% for 50+ runs; form 27.3 runs/inn recency-weighted T20 (n_eff 81.6; last 5: 3, 1, 49, 59, 7), bats in 99% of games played; vs Adelaide Strikers Women: 1 inns avg 49.0; context adj: team H2H context +8%; weather: high humidity 79%. Notes: 3 market source(s) for fair price; model 0.208 vs market 0.248; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-21 20:00 IST Desert Vipers vs Mi Emirates / Top Batsman - Mi Emirates / Kieron Pollard @ 11.00 (feedh_d): edge 31.7%, model 0.1832, market 0.0856

Unmatched team names (add to mappings/teams.csv): AL Barkat (male), Bangla Tigers (male), Elite Cricket Academy (male), Karnataka (W) (female), Lokseva Academy (male), Nhlangano Legends (male), Omr Checker (male), Pak Xi (male), Railways (W) (female), Royal Champs (male), Sunny 11 Pratishtan (male)

Runtime 225.4s. Snapshot: `odds_20261119T043035Z.jsonl.gz`
