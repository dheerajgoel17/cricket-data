# Screen-by-screen review (app, Android phone, release build, 2026-11-15)

Method: every screen opened by deep link, scrolled from the top to the very bottom with a screenshot at each stop; frame stats from `dumpsys gfxinfo` while scrolling (3 swipes down, 3 up) and around taps. The web (375 px) was compared on Home only so far; the other web pages are still to review. iOS is not covered. Finger feel (gesture handoff, overscroll) is not measurable from here.

## Performance (measured)

| Screen | Scroll: janky frames | 99th pct frame | Notes |
| --- | --- | --- | --- |
| Home, Props, Fancy, Leagues, Competitions | 0–0.08% | 11–16 ms | smooth |
| Fixture, Player, Team, League, Ground | 0.09–0.10% | 10–19 ms | smooth |

| Interaction | Janky frames | Slowest frame | Verdict |
| --- | --- | --- | --- |
| Home phase tab (In play / Pre-match) | 0% | 121 ms (once) | ok |
| Props day chip (Tomorrow) | 6% | 150 ms | optimise: list recompute on the tap |
| Props Filters sheet open | 16% | 129 ms | optimise: sheet mount cost |
| Leagues season chip (2025) | 17% | 250 ms | optimise: leaders / tables recomputed synchronously |
| Cold start (release) | | 1.3–2.0 s | ok, not tuned |

Scrolling is solid everywhere. The cost is in **state changes that recompute a whole list or table on the JS thread** (chip taps, sheet open). Fix pattern: do the recompute inside `startTransition` / `useDeferredValue`, keep the previous list on screen with the new chip already highlighted, mount the sheet body one frame late (`useLater`).

## Cross-cutting findings

| # | Finding | Where | Proposed fix |
| --- | --- | --- | --- |
| X1 | Home: the phase tabs and the fixture rail stay fixed while the props list scrolls under them, so the list gets about 45% of the screen; the web scrolls the whole page | Home | Let the rail scroll away (list header); keep only the phase tabs sticky |
| X2 | Two control styles for the same job: line tabs / chips on Home, League, Team, Player; native-style `Segmented` on Ground (Matches / Markets, All / Men / Women), Leagues (Batting / Bowling / Overall) | Ground, Leagues, League stats | One tab control per job: `LineTabs` for sections, `Chips` for filters; keep `Segmented` only for a 2–3 way toggle inside a card |
| X3 | Real names missing: Team grid shows ids ("5e72ffe1", "870fbda7") where a player has no name in the data | Team | Data fix at the source (identity table / builder), never a client-side hack |
| X4 | Fancy ladder: the Line column wrapped long lines ("1060.5" on two lines) | Fixture → Match Fancy | Fixed (column 60 pt); re-check on device |
| X5 | Avatars load late: grey placeholders appear after a chip change | Props, Home | Reserve the avatar box, fade in; prefetch the next day's first avatars |
| X6 | Content scrolls under the Android navigation bar on list pages (the last row overlaps the system buttons) | Competitions and other lists | Bottom padding = nav bar inset + 24; the tab fade already covers the edge |
| X7 | Header pattern: entity pages now share it (name + subtitle in the bar, flat hero, then tabs); Props / Fancy / Leagues / Saved use the large title; Home uses the brand | all | Document the two header kinds (tab = large title, drill-in = name + subtitle) and hold every page to one |
| X8 | Bold: now limited to names, scores and prices; still bold: team and player names in every row, which is intended | all | Review again after the next build |
| X9 | Spacing rhythm applied to Search, Saved, Leagues, League, Team, Home props, Fancy detail, Fixture, Ground; not yet to Contact, Competitions list header, info sheet, sign-in sheet | several | Apply `rhythm` to the rest |

## Per screen

