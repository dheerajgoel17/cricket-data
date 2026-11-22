# Cricket value bets - 2026-11-22 06:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1852 prices
- **smarkets**: ok, 509 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedk**: ok, 215 prices, 6 events
- **feedl**: ok, 649 prices, 32 events
- **feedg**: ok, 40 prices, 6 events
- **feedh**: ok, 1674 prices, 82 events
- **feede**: ok, 844 prices, 36 events
- **feedj**: ok, 1057 prices, 24 events
- **feedf**: ok, 918 prices, 27 events, stopped time budget

Matches starting in next 168h: **52**, markets priced: **555**, value bets: **1** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-22 20:00 IST | Dubai Capitals vs Abu Dhabi Knight Riders | M13710 batter_fours | Sediqullah Atal under 1.5 | 1.98 @ feedj_d | 1.80 | 0.6202 | 9.7% | 2.00% | medium |

### Why / notes per bet
- **Dubai Capitals vs Abu Dhabi Knight Riders / M13710 batter_fours / Sediqullah Atal under 1.5** - why: Model 62% vs market 50% for under 1.5 fours; form 1.2 fours/inn recency-weighted T20 (n_eff 28.5; last 5: 2, 2, 0, 0, 2), bats in 98% of games played; at Dubai International Cricket Stadium, Dubai: 8 inns avg 1.0; vs Abu Dhabi Knight Riders: 1 inns avg 0.0; context adj: at this venue -3%, team H2H context +10%. Notes: 2 market source(s) for fair price; model 0.620 vs market 0.500; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-22 10:10 IST Brisbane Heat vs Adelaide Strikers / M13711 batter_sixes / Orla Prendergast over 0.5 @ 5.60 (feedj_d): edge 51.1%, model 0.294, market 0.25
- 11-22 10:10 IST Brisbane Heat (W) vs Adelaide Strikers (W) / Batsman Total Match Sixes / ME Bouchier over 0.5 @ 5.50 (moviodds_bet365): edge 53.8%, model 0.2837, market 0.2763

Unmatched team names (add to mappings/teams.csv): Diasqua Little Sai Wan Cricket Club (male), Dolphins (W) (female), Dolphins (female), Garden Route Badgers (W) (female), Garden Route Badgers (female), Lions (W) (female), Lions (female), Lokseva Academy (male), MID West Rhinos (male), Roma Gladiators (male), SW Districts (male), South Western Districts (male), Sunny 11 Pratishtan (male), Western Province (W) (female), Western Province (female)

Runtime 209.3s. Snapshot: `odds_20261122T003046Z.jsonl.gz`
