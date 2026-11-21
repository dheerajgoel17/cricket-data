# Cricket value bets - 2026-11-21 20:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1939 prices
- **smarkets**: ok, 479 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedl**: ok, 514 prices, 28 events
- **feedk**: ok, 159 prices, 6 events
- **feedg**: ok, 32 prices, 4 events
- **feede**: ok, 760 prices, 30 events
- **feedh**: ok, 1418 prices, 73 events
- **feedj**: ok, 762 prices, 16 events
- **feedf**: ok, 806 prices, 26 events

Matches starting in next 168h: **45**, markets priced: **488**, value bets: **1** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-22 13:40 IST | Melbourne Stars vs Melbourne Renegades | M13710 batter_fours | Hayley Matthews over 2.5 | 1.98 @ feedj_d | 1.86 | 0.5365 | 6.2% | 1.59% | medium |

### Why / notes per bet
- **Melbourne Stars vs Melbourne Renegades / M13710 batter_fours / Hayley Matthews over 2.5** - why: Model 54% vs market 54% for over 2.5 fours; form 3.7 fours/inn recency-weighted T20 (n_eff 82.4; last 5: 3, 0, 0, 10, 8), bats in 99% of games played; at Junction Oval, Melbourne: 17 inns avg 3.4; context adj: venue environment +11%, team H2H context +5%; weather: rain chance up to 57%, high humidity 85%. Notes: 2 market source(s) for fair price; model 0.536 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules; RAIN RISK: up to 57% rain chance, 2.2 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-22 10:10 IST Brisbane Heat vs Adelaide Strikers / M13711 batter_sixes / Orla Prendergast over 0.5 @ 5.60 (feedj_d): edge 51.1%, model 0.294, market 0.25
- 11-22 10:10 IST Brisbane Heat (W) vs Adelaide Strikers (W) / Batsman Total Match Sixes / ME Bouchier over 0.5 @ 5.50 (moviodds_bet365): edge 53.8%, model 0.2838, market 0.2763
- 11-23 13:30 IST South Africa vs Bangladesh / Top Bowler - Bangladesh / Taijul Islam @ 5.30 (feedh_d): edge 63.9%, model 0.3896, market 0.2659

Unmatched team names (add to mappings/teams.csv): Garden Route Badgers (W) (female), Lions (W) (female), MID West Rhinos (male), Venice Livewire (male)

Runtime 312.6s. Snapshot: `odds_20261121T143042Z.jsonl.gz`
