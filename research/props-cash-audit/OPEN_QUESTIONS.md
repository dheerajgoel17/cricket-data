# Open questions, blockers, assumptions

## Blockers / limits of this audit
1. **Chrome window could not be resized** (extension reported success but the viewport stayed ~1430 px). Mobile views were captured by embedding the signed-in app in a 390 px same-origin frame. Touch gestures, safe areas, address-bar behaviour, the native-app experience and real mobile performance are unverified. Please try the same flows on your phone and tell me what differs.
2. **Free trial quota:** the account shows "5 players you can open today". I opened one player (3 → 2 left) and reused it on mobile (no extra charge observed). Team pages, the matchup drawer and search did not cost a player open; Pro screens were not seen. If you want these covered, say so (or run it on a day with fresh quota / a Pro account) and I will continue.
3. **Network/API inspection was not done.** The extension blocks script calls that return URLs with query strings, and I did not probe private endpoints. Data loading, caching and any state library are UNKNOWN.
4. **Save-filter and watchlist star not tested** (they write to your account). Behaviour of "Save Filter Combo" (naming, limits, Pro gating) is unknown.
5. The Markets page URL was not captured; only its content.

## Assumptions
- "Props.Cash" here means the new UI (banner: "Welcome to the new Props.Cash… Go to classic"). The classic site was not inspected.
- NFL/American-odds conventions were treated as sample data only; nothing here implies copying Props.Cash text, branding or data.

## Decisions made (2026-10-31)
- **Native apps:** iOS **and** Android together (not iOS first). Expo is therefore the native path, and the Expo spike must cover both platforms.
- **Accounts:** none. The product stays free with no login, so there is no trial meter, no paywall and no server-side saved state. Saved filters, stars and recents are stored on the device (localStorage on web, AsyncStorage/MMKV in Expo); cross-device carry-over, if wanted, uses a shareable filter link or a copy/paste/QR code, not an account.

- **SEO matters** (decided 2026-10-31): `/props` and `/fancy` are now prerendered and in the sitemap; filtered Props URLs canonicalise to `/props`. Player and fixture pages were already prerendered/sitemapped.

## Decisions still needed from you
1. **Odds format and market scope on mobile:** decimal only (house rule) is fine, but do you want a hit-rate-first row (like the observed "EDGE" column) or an odds-first row?
2. **(Answered: yes, it matters.) Public SEO:** Props.Cash's app is a client-rendered SPA behind a trial wall; your site is also client-rendered with a prerender script. Is organic search a priority for player/fixture pages? If so the pre-render work in the roadmap moves up.
3. **Is research/ allowed to be committed?** It names a competitor and contains screenshots of a third-party product. Hard rule 4 only bans naming *data sources*; I did not run `check_public_safe.py` against this folder. Decide before committing; the folder is untracked now.
4. **Merge state:** `AGENTS.md` currently has unresolved conflict markers (`UU`, from the stash). I did not touch it, but it needs resolving before any PR.
