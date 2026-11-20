# Cricket value bets - 2026-11-20 08:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **feedi**: error - HTTP 403: <!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta http-equiv="Content-Type" content="text/htm
- **smarkets**: ok, 576 prices
- **feedk**: ok, 158 prices, 6 events
- **feedg**: ok, 24 prices, 3 events
- **feede**: ok, 898 prices, 35 events
- **feedh**: ok, 1640 prices, 71 events
- **feedj**: ok, 998 prices, 19 events
- **feedf**: ok, 694 prices, 28 events, stopped time budget

Matches starting in next 168h: **48**, markets priced: **454**, value bets: **3** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-20 11:30 IST | Pakistan A vs United Arab Emirates | 1st innings - Shahdad, Muhammad to score 50 | Muhammad Shahdad 50+ yes | 4.35 @ feedf_p | 4.08 | 0.2419 | 6.7% | 0.50% | medium |
| 11-20 13:40 IST | Adelaide Strikers vs Melbourne Renegades | Hayley Matthews To Score 50 | Hayley Matthews 50+ yes | 5.00 @ feede_lb | 4.34 | 0.2082 | 15.1% | 0.94% | medium |
| 11-21 10:00 IST | Sydney Sixers vs Perth Scorchers | Ellyse Perry - Over/Under 29.5 Runs | Ellyse Perry under 29.5 | 1.83 @ feede_lb | 1.73 | 0.6314 | 6.0% | 1.80% | medium |

### Why / notes per bet
- **Pakistan A vs United Arab Emirates / 1st innings - Shahdad, Muhammad to score 50 / Muhammad Shahdad 50+ yes** - why: Model 24% vs market 25% for 50+ runs; form 37.6 runs/inn recency-weighted ODI (n_eff 14.4; last 5: 0, 14, 21, 0, 79), bats in 96% of games played. Notes: 3 market source(s) for fair price; model 0.242 vs market 0.248; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Adelaide Strikers vs Melbourne Renegades / Hayley Matthews To Score 50 / Hayley Matthews 50+ yes** - why: Model 21% vs market 25% for 50+ runs; form 27.3 runs/inn recency-weighted T20 (n_eff 81.5; last 5: 3, 1, 49, 59, 7), bats in 99% of games played; vs Adelaide Strikers Women: 1 inns avg 49.0; context adj: team H2H context +8%; weather: high humidity 79%. Notes: 3 market source(s) for fair price; model 0.208 vs market 0.248; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)
- **Sydney Sixers vs Perth Scorchers / Ellyse Perry - Over/Under 29.5 Runs / Ellyse Perry under 29.5** - why: Model 63% vs market 54% for under 29.5 runs; form 31.5 runs/inn recency-weighted T20 (n_eff 76.7; last 5: 45, 3, 30, 59, 84), bats in 95% of games played; at North Sydney Oval: 39 inns avg 38.3; weather: rain chance up to 88%. Notes: 2 market source(s) for fair price; model 0.631 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules; RAIN RISK: up to 88% rain chance, 0.0 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-21 20:00 IST Desert Vipers vs Mi Emirates / Top Batsman - Mi Emirates / Kieron Pollard @ 11.00 (feedh_d): edge 33.0%, model 0.1866, market 0.0856
- 11-21 13:45 IST Australia vs England / Top Batsman - England / Will Jacks @ 14.00 (feedh_d): edge 44.9%, model 0.1296, market 0.0894

Unmatched team names (add to mappings/teams.csv): Elite Cricket Academy (male), Karnataka (W) (female), Larkana Region (male), Lokseva Academy (male), Milan Icons (male), Omr Checker (male), Peshawar Region (male), Railways (W) (female), Roma Gladiators (male), Speedworld Security Solutions (male)

Runtime 200.9s. Snapshot: `odds_20261120T023043Z.jsonl.gz`
