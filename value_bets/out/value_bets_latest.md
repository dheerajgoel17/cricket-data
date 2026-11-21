# Cricket value bets - 2026-11-21 16:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1856 prices
- **feedj**: skipped - Feed J listing HTTP 503
- **smarkets**: ok, 523 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedl**: ok, 557 prices, 26 events
- **feedk**: ok, 159 prices, 6 events
- **feedg**: ok, 24 prices, 3 events
- **feedh**: ok, 1562 prices, 76 events
- **feede**: ok, 830 prices, 33 events
- **feedf**: ok, 762 prices, 26 events, stopped time budget

Matches starting in next 168h: **43**, markets priced: **494**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-23 13:30 IST | South Africa vs Bangladesh | Bowler Milestones | Hasan Mahmud 5+ yes | 4.00 @ moviodds_bet365 | 3.21 | 0.3807 | 24.8% | 2.00% | low |
| 11-23 13:30 IST | South Africa vs Bangladesh | Bowler Milestones | Mehidy Hasan Miraz 5+ yes | 4.00 @ moviodds_bet365 | 3.47 | 0.3275 | 15.2% | 1.27% | low |
| 11-23 13:30 IST | South Africa vs Bangladesh | Bowler Total Match Wickets | Hasan Mahmud over 3.5 | 2.38 @ moviodds_bet365 | 2.21 | 0.5279 | 7.7% | 1.39% | low |

### Why / notes per bet
- **South Africa vs Bangladesh / Bowler Milestones / Hasan Mahmud 5+ yes** - why: Model 38% vs market 26% for 5+ wkts; form 4.0 wkts/spell recency-weighted MULTI (n_eff 15.3; last 5: 4, 6, 2, 6, 7), bowls in 94% of games, 27.5 overs/spell; vs South Africa: 3 spells avg 2.3; context adj: opposition strength -1%, venue environment +6%; weather: rain chance up to 80%, cloud cover 70%. Notes: 1 market source(s) for fair price; model 0.381 vs market 0.256; milestone: assumes loses if player doesn't bat/bowl (void if not in XI); market fair anchored on moviodds_bet365 O/U 3.5 (de-vigged 0.392); price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 80% rain chance, 14.7 mm forecast during the match - shortened match or void props possible
- **South Africa vs Bangladesh / Bowler Milestones / Mehidy Hasan Miraz 5+ yes** - why: Model 33% vs market 26% for 5+ wkts; form 3.5 wkts/spell recency-weighted MULTI (n_eff 16.3; last 5: 3, 4, 2, 4, 1), bowls in 94% of games, 36.7 overs/spell; vs South Africa: 6 spells avg 2.3; context adj: opposition strength -1%, venue environment +6%; weather: rain chance up to 80%, cloud cover 70%. Notes: 1 market source(s) for fair price; model 0.327 vs market 0.256; milestone: assumes loses if player doesn't bat/bowl (void if not in XI); market fair anchored on moviodds_bet365 O/U 3.5 (de-vigged 0.392); price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 80% rain chance, 14.7 mm forecast during the match - shortened match or void props possible
- **South Africa vs Bangladesh / Bowler Total Match Wickets / Hasan Mahmud over 3.5** - why: Model 53% vs market 39% for over 3.5 wkts; form 4.0 wkts/spell recency-weighted MULTI (n_eff 15.3; last 5: 4, 6, 2, 6, 7), bowls in 94% of games, 27.5 overs/spell; vs South Africa: 3 spells avg 2.3; context adj: opposition strength -1%, venue environment +6%; weather: rain chance up to 80%, cloud cover 70%. Notes: 1 market source(s) for fair price; model 0.528 vs market 0.392; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 80% rain chance, 14.7 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-23 13:30 IST South Africa vs Bangladesh / Top Bowler - Bangladesh / Taijul Islam @ 5.30 (feedh_d): edge 60.8%, model 0.3731, market 0.2659

Unmatched team names (add to mappings/teams.csv): Dolphins (W) (female), Elite Cricket Academy (male), Garden Route Badgers (W) (female), Lions (W) (female), Omr Checker (male), Venice Livewire (male), Western Province (W) (female)

Runtime 314.4s. Snapshot: `odds_20261121T103036Z.jsonl.gz`
