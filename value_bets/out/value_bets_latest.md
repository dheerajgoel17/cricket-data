# Cricket value bets - 2026-11-21 19:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1879 prices
- **smarkets**: ok, 530 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedk**: ok, 159 prices, 6 events
- **feedl**: ok, 576 prices, 28 events
- **feedg**: ok, 40 prices, 5 events
- **feedj**: error - TimeoutError: The read operation timed out
- **feedh**: ok, 1578 prices, 75 events
- **feede**: ok, 802 prices, 31 events
- **feedf**: ok, 880 prices, 27 events

Matches starting in next 168h: **43**, markets priced: **486**, value bets: **1** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-23 13:30 IST | South Africa vs Bangladesh | Bowler Milestones | Mehidy Hasan Miraz 5+ yes | 4.00 @ moviodds_bet365 | 3.47 | 0.3275 | 15.2% | 1.27% | low |

### Why / notes per bet
- **South Africa vs Bangladesh / Bowler Milestones / Mehidy Hasan Miraz 5+ yes** - why: Model 33% vs market 26% for 5+ wkts; form 3.5 wkts/spell recency-weighted MULTI (n_eff 16.3; last 5: 3, 4, 2, 4, 1), bowls in 94% of games, 36.7 overs/spell; vs South Africa: 6 spells avg 2.3; context adj: opposition strength -1%, venue environment +6%; weather: rain chance up to 69%. Notes: 1 market source(s) for fair price; model 0.327 vs market 0.256; milestone: assumes loses if player doesn't bat/bowl (void if not in XI); market fair anchored on moviodds_bet365 O/U 3.5 (de-vigged 0.392); price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 69% rain chance, 2.3 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-23 13:30 IST South Africa vs Bangladesh / Top Bowler - Bangladesh / Taijul Islam @ 5.30 (feedh_d): edge 60.8%, model 0.3731, market 0.2659

Unmatched team names (add to mappings/teams.csv): Dolphins (W) (female), Garden Route Badgers (W) (female), Lions (W) (female), MID West Rhinos (male), Venice Livewire (male), Western Province (W) (female)

Runtime 184.7s. Snapshot: `odds_20261121T133035Z.jsonl.gz`
