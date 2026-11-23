# Cricket value bets - 2026-11-23 18:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1853 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 441 prices
- **feedk**: ok, 172 prices, 5 events
- **feedl**: ok, 652 prices, 28 events
- **feedj**: ok, 607 prices, 9 events
- **feede**: ok, 702 prices, 29 events
- **feedh**: ok, 1539 prices, 45 events
- **feedf**: ok, 528 prices, 14 events
- **feedi**: ok, 2152 prices, 33 events, stopped time budget

Matches starting in next 168h: **41**, markets priced: **524**, value bets: **5** (new alerts: 0). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-23 20:00 IST | Sharjah Warriorz vs Desert Vipers | G9182 batter_fours | Tim Seifert under 2.5 | 1.73 @ feedi_d | 1.58 | 0.6874 | 9.3% | 2.00% | medium |
| 11-24 13:45 IST | Australia vs England | G9181 batter_sixes | Tom Banton under 0.5 | 2.30 @ feedi_d | 2.01 | 0.5185 | 14.5% | 2.00% | medium |
| 11-24 13:45 IST | Australia vs England | G9182 batter_fours | Mitchell Marsh under 2.5 | 2.00 @ feedi_d | 1.85 | 0.5902 | 8.1% | 2.00% | medium |
| 11-24 13:45 IST | Australia vs England | G9182 batter_fours | Harry Brook under 2.5 | 1.80 @ feedi_d | 1.70 | 0.6522 | 6.0% | 1.86% | medium |
| 11-26 13:40 IST | Sydney Sixers vs Melbourne Stars | M13700 batter_runs | Ellyse Perry under 32.5 | 1.82 @ feedj_d | 1.68 | 0.6679 | 8.4% | 2.00% | medium |

### Why / notes per bet
- **Sharjah Warriorz vs Desert Vipers / G9182 batter_fours / Tim Seifert under 2.5** - why: Model 69% vs market 59% for under 2.5 fours; form 2.9 fours/inn recency-weighted T20 (n_eff 97.9; last 5: 2, 11, 0, 0, 0), bats in 96% of games played; at Sharjah Cricket Stadium, Sharjah: 6 inns avg 0.7; vs Desert Vipers: 3 inns avg 0.3; context adj: venue environment -3%, at this venue -12%, team H2H context -11%. Notes: 2 market source(s) for fair price; model 0.687 vs market 0.589; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / G9181 batter_sixes / Tom Banton under 0.5** - why: Model 52% vs market 48% for under 0.5 sixes; form 1.0 sixes/inn recency-weighted T20 (n_eff 74.1; last 5: 1, 4, 0, 1, 1), bats in 92% of games played; venue unknown/unmatched (venue terms neutral); vs Australia: 4 inns avg 0.2; weather: high humidity 76%. Notes: 2 market source(s) for fair price; model 0.519 vs market 0.481; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / G9182 batter_fours / Mitchell Marsh under 2.5** - why: Model 59% vs market 50% for under 2.5 fours; form 3.3 fours/inn recency-weighted T20 (n_eff 61.2; last 5: 3, 1, 5, 5, 5), bats in 96% of games played; venue unknown/unmatched (venue terms neutral); vs England: 7 inns avg 1.9; context adj: team H2H context -3%; weather: high humidity 76%. Notes: 2 market source(s) for fair price; model 0.590 vs market 0.500; assumes bet void if player doesn't bat/bowl - check book rules
- **Australia vs England / G9182 batter_fours / Harry Brook under 2.5** - why: Model 65% vs market 54% for under 2.5 fours; form 2.6 fours/inn recency-weighted T20 (n_eff 51.7; last 5: 4, 3, 1, 10, 7), bats in 92% of games played; venue unknown/unmatched (venue terms neutral); vs Australia: 4 inns avg 2.0; context adj: team H2H context -1%; weather: high humidity 76%. Notes: 2 market source(s) for fair price; model 0.652 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules
- **Sydney Sixers vs Melbourne Stars / M13700 batter_runs / Ellyse Perry under 32.5** - why: Model 67% vs market 54% for under 32.5 runs; form 31.2 runs/inn recency-weighted T20 (n_eff 77.4; last 5: 9, 45, 3, 30, 59), bats in 96% of games played; at North Sydney Oval: 40 inns avg 37.5; vs Melbourne Stars Women: 1 inns avg 84.0. Notes: 2 market source(s) for fair price; model 0.668 vs market 0.537; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 48.5%, model 0.0778, market 0.1105
- 11-27 03:30 IST New Zealand vs India / G2808 / Tom Latham @ 14.50 (feedi_d): edge 30.7%, model 0.126, market 0.0708

Unmatched team names (add to mappings/teams.csv): Lokseva Academy (male), Omr Checker (male), South Australia Redbacks (male), Speedworld Security Solutions (male), Sunny 11 Pratishtan (male), Tasmanian Tigers (male)

Runtime 425.8s. Snapshot: `odds_20261123T123036Z.jsonl.gz`
