# Cricket value bets - 2026-11-27 01:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1617 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 359 prices
- **feedk**: ok, 188 prices, 4 events
- **feedl**: ok, 386 prices, 24 events
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)
- **feede**: ok, 266 prices, 15 events
- **feedf**: ok, 298 prices, 8 events
- **feedj**: ok, 584 prices, 9 events
- **feedh**: ok, 1324 prices, 65 events

Matches starting in next 168h: **43**, markets priced: **446**, value bets: **4** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-27 13:45 IST | Australia vs England | Batsman Total Match Sixes | J Fraser-McGurk under 0.5 | 2.62 @ moviodds_bet365 | 2.26 | 0.4933 | 16.0% | 2.00% | medium |
| 11-27 13:45 IST | Australia vs England | M13710 batter_fours | Mitchell Marsh under 2.5 | 1.87 @ feedj_d | 1.78 | 0.5944 | 5.2% | 1.50% | medium |
| 11-27 15:40 IST | Perth Scorchers (W) vs Hobart Hurricanes (W) | Batter Total Match Fours | BL Mooney under 3.5 | 2.10 @ moviodds_bet365 | 1.91 | 0.6007 | 9.8% | 2.00% | medium |
| 11-27 20:00 IST | Sharjah Warriorz vs Dubai Capitals | Batsman Total Match Sixes | PI Walter under 0.5 | 2.62 @ moviodds_bet365 | 2.41 | 0.4877 | 8.9% | 1.36% | low |

### Why / notes per bet
- **Australia vs England / Batsman Total Match Sixes / J Fraser-McGurk under 0.5** - why: Model 49% vs market 40% for under 0.5 sixes; form 1.3 sixes/inn recency-weighted T20 (n_eff 34.4; last 5: 3, 0, 0, 5, 1), bats in 96% of games played; vs England: 3 inns avg 1.7; context adj: venue environment -3%; weather: rain chance up to 45%, high humidity 89%, cloud cover 96%. Notes: 2 market source(s) for fair price; model 0.493 vs market 0.400; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Australia vs England / M13710 batter_fours / Mitchell Marsh under 2.5** - why: Model 59% vs market 54% for under 2.5 fours; form 3.2 fours/inn recency-weighted T20 (n_eff 62.0; last 5: 0, 3, 1, 5, 5), bats in 96% of games played; vs England: 8 inns avg 1.6; context adj: team H2H context -3%; weather: rain chance up to 45%, high humidity 89%, cloud cover 96%. Notes: 2 market source(s) for fair price; model 0.594 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Perth Scorchers (W) vs Hobart Hurricanes (W) / Batter Total Match Fours / BL Mooney under 3.5** - why: Model 60% vs market 46% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 81.7; last 5: 3, 0, 1, 4, 8), bats in 97% of games played; venue unknown/unmatched (venue terms neutral); context adj: team H2H context +1%. Notes: 2 market source(s) for fair price; model 0.601 vs market 0.459; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Sharjah Warriorz vs Dubai Capitals / Batsman Total Match Sixes / PI Walter under 0.5** - why: Model 49% vs market 35% for under 0.5 sixes; form 1.1 sixes/inn recency-weighted T20 (n_eff 49.1; last 5: 2, 4, 1, 8, 3), bats in 94% of games played; at Sharjah Cricket Stadium, Sharjah: 4 inns avg 1.5; context adj: venue environment +11%. Notes: 1 market source(s) for fair price; model 0.488 vs market 0.355; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-28 10:10 IST Melbourne Renegades vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 67.0%, model 0.0827, market 0.1268
- 11-28 15:30 IST MI Emirates vs Desert Vipers / Team - Top Batter / W Muhammad @ 15.00 (moviodds_bet365): edge 144.8%, model 0.2288, market 0.1278

Unmatched team names (add to mappings/teams.csv): Central (male), Central Hinds (W) (female), Central Hinds (male), Central Zone (W) (female), Central Zone (male), East Zone (W) (female), East Zone (male), Elite Cricket Academy (male), Lokseva Academy (male), Majees Titan (male), Muscat Shaheens (W) (female), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), Oca Invincibles (W) (female), Omr Checker (male), Roma Gladiatori (male), Sohar Smashers (W) (female), South Zone (W) (female), South Zone (male), Speedworld Security Solutions (male), Wadi Kabir Royals (W) (female), West Zone (W) (female), West Zone (male)

Runtime 132.8s. Snapshot: `odds_20261126T193039Z.jsonl.gz`
