# Cricket value bets - 2026-11-27 07:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1384 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 359 prices
- **feedk**: ok, 156 prices, 4 events
- **feedl**: ok, 322 prices, 20 events
- **feede**: ok, 260 prices, 12 events
- **feedf**: ok, 298 prices, 8 events
- **feedj**: ok, 775 prices, 13 events
- **feedh**: ok, 1119 prices, 64 events
- **feedi**: ok, 1413 prices, 44 events

Matches starting in next 168h: **42**, markets priced: **434**, value bets: **3** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-27 13:45 IST | Australia vs England | Batsman Total Match Sixes | J Fraser-McGurk under 0.5 | 2.62 @ moviodds_bet365 | 2.27 | 0.4933 | 15.5% | 2.00% | medium |
| 11-27 15:40 IST | Perth Scorchers (W) vs Hobart Hurricanes (W) | Batter Total Match Fours | BL Mooney under 3.5 | 2.10 @ moviodds_bet365 | 1.93 | 0.6007 | 8.8% | 2.00% | medium |
| 11-27 15:40 IST | Perth Scorchers (Women) vs Hobart Hurricanes (Women) | G9182 batter_fours | Beth Mooney under 3.5 | 2.10 @ feedi_d | 1.93 | 0.6007 | 8.8% | 2.00% | medium |

### Why / notes per bet
- **Australia vs England / Batsman Total Match Sixes / J Fraser-McGurk under 0.5** - why: Model 49% vs market 40% for under 0.5 sixes; form 1.3 sixes/inn recency-weighted T20 (n_eff 34.4; last 5: 3, 0, 0, 5, 1), bats in 96% of games played; vs England: 3 inns avg 1.7; context adj: venue environment -3%; weather: high humidity 88%, cloud cover 93%. Notes: 3 market source(s) for fair price; model 0.493 vs market 0.396; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Perth Scorchers (W) vs Hobart Hurricanes (W) / Batter Total Match Fours / BL Mooney under 3.5** - why: Model 60% vs market 45% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 81.6; last 5: 3, 0, 1, 4, 8), bats in 97% of games played; venue unknown/unmatched (venue terms neutral); context adj: team H2H context +1%. Notes: 3 market source(s) for fair price; model 0.601 vs market 0.451; assumes bet void if player doesn't bat/bowl - check book rules; price via unofficial Book A mirror - confirm on Book A before betting
- **Perth Scorchers (Women) vs Hobart Hurricanes (Women) / G9182 batter_fours / Beth Mooney under 3.5** - why: Model 60% vs market 45% for under 3.5 fours; form 4.1 fours/inn recency-weighted T20 (n_eff 81.6; last 5: 3, 0, 1, 4, 8), bats in 97% of games played; venue unknown/unmatched (venue terms neutral); context adj: team H2H context +1%. Notes: 3 market source(s) for fair price; model 0.601 vs market 0.451; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-28 10:10 IST Melbourne Renegades (W) vs Melbourne Stars (W) / Team - Top Batter / C Webb @ 13.00 (moviodds_bet365): edge 39.6%, model 0.0863, market 0.1188
- 11-28 10:10 IST Melbourne Renegades vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 66.0%, model 0.0834, market 0.1254

Unmatched team names (add to mappings/teams.csv): Central Hinds (W) (female), Central Hinds (Women) (female), Central Hinds (female), Central Hinds (male), Central Zone (W) (female), Central Zone (Women) (female), Central Zone (male), East Zone (W) (female), East Zone (Women) (female), East Zone (male), Elite Cricket Academy (male), Lokseva Academy (male), Majees Titan (male), Muscat Shaheens (W) (female), North East Zone (W) (female), North East Zone (Women) (female), North East Zone (male), North Zone (W) (female), North Zone (Women) (female), North Zone (male), Oca Invincibles (W) (female), Omr Checker (male), Roma Gladiatori (male), Sohar Smashers (W) (female), South Zone (W) (female), South Zone (Women) (female), South Zone (male), Speedworld Security Solutions (male), Wadi Kabir Royals (W) (female), West Zone (W) (female), West Zone (Women) (female), West Zone (male)

Runtime 180.1s. Snapshot: `odds_20261127T013030Z.jsonl.gz`
