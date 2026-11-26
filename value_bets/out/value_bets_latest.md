# Cricket value bets - 2026-11-26 10:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 2267 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 336 prices
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=firefox155)
- **feedk**: ok, 252 prices, 6 events
- **feedl**: ok, 502 prices, 33 events
- **feede**: ok, 600 prices, 32 events
- **feedj**: ok, 494 prices, 15 events
- **feedh**: ok, 1809 prices, 69 events
- **feedf**: ok, 782 prices, 24 events

Matches starting in next 168h: **46**, markets priced: **565**, value bets: **2** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-27 13:45 IST | Australia vs England | Batsman Total Match Sixes | J Fraser-McGurk under 0.5 | 2.62 @ moviodds_bet365 | 2.40 | 0.4933 | 9.5% | 1.46% | low |
| 11-27 20:00 IST | Sharjah Warriorz vs Dubai Capitals | Batsman Total Match Sixes | PI Walter under 0.5 | 2.62 @ moviodds_bet365 | 2.41 | 0.4877 | 8.8% | 1.36% | low |

### Why / notes per bet
- **Australia vs England / Batsman Total Match Sixes / J Fraser-McGurk under 0.5** - why: Model 49% vs market 35% for under 0.5 sixes; form 1.3 sixes/inn recency-weighted T20 (n_eff 34.4; last 5: 3, 0, 0, 5, 1), bats in 96% of games played; vs England: 3 inns avg 1.7; context adj: venue environment -3%; weather: rain chance up to 76%, high humidity 90%, cloud cover 98%. Notes: 1 market source(s) for fair price; model 0.493 vs market 0.355; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 76% rain chance, 1.0 mm forecast during the match - shortened match or void props possible
- **Sharjah Warriorz vs Dubai Capitals / Batsman Total Match Sixes / PI Walter under 0.5** - why: Model 49% vs market 35% for under 0.5 sixes; form 1.1 sixes/inn recency-weighted T20 (n_eff 49.1; last 5: 2, 4, 1, 8, 3), bats in 94% of games played; at Sharjah Cricket Stadium, Sharjah: 4 inns avg 1.5; context adj: venue environment +11%. Notes: 1 market source(s) for fair price; model 0.488 vs market 0.355; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 77.8%, model 0.1032, market 0.1268
- 11-27 20:00 IST Sharjah Warriorz vs Dubai Capitals / Batter Milestones / SW Billings 50+ yes @ 9.00 (moviodds_bet365): edge 32.0%, model 0.1256, market 0.1639

Unmatched team names (add to mappings/teams.csv): Central (male), Central Zone (W) (female), East Zone (W) (female), East Zone (male), Elite Cricket Academy (male), IAS Invincibles (male), Ias Invincibles (male), Lokseva Academy (male), Majees Titan (male), Muscat Thunders (male), Mustafa Fragrance (male), North East Zone (W) (female), North Zone (W) (female), North Zone (male), South Zone (W) (female), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), West Zone (W) (female), Yalla Shabab Giants (male)

Runtime 209.3s. Snapshot: `odds_20261126T043037Z.jsonl.gz`
