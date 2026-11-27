# Cricket value bets - 2026-11-27 08:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1681 prices
- **smarkets**: ok, 359 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feedk**: ok, 156 prices, 4 events
- **feedl**: ok, 322 prices, 20 events
- **feede**: ok, 260 prices, 12 events
- **feedf**: ok, 298 prices, 7 events
- **feedj**: ok, 636 prices, 12 events
- **feedh**: ok, 1119 prices, 61 events

Matches starting in next 168h: **39**, markets priced: **423**, value bets: **4** (new alerts: 3). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-27 13:45 IST | Australia vs England | Batter Total Match Fours | J Fraser-McGurk over 1.5 | 2.62 @ moviodds_bet365 | 2.19 | 0.4035 | 19.9% | 2.00% | medium |
| 11-27 13:45 IST | Australia vs England | Batter Total Match Fours | SB Harper under 1.5 | 2.25 @ moviodds_bet365 | 2.10 | 0.4944 | 6.9% | 1.37% | medium |
| 11-27 15:40 IST | Perth Scorchers (W) vs Hobart Hurricanes (W) | Batter Total Match Fours | BL Mooney under 3.5 | 2.10 @ moviodds_bet365 | 1.91 | 0.6007 | 9.8% | 2.00% | medium |
| 11-28 10:10 IST | Melbourne Renegades vs Melbourne Stars | Tess Flintoff - Over/Under 15.5 Runs | Tess Flintoff under 15.5 | 1.83 @ feede_lb | 1.66 | 0.6835 | 10.2% | 2.00% | medium |

### Why / notes per bet
- **Australia vs England / Batter Total Match Fours / J Fraser-McGurk over 1.5** - why: Model 40% vs market 50% for over 1.5 fours; form 1.5 fours/inn recency-weighted T20 (n_eff 34.4; last 5: 1, 0, 0, 2, 2), bats in 96% of games played; vs England: 3 inns avg 1.7; context adj: team H2H context -3%; weather: high humidity 88%, cloud cover 93%. Notes: 2 market source(s) for fair price; model 0.404 vs market 0.500; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Australia vs England / Batter Total Match Fours / SB Harper under 1.5** - why: Model 49% vs market 46% for under 1.5 fours; form 2.7 fours/inn recency-weighted T20 (n_eff 29.5; last 5: 0, 3, 0, 4, 6), bats in 95% of games played; vs England: 2 inns avg 1.5; context adj: team H2H context -3%; weather: high humidity 88%, cloud cover 93%. Notes: 2 market source(s) for fair price; model 0.494 vs market 0.459; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Perth Scorchers (W) vs Hobart Hurricanes (W) / Batter Total Match Fours / BL Mooney under 3.5** - why: Model 60% vs market 46% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 81.6; last 5: 3, 0, 1, 4, 8), bats in 97% of games played; venue unknown/unmatched (venue terms neutral); context adj: team H2H context +1%. Notes: 2 market source(s) for fair price; model 0.601 vs market 0.459; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Melbourne Renegades vs Melbourne Stars / Tess Flintoff - Over/Under 15.5 Runs / Tess Flintoff under 15.5** - why: Model 68% vs market 54% for under 15.5 runs; form 15.2 runs/inn recency-weighted T20 (n_eff 18.2; last 5: 30, 14, 8, 44, 2), bats in 72% of games played; at Junction Oval, Melbourne: 14 inns avg 14.7; vs Melbourne Stars Women: 1 inns avg 30.0; context adj: team H2H context +4%; weather: rain chance up to 76%. Notes: 2 market source(s) for fair price; model 0.683 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules; RAIN RISK: up to 76% rain chance, 0.1 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-28 10:10 IST Melbourne Renegades (W) vs Melbourne Stars (W) / Team - Top Batter / C Webb @ 13.00 (moviodds_bet365): edge 39.6%, model 0.0863, market 0.1188
- 11-28 10:10 IST Melbourne Renegades vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 66.0%, model 0.0834, market 0.1254

Unmatched team names (add to mappings/teams.csv): Central Hinds (W) (female), Central Hinds (female), Central Hinds (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Elite Cricket Academy (male), Lokseva Academy (male), Majees Titan (male), Muscat Shaheens (W) (female), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), Oca Invincibles (W) (female), Omr Checker (male), Roma Gladiatori (male), Sohar Smashers (W) (female), South Zone (W) (female), South Zone (male), Speedworld Security Solutions (male), Wadi Kabir Royals (W) (female), West Zone (W) (female), West Zone (male)

Runtime 111.0s. Snapshot: `odds_20261127T023043Z.jsonl.gz`
