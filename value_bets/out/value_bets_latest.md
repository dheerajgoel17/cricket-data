# Cricket value bets - 2026-11-21 18:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1880 prices
- **smarkets**: ok, 466 prices
- **feedl**: ok, 576 prices, 26 events
- **feedk**: ok, 159 prices, 6 events
- **feedg**: ok, 30 prices, 4 events
- **feede**: ok, 802 prices, 32 events
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedh**: ok, 1578 prices, 75 events
- **feedj**: ok, 1037 prices, 19 events
- **feedf**: ok, 852 prices, 27 events

Matches starting in next 168h: **44**, markets priced: **528**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-22 13:40 IST | Melbourne Stars vs Melbourne Renegades | M13710 batter_fours | Hayley Matthews over 2.5 | 1.98 @ feedj_d | 1.86 | 0.5365 | 6.2% | 1.59% | medium |
| 11-23 13:30 IST | South Africa vs Bangladesh | Bowler Milestones | Mehidy Hasan Miraz 5+ yes | 4.00 @ moviodds_bet365 | 3.47 | 0.3275 | 15.2% | 1.27% | low |

### Why / notes per bet
- **Melbourne Stars vs Melbourne Renegades / M13710 batter_fours / Hayley Matthews over 2.5** - why: Model 54% vs market 54% for over 2.5 fours; form 3.7 fours/inn recency-weighted T20 (n_eff 82.4; last 5: 3, 0, 0, 10, 8), bats in 99% of games played; at Junction Oval, Melbourne: 17 inns avg 3.4; context adj: venue environment +11%, team H2H context +5%; weather: rain chance up to 57%, high humidity 81%. Notes: 2 market source(s) for fair price; model 0.536 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules; RAIN RISK: up to 57% rain chance, 1.4 mm forecast during the match - shortened match or void props possible
- **South Africa vs Bangladesh / Bowler Milestones / Mehidy Hasan Miraz 5+ yes** - why: Model 33% vs market 26% for 5+ wkts; form 3.5 wkts/spell recency-weighted MULTI (n_eff 16.3; last 5: 3, 4, 2, 4, 1), bowls in 94% of games, 36.7 overs/spell; vs South Africa: 6 spells avg 2.3; context adj: opposition strength -1%, venue environment +6%; weather: rain chance up to 69%, cloud cover 70%. Notes: 1 market source(s) for fair price; model 0.327 vs market 0.256; milestone: assumes loses if player doesn't bat/bowl (void if not in XI); market fair anchored on moviodds_bet365 O/U 3.5 (de-vigged 0.392); price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 69% rain chance, 14.7 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-21 20:00 IST Desert Vipers vs MI Emirates / Batter Milestones / F Zaman 50+ yes @ 6.50 (moviodds_bet365): edge 31.1%, model 0.1741, market 0.2242
- 11-21 20:00 IST Desert Vipers vs MI Emirates / Batsman to Score a Fifty in the Match / F Zaman 50+ yes @ 6.50 (moviodds_bet365): edge 31.7%, model 0.1741, market 0.2259
- 11-22 10:10 IST Brisbane Heat vs Adelaide Strikers / M13711 batter_sixes / Orla Prendergast over 0.5 @ 5.60 (feedj_d): edge 51.1%, model 0.294, market 0.25
- 11-22 10:10 IST Brisbane Heat (W) vs Adelaide Strikers (W) / Batsman Total Match Sixes / ME Bouchier over 0.5 @ 5.50 (moviodds_bet365): edge 53.8%, model 0.2838, market 0.2763
- 11-23 13:30 IST South Africa vs Bangladesh / Top Bowler - Bangladesh / Taijul Islam @ 5.30 (feedh_d): edge 60.8%, model 0.3731, market 0.2659

Unmatched team names (add to mappings/teams.csv): Dolphins (W) (female), Garden Route Badgers (W) (female), Lions (W) (female), MID West Rhinos (male), Venice Livewire (male), Western Province (W) (female)

Runtime 209.4s. Snapshot: `odds_20261121T123043Z.jsonl.gz`
