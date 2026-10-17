# Prop model backtest (2026-10-17 09:45 IST)

Data through 2026-10-14. Test = 2025-01-01..2026-10-14 (held out). Feature selection on validation 2023-01-01..2024-12-31. Eval rows: player n_eff in format >= 3.0.

Mean over fixed lines (runs 9.5/19.5/29.5/49.5/99.5, sixes 0.5/1.5/2.5, fours 1.5/2.5/3.5, wkts 0.5/1.5/2.5).

| stat/format | n | baseline v1 LL | form-GLM LL | all-context LL | selected LL | baseline Brier | selected Brier | selected features |
|---|---|---|---|---|---|---|---|---|
| runs/T20 | 46249 | 0.3930 | 0.3902 | 0.3865 | 0.3866 | 0.1293 | 0.1278 | p_bat, h2h_runs |
| runs/ODI | 11892 | 0.4838 | 0.4795 | 0.4760 | 0.4766 | 0.1619 | 0.1606 | p_bat |
| runs/MULTI | 9360 | 0.5203 | 0.5120 | 0.5104 | 0.5105 | 0.1738 | 0.1704 | opp_runs, oppstr_runs, ven_runs, p_bat |
| sixes/T20 | 46249 | 0.3767 | 0.3738 | 0.3711 | 0.3714 | 0.1199 | 0.1186 | env_sixes, p_bat |
| sixes/ODI | 11892 | 0.3273 | 0.3245 | 0.3216 | 0.3215 | 0.0995 | 0.0985 | env_sixes, p_bat, intl |
| sixes/MULTI | 9360 | 0.3261 | 0.3230 | 0.3209 | 0.3207 | 0.0972 | 0.0960 | env_sixes, oppstr_sixes, intl |
| fours/T20 | 46249 | 0.4878 | 0.4850 | 0.4791 | 0.4791 | 0.1606 | 0.1583 | p_bat, env_fours, ven_fours, h2h_runs |
| fours/ODI | 11892 | 0.5910 | 0.5872 | 0.5817 | 0.5831 | 0.2042 | 0.2015 | p_bat |
| fours/MULTI | 9360 | 0.6021 | 0.5880 | 0.5855 | 0.5856 | 0.2071 | 0.1997 | opp_fours, ven_fours, p_bat, oppstr_fours |
| wkts/T20 | 34844 | 0.5237 | 0.5154 | 0.5136 | 0.5137 | 0.1738 | 0.1705 | oppstr_wkts, p_bowl, intl |
| wkts/ODI | 7907 | 0.5567 | 0.5524 | 0.5478 | 0.5491 | 0.1873 | 0.1847 | p_bowl |
| wkts/MULTI | 5270 | 0.5641 | 0.5508 | 0.5410 | 0.5409 | 0.1913 | 0.1816 | p_bowl, oppstr_wkts, ven_wkts, env_wkts |
