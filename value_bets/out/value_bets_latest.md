# Cricket value bets - 2026-11-20 20:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1546 prices
- **smarkets**: ok, 510 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedk**: ok, 134 prices, 5 events
- **feedl**: ok, 474 prices, 26 events
- **feedg**: ok, 32 prices, 4 events
- **feedf**: ok, 388 prices, 7 events
- **feede**: ok, 510 prices, 25 events
- **feedj**: ok, 631 prices, 8 events
- **feedh**: ok, 1505 prices, 99 events

Matches starting in next 168h: **44**, markets priced: **446**, value bets: **4** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-21 06:30 IST | Hobart Hurricanes vs Sydney Thunder | M13710 batter_fours | Nicola Carey under 2.5 | 1.77 @ feedj_d | 1.64 | 0.6764 | 8.2% | 2.00% | medium |
| 11-23 13:30 IST | South Africa vs Bangladesh | Bowler Milestones | Hasan Mahmud 5+ yes | 4.00 @ moviodds_bet365 | 3.21 | 0.3808 | 24.8% | 2.00% | low |
| 11-23 13:30 IST | South Africa vs Bangladesh | Bowler Milestones | Mehidy Hasan Miraz 5+ yes | 4.00 @ moviodds_bet365 | 3.47 | 0.3275 | 15.2% | 1.27% | low |
| 11-23 13:30 IST | South Africa vs Bangladesh | Bowler Total Match Wickets | Hasan Mahmud over 3.5 | 2.38 @ moviodds_bet365 | 2.21 | 0.5279 | 7.7% | 1.39% | low |

### Why / notes per bet
- **Hobart Hurricanes vs Sydney Thunder / M13710 batter_fours / Nicola Carey under 2.5** - why: Model 68% vs market 56% for under 2.5 fours; form 2.2 fours/inn recency-weighted T20 (n_eff 46.4; last 5: 3, 0, 9, 10, 0), bats in 84% of games played; at Bellerive Oval, Hobart: 26 inns avg 2.0; context adj: venue environment +9%; weather: rain chance up to 100%. Notes: 2 market source(s) for fair price; model 0.676 vs market 0.558; assumes bet void if player doesn't bat/bowl - check book rules; RAIN RISK: up to 100% rain chance, 0.9 mm forecast during the match - shortened match or void props possible
- **South Africa vs Bangladesh / Bowler Milestones / Hasan Mahmud 5+ yes** - why: Model 38% vs market 26% for 5+ wkts; form 4.0 wkts/spell recency-weighted MULTI (n_eff 15.3; last 5: 4, 6, 2, 6, 7), bowls in 94% of games, 27.5 overs/spell; vs South Africa: 3 spells avg 2.3; context adj: opposition strength -1%, venue environment +6%. Notes: 1 market source(s) for fair price; model 0.381 vs market 0.256; milestone: assumes loses if player doesn't bat/bowl (void if not in XI); market fair anchored on moviodds_bet365 O/U 3.5 (de-vigged 0.392); price via unofficial Book A mirror - confirm on Book A before betting
- **South Africa vs Bangladesh / Bowler Milestones / Mehidy Hasan Miraz 5+ yes** - why: Model 33% vs market 26% for 5+ wkts; form 3.5 wkts/spell recency-weighted MULTI (n_eff 16.3; last 5: 3, 4, 2, 4, 1), bowls in 94% of games, 36.7 overs/spell; vs South Africa: 6 spells avg 2.3; context adj: opposition strength -1%, venue environment +6%. Notes: 1 market source(s) for fair price; model 0.328 vs market 0.256; milestone: assumes loses if player doesn't bat/bowl (void if not in XI); market fair anchored on moviodds_bet365 O/U 3.5 (de-vigged 0.392); price via unofficial Book A mirror - confirm on Book A before betting
- **South Africa vs Bangladesh / Bowler Total Match Wickets / Hasan Mahmud over 3.5** - why: Model 53% vs market 39% for over 3.5 wkts; form 4.0 wkts/spell recency-weighted MULTI (n_eff 15.3; last 5: 4, 6, 2, 6, 7), bowls in 94% of games, 27.5 overs/spell; vs South Africa: 3 spells avg 2.3; context adj: opposition strength -1%, venue environment +6%. Notes: 1 market source(s) for fair price; model 0.528 vs market 0.392; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-23 13:30 IST South Africa vs Bangladesh / Top Bowler - Bangladesh / Taijul Islam @ 5.30 (feedh_d): edge 34.9%, model 0.3137, market 0.2227

Unmatched team names (add to mappings/teams.csv): Abbottabad Region (male), Bahawalpur Region (male), Dm Jamali Region (male), Dolphins (W) (female), Dolphins (female), Elite Cricket Academy (male), Faisalabad Region (male), Fata Region (male), Garden Route Badgers (W) (female), Garden Route Badgers (female), Islamabad Region (male), Karachi Region Blues (male), Karachi Whites (male), Lahore Region Blues (male), Lahore Region Whites (male), Larkana Region (male), Lions (W) (female), Lions (female), Multan Region (male), Omr Checker (male), Peshawar Blues (male), Peshawar Region (male), Quetta Region (male), Rawalpindi Region (male), Roma Gladiators (male), Sialkot Blues (male), South Western Districts (male), Western Province (W) (female), Western Province (female)

Runtime 208.8s. Snapshot: `odds_20261120T143041Z.jsonl.gz`
