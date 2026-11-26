# Cricket value bets - 2026-11-26 20:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1328 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 277 prices
- **feedl**: ok, 298 prices, 16 events
- **feedk**: ok, 188 prices, 4 events
- **feede**: ok, 144 prices, 8 events
- **feedf**: ok, 264 prices, 6 events
- **feedj**: ok, 552 prices, 6 events
- **feedh**: ok, 932 prices, 41 events
- **feedi**: ok, 1533 prices, 27 events

Matches starting in next 168h: **30**, markets priced: **378**, value bets: **4** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-27 13:45 IST | Australia vs England | Batsman Total Match Sixes | J Fraser-McGurk under 0.5 | 2.62 @ moviodds_bet365 | 2.27 | 0.4933 | 15.5% | 2.00% | medium |
| 11-27 15:40 IST | Perth Scorchers (W) vs Hobart Hurricanes (W) | Batter Total Match Fours | BL Mooney under 3.5 | 2.10 @ moviodds_bet365 | 1.92 | 0.6007 | 9.4% | 2.00% | medium |
| 11-27 15:40 IST | Perth Scorchers (Women) vs Hobart Hurricanes (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.05 @ feedi_d | 1.93 | 0.6007 | 6.2% | 1.48% | medium |
| 11-27 20:00 IST | Sharjah Warriorz vs Dubai Capitals | Batsman Total Match Sixes | PI Walter under 0.5 | 2.62 @ moviodds_bet365 | 2.26 | 0.4877 | 16.2% | 2.00% | medium |

### Why / notes per bet
- **Australia vs England / Batsman Total Match Sixes / J Fraser-McGurk under 0.5** - why: Model 49% vs market 40% for under 0.5 sixes; form 1.3 sixes/inn recency-weighted T20 (n_eff 34.4; last 5: 3, 0, 0, 5, 1), bats in 96% of games played; vs England: 3 inns avg 1.7; context adj: venue environment -3%; weather: rain chance up to 43%, high humidity 89%, cloud cover 96%. Notes: 3 market source(s) for fair price; model 0.493 vs market 0.396; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Perth Scorchers (W) vs Hobart Hurricanes (W) / Batter Total Match Fours / BL Mooney under 3.5** - why: Model 60% vs market 46% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 81.7; last 5: 3, 0, 1, 4, 8), bats in 97% of games played; venue unknown/unmatched (venue terms neutral); context adj: team H2H context +1%. Notes: 3 market source(s) for fair price; model 0.601 vs market 0.456; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Perth Scorchers (Women) vs Hobart Hurricanes (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 60% vs market 45% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 81.7; last 5: 3, 0, 1, 4, 8), bats in 97% of games played; venue unknown/unmatched (venue terms neutral); context adj: team H2H context +1%. Notes: 3 market source(s) for fair price; model 0.601 vs market 0.451; assumes bet void if player doesn't bat/bowl - check book rules
- **Sharjah Warriorz vs Dubai Capitals / Batsman Total Match Sixes / PI Walter under 0.5** - why: Model 49% vs market 41% for under 0.5 sixes; form 1.1 sixes/inn recency-weighted T20 (n_eff 49.1; last 5: 2, 4, 1, 8, 3), bats in 94% of games played; at Sharjah Cricket Stadium, Sharjah: 4 inns avg 1.5; context adj: venue environment +11%. Notes: 2 market source(s) for fair price; model 0.488 vs market 0.406; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-27 20:00 IST Sharjah Warriorz vs Dubai Capitals / Batter Milestones / SW Billings 50+ yes @ 9.00 (moviodds_bet365): edge 32.0%, model 0.1256, market 0.1639
- 11-28 10:10 IST Melbourne Renegades vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 66.3%, model 0.0814, market 0.1268

Unmatched team names (add to mappings/teams.csv): Central (male), Central Hinds (W) (female), Central Hinds (Women) (female), Central Hinds (male), Central Zone (W) (female), Central Zone (Women) (female), Central Zone (male), East Zone (W) (female), East Zone (Women) (female), East Zone (male), IAS Invincibles (male), Ias Invincibles (male), North East Zone (W) (female), North East Zone (Women) (female), North East Zone (male), North Zone (W) (female), North Zone (Women) (female), North Zone (male), South Zone (W) (female), South Zone (Women) (female), South Zone (male), West Zone (W) (female), West Zone (Women) (female), West Zone (male), Yalla Shabab Giants (male)

Runtime 149.7s. Snapshot: `odds_20261126T143037Z.jsonl.gz`
