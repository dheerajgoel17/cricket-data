# Cricket value bets - 2026-11-16 08:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: error - HTTPError: HTTP Error 401: Unauthorized
- **smarkets**: ok, 713 prices
- **feedg**: ok, 16 prices, 2 events
- **feedi**: error - HTTP 403: <!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title><meta http-equiv="Content-Type" content="text/htm
- **feedk**: ok, 128 prices, 8 events
- **feede**: ok, 630 prices, 24 events
- **feedh**: ok, 1624 prices, 38 events
- **feedf**: ok, 670 prices, 27 events

Matches starting in next 168h: **44**, markets priced: **324**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-16 13:40 IST | Sydney Thunder vs Melbourne Stars | Amy Jones - Over/Under 18.5 Runs | Amy Jones under 18.5 | 1.83 @ feede_lb | 1.72 | 0.6378 | 6.5% | 1.95% | medium |
| 11-18 09:00 IST | Australia vs England | To score a Half-Century | Cooper Connolly 50+ no | 1.39 @ feedk_leoal | 1.32 | 0.8348 | 5.2% | 2.00% | medium |

### Why / notes per bet
- **Sydney Thunder vs Melbourne Stars / Amy Jones - Over/Under 18.5 Runs / Amy Jones under 18.5** - why: Model 64% vs market 54% for under 18.5 runs; form 18.6 runs/inn recency-weighted T20 (n_eff 66.4; last 5: 74, 4, 28, 18, 2), bats in 89% of games played; at Drummoyne Oval, Sydney: 3 inns avg 11.7; context adj: team H2H context -6%; weather: rain chance up to 80%, high humidity 83%. Notes: 2 market source(s) for fair price; model 0.638 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules; RAIN RISK: up to 80% rain chance, 1.0 mm forecast during the match - shortened match or void props possible
- **Australia vs England / To score a Half-Century / Cooper Connolly 50+ no** - why: Model 83% vs market 69% for 50+ runs; form 31.3 runs/inn recency-weighted ODI (n_eff 16.1; last 5: 0, 27, 23, 10, 38), bats in 88% of games played; vs England: 2 inns avg 13.5. Notes: 2 market source(s) for fair price; model 0.835 vs market 0.693; milestone: assumes loses if player doesn't bat/bowl (void if not in XI)

Unmatched team names (add to mappings/teams.csv): Andhra (W) (female), Bangla Tigers (male), Baroda (W) (female), Karnataka (W) (female), Maharashtra (W) (female), Nhlangano Legends (male), Railways (W) (female), Royal Champs (male), Vidarbha (W) (female)

Runtime 178.8s. Snapshot: `odds_20261116T023039Z.jsonl.gz`
