# Cricket value bets - 2026-11-23 01:00 IST

Decimal odds. Edge = fair probability x odds (after exchange commission) - 1. Stake = quarter-Kelly % of bankroll (capped). Not betting advice; models are rough.

## Sources
- **moviodds_bet365**: ok, 1285 prices
- **feedg**: error - HTTPError: HTTP Error 402: {"error": {"code": "402", "message": "Payment required"}}
- **smarkets**: ok, 433 prices
- **feedk**: ok, 110 prices, 3 events
- **feedl**: ok, 462 prices, 15 events
- **feedf**: ok, 126 prices, 7 events
- **feede**: ok, 424 prices, 17 events
- **feedj**: ok, 880 prices, 13 events
- **feedh**: ok, 1517 prices, 38 events
- **feedi**: ok, 1969 prices, 30 events

Matches starting in next 168h: **31**, markets priced: **470**, value bets: **1** (new alerts: 1). Min edge 5%.

| Start (IST) | Match | Market | Selection | Odds @ source | Fair | Model p | Edge | Stake | Conf |
|---|---|---|---|---|---|---|---|---|---|
| 11-23 20:00 IST | Sharjah Warriorz vs Desert Vipers | G9182 batter_fours | Tim Seifert under 2.5 | 1.73 @ feedi_d | 1.58 | 0.6874 | 9.3% | 2.00% | medium |

### Why / notes per bet
- **Sharjah Warriorz vs Desert Vipers / G9182 batter_fours / Tim Seifert under 2.5** - why: Model 69% vs market 59% for under 2.5 fours; form 2.9 fours/inn recency-weighted T20 (n_eff 98.0; last 5: 2, 11, 0, 0, 0), bats in 96% of games played; at Sharjah Cricket Stadium, Sharjah: 6 inns avg 0.7; vs Desert Vipers: 3 inns avg 0.3; context adj: venue environment -3%, at this venue -12%, team H2H context -11%. Notes: 2 market source(s) for fair price; model 0.687 vs market 0.589; assumes bet void if player doesn't bat/bowl - check book rules

### Suspect edges (> 30%, NOT alerted - likely a pricing/mapping error)
- 11-26 13:40 IST Sydney Sixers vs Melbourne Stars / M13704 top_bowler_team / Carly Leeson @ 15.00 (feedj_d): edge 48.6%, model 0.078, market 0.1105

Unmatched team names (add to mappings/teams.csv): South Australia Redbacks (male), Tasmanian Tigers (male), Western Australia Warriors (male)

Runtime 171.9s. Snapshot: `odds_20261122T193036Z.jsonl.gz`
