# Cricket props / fancy model: walk-forward backtest (20 Oct 2026)

## What was built
* Data: Base ball-by-ball (all_json.zip, 17 Oct 2026), 2014 onwards. That gives 18,181 T20/ODI/Test matches, 307,782 batter innings and 221,843 bowler spells. Batting position, innings order (bat first or chase), venue, opposition, gender and intl/league are all derived from the ball-by-ball data.
* Features use only data from before each match: recency-weighted form in the **same format only**, the last-10 median, batting position, and venue and opposition environment. Test features are frozen at the start of the match.
* Walk-forward: models are refit every year on all matches before that year, then predict the next year (2020–2026). Strategies (model, side, margin) were **picked on 2020–23 and reported on 2024–26**, which weren't used for selection.
* Models compared:
  * base rate
  * form-Poisson
  * form-NB (the current approach)
  * legacy cross-format NB (the old 0.25 mixing of T20 and ODI form)
  * LightGBM-Poisson mean with an NB spread (gbm_nb)
  * a 50/50 blend of form-NB and gbm_nb
  * for match markets: league-average NB, venue+teams NB, and GBM
* Profit sim: every bet at **1.90 on both sides**. Bet over if p > 0.526 + margin, under if (1−p) > 0.526 + margin. Margins tested: 0–10%. Staking is flat, plus quarter-Kelly capped at 2%.
* Exchange rules applied: T20 match markets are void unless both innings reach 96 balls (80%), and ODI needs 240. Tests are excluded from match markets. 30s = 30–49 and 50s = 50–99.

## Which model wins (out-of-sample log loss on a ~50/50 line; lower is better; 0.693 = coin flip)
| market | T20 | ODI | Test | winner |
|---|---|---|---|---|
| batter runs | gbm .6866 / blend .6860 vs form .6935 | gbm .6837 vs .6933 | blend .6831 vs .6936 | blend/GBM |
| balls faced | blend .6856 vs .6928 | gbm .6834 vs .6929 | blend .6826 | blend/GBM |
| fours | gbm .6639 vs .6896 | gbm .6716 vs .6927 | blend .6768 | GBM |
| sixes | gbm .5376 vs .5687 | blend .4962 vs .5405 | blend .4256 vs .4550 | GBM/blend (biggest gain) |
| wickets | gbm .6611 vs .6806 | gbm .6627 vs .6812 | blend .6680 | GBM |
| runs conceded | gbm .6656 vs .6929 | gbm .6721 vs .6931 | blend .6673 | GBM |
| match 4s / 30s / double digits / most conceded / top score | GBM clearly best | GBM | n/a | GBM |
| match sixes, highest over | no model beats the naive line | – | – | **no edge** |

* Calibration (expected calibration error, ECE) for the chosen models is 0.6–4% on player props (gbm/blend). Brier improves only 1–5% over form-NB.
* **Legacy cross-format mixing was worse on every market and format.** For example, ODI balls faced had a Brier of 0.270 vs 0.245, and ODI runs conceded 0.292 vs 0.240. It's now turned off (CROSS_FORMAT_WEIGHT=0).
* What drives the gain: batting position and role (balls faced and overs bowled), then venue and opposition environment. Splits by batting first vs chasing, intl vs league, and gender all moved ROI the same way, so no situation flips the sign.

## Profit sim at flat 1.90 (test 2024–26, strategy chosen on 2020–23)
These are measured against a **proxy line set at the player's form-NB median** (a naive book):
* runs T20 blend over, margin 10%: n=1,157, ROI +30% (val +32%)
* runs ODI over, m8: n=363, +30%
* fours T20 under, m10: n=13,500, +38%
* wickets T20 under, m10: n=13,192, +28%
* sixes T20 under (form-Poisson), m10: n=36,126, +61%
* sixes over: no strategy passed validation
* match 4s T20 over, m10: n=1,589, +26%
* 30s T20 over: n=682, +39%
* most runs conceded T20 over: n=1,110, +24%
* match sixes ODI: +9%
* highest over ODI: +5% (weak and unstable)
* Full grid: roi_fair_grid.csv, roi_grid.csv, selected_fair.csv, situations.csv.

**Read these as upper bounds, not expected returns.** The proxy line is only a "form-based book", and the Brier gains above are just 1–5%, which is far too small to produce real ROIs of 20–60%. Real books price skewed markets such as sixes U0.5 well below 1.90. The fixed-line variants (e.g. U1.5 sixes at 1.90) show ROIs of 60–80%, which is pure line artefact. Against a book as sharp as our best model, ROI would be the −5.3% vig. The only real-price evidence is 31 settled alerts: +0.30u on 15 settled (+2%).

## Real alerts: what the new policy would have done
* Of the 31 sent alerts, the new gates would have **blocked 19**: all 9 sixes overs, plus 2+ wicket longshots at 7–10 and odds above the per-market caps. Those 19 lost −1.0u on 12 settled bets (2W).
* The 12 kept alerts settled 2W/1L for +1.3u. That's a tiny sample.
* The policy would also have cut the Springer O1.5 @5.5 winner.

## Markets
* **Disable:** batter sixes OVER; props above max odds (sixes 3.0, runs/fours 3.5, wickets 4.0, milestones 5.0); match sixes; highest over.
* **Keep, on a stricter edge:** sixes under (edge ≥8%), wickets (≥7%), runs, fours, balls.
* **Top batter/bowler:** needs ≥2 market sources and book overround ≤30%. The model alone must also show ≥2% value, which kills edges that come only from wide, thin prices.

## Fixes shipped
1. Format leakage: cross-format weight cut from 0.25 to 0 (config CROSS_FORMAT_WEIGHT).
2. Name matching: an initial plus surname ("S Verma") is rejected if another roster player shares that surname and initial. Surname-only names are rejected. Matches scoring below 90 are now dropped, not just flagged.
3. Sixes overs disabled, plus the stricter sixes-under edge.
4. Top-batter thin-price edges filtered.
Code is in src/value_bets/strategy.py, wired into pipeline.py; the policy can be overridden with value_bets/state/market_policy.json. Output formats are unchanged.

## Caveats
* No historical prop or fancy lines exist for free, so every ROI is against proxy lines. Run the pipeline's odds snapshots for 4–8 weeks and measure CLV and real ROI before trusting any of this. The repo snapshot folder is currently empty because snapshots go to Actions artifacts, which are kept for 30 days.
* Base player names aren't registry IDs, so rare homonyms are merged in the backtest.
* No Afghanistan data.
* Weather, toss and series context (must-win) were not in the backtest. Series context can't be built reliably from Base.
* The live GBM is **not** deployed yet. The live pipeline still uses its NB GLM, now with format-pure form and the policy gates. Next step: port gbm_nb into propmodel and refit weekly.
* Team-specific fancy (only counts if that team bats first) was not backtested separately.

## Sources
* thewagertheorem.com/walk-forward-validation-betting-model; statometrics.com academy (walk-forward without leakage; tuning inside the fold)
* igaming-times.com (closing-line value, calibration, Brier/log loss, Platt/isotonic); metrika.tips (CLV, 1/4–1/8 Kelly, window stability)
* Scarf et al. 2011 JRSS-A (negative binomial for Test runs); Samad & Sen 2021 (bat-first vs chase, venue NB)
