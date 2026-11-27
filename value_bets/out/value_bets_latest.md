# Cricket value bets - 2026-11-27 19:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1656 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 316 prices
- **feedl**: ok, 306 prices, 12 events
- **feedk**: ok, 198 prices, 6 events
- **feede**: ok, 154 prices, 7 events
- **feedf**: ok, 242 prices, 4 events
- **feedj**: ok, 616 prices, 8 events
- **feedh**: ok, 933 prices, 39 events
- **feedi**: skipped - Feed I Cloudflare challenge (tried ['chrome', 'chrome152', 'chrome146', 'chrome136', 'chrome133a', 'chrome_android', 'chrome131_android', 'safari270', 'firefox155', 'chrome131']: Cloudflare challenge with impersonate=chrome131)

Matches starting in next 168h: **32**, markets priced: **360**, value bets: **2** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-28 13:40 IST | Sydney Thunder (W) vs Sydney Sixers (W) | Batsman Match Runs | P Litchfield under 25.5 | 1.83 @ moviodds_bet365 | 1.75 | 0.6185 | 5.1% | 1.53% | medium |
| 11-29 13:45 IST | Australia vs England | Aneurin Donald To Score 50 | Aneurin Donald 50+ yes | 5.00 @ feede_lb | 4.27 | 0.2199 | 17.1% | 1.07% | medium |

### Why / notes per bet
- **Sydney Thunder (W) vs Sydney Sixers (W) / Batsman Match Runs / P Litchfield under 25.5** - why: Model 62% vs market 54% for under 25.5 runs; form 26.2 runs/inn recency-weighted T20 (n_eff 71.7; last 5: 121, 26, 28, 1, 13), bats in 96% of games played; at Drummoyne Oval, Sydney: 15 inns avg 24.1; context adj: team H2H context -1%; weather: rain chance up to 90%, high humidity 90%, cloud cover 100%. Notes: 2 market source(s) for fair price; model 0.618 vs market 0.536; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting; RAIN RISK: up to 90% rain chance, 0.7 mm forecast during the match - shortened match or void props possible
- **Australia vs England / Aneurin Donald To Score 50 / Aneurin Donald 50+ yes** - why: Model 22% vs market 25% for 50+ runs; form 30.1 runs/inn recency-weighted T20 (n_eff 35.1; last 5: 32, 85, 10, 13, 21), bats in 98% of games played; vs Australia: 3 inns avg 42.3; weather: rain chance up to 57%, high humidity 90%. Notes: 4 market source(s) for fair price; model 0.220 vs market 0.246; milestone: assumes loses if player doesn't bat/bowl (void if not in XI); RAIN RISK: up to 57% rain chance, 1.5 mm forecast during the match - shortened match or void props possible

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-28 10:10 IST Melbourne Renegades (W) vs Melbourne Stars (W) / Team - Top Batter / C Webb @ 13.00 (moviodds_bet365): edge 45.5%, model 0.0991, market 0.1188
- 11-28 10:10 IST Melbourne Renegades vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 56.3%, model 0.0771, market 0.1188
- 11-28 13:40 IST Sydney Thunder (W) vs Sydney Sixers (W) / Batsman Total Match Sixes / AK Gardner under 0.5 @ 2.50 (moviodds_bet365): edge 30.9%, model 0.6029, market 0.459

Unmatched team names (add to mappings/teams.csv): Central Hinds (W) (female), Central Hinds (female), Central Hinds (male), Central Zone (W) (female), Central Zone (male), Dolphins (W) (female), East Zone (W) (female), East Zone (male), Garden Route Badgers (W) (female), Lions (W) (female), Majees Titan (male), Muscat Shaheens (W) (female), North East Zone (W) (female), North East Zone (male), North Zone (W) (female), North Zone (male), South Zone (W) (female), South Zone (male), Titans (W) (female), Wadi Kabir Royals (W) (female), West Zone (W) (female), West Zone (male)

Runtime 124.1s. Snapshot: `odds_20261127T133047Z.jsonl.gz`