| Screen | Seen | Findings |
| --- | --- | --- |
| Home | top to bottom | X1; high-odds card is fine; phase tab switch is smooth |
| Player props | top to bottom | rows consistent; day chip tap janky (6%); avatars load late (X5); edge column dashes everywhere when no model edge: consider hiding the column when empty |
| Fancy | top to bottom | cards consistent, rhythm good; header line "last 11 / last 38" is tiny text |
| Leagues | top to bottom | League hero + season chips + facts card + leader card + stat tables read well; season chip tap janky (17%); `Segmented` for Batting / Bowling / Overall (X2) |
| Saved | top (empty state) | empty state is a large black area; the sign-in button is a pill centred under a card, the other pages left-align actions |
| Contact | top | to review in detail (2 stops) |
| Search | 9 stops | to review in detail |
| Competitions | top to bottom | fixed: flat edge-to-edge rows with the page gutter; check the last row against the nav bar (X6) |
| Fixture | top to bottom | scoreboard, batters strip, Props / Match Fancy / Grid / Custom line chips and stat chips follow the web; long list ends cleanly |
| Fixture → Match Fancy | top to bottom | X4; chart, O/U stepper and lines table read well |
| Fixture → Ground | 1 stop | opens at the same ground page as Venue |
| Player | top to bottom | hero gradient, stat grid, chart, O/U + stepper + star row, window pills, lines table; the sticky chip bar cuts the window pills mid-element when scrolling (normal for sticky, but check the scrim) |
| Team | top to bottom | LineTabs + Chips now; grid readable; X3 |
| League | top to bottom | header pattern fixed; stat tables consistent |
| Venue / Ground | top to bottom | header now matches (name + city); conditions row aligned; Matches / Markets and All / Men / Women still `Segmented` (X2); "Matches at this ground" now has section spacing |
| Info sheet, Sign-in sheet, Filters sheet | filters opened | filters sheet is a full-height sheet with Day / Match / Team / Format / Competition / Hit-rate; fine; opening costs 129 ms |

## Interactions and motion checked

- Tabs (phase, bottom bar), chips (day, season), section tabs, filters sheet open and Back: all respond and settle on the right state; no crash, no log errors.
- Not checkable from here: spring feel, haptics, reduce-motion, gesture handoff, pull to refresh. Needs a hand on the phone.

## Status after the second pass (same day, verified on the phone unless noted)

| Finding | Status |
| --- | --- |
| X1 Home rail pinned | fixed: the rail scrolls with the page, header and phase tabs stay pinned |
| X2 control consistency | fixed on Ground (line tabs + chips); `Segmented` stays where the web also uses a segmented track (market tape, player sections, stats groups) |
| X3 hash ids as player names | open: data-builder bug, its own session / PR |
| X4 fancy ladder wrap | fixed, seen on the phone |
| X5 avatars load late | open |
| X6 nav-bar padding | checked: last rows clear the bar |
| X9 rhythm | applied to every page body; Contact and Saved too |
| Saved empty state | fixed (centred), not yet seen on the phone |
| Chip / tap latency | chips, tabs and segmented controls highlight in the tap frame (`useChoice`); Filters sheet jank 16% → 2%; Leagues season chip 17% → 14%; the Props day chip still has one 150 ms frame (data re-score) |
| Sorting animation | added (`Reflow` / `ReflowGroup`) on Saved and the Fancy overview; not on virtualized lists |
| Duplicated components | one `FilterButton`, `Button`, `SearchField`, `IconBadge`, `ActiveChip` / `ChoiceChip`, `Sheet`, `RoundButton` (guard tests) |
| Text roles | 273 styles on named roles; no raw font family (guard test) |
| Web | desktop Props and phone Competitions look coherent; the other web pages are not reviewed yet |

## Proposed fix order

1. X1 Home layout, X2 control consistency, X6 nav-bar padding (structure).
2. Performance: chip / sheet / season state changes through transitions (Props, Leagues, Filters).
3. X3 (data), X5 (avatars), X9 (rhythm on remaining pages), Saved empty state.
4. Web review of the same screens at 375 px and the matching changes.
5. Re-measure and update this file.
