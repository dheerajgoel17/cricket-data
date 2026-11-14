# Design system changelog

Append-only history of shared UI components, tokens, and catalogue stages. Newest first.
Agents and humans: add an entry in the same PR as the change (see `.cursor/rules/design-system-centralization.mdc`).

## Format

```
### YYYY-MM-DD — Component or token name
- **Path:** `site/src/...`
- **Change:** what landed (API, visual, token, catalogue)
- **Callers:** where it applies / what to re-check
- **PR:** #N (optional)
```

---

### 2026-11-14 — Design-host auth + chrome handoff harden
- **Path:** `site/src/lib/auth.tsx`, `site/src/pages/AuthCallback.tsx`, `site/src/main.tsx`, `site/src/lib/design-host.ts`, `Header.tsx`, `IosTabBar.tsx`, `GlobalSearch.tsx`, `chrome.tsx`
- **Change:** Design-host Google/email OAuth finishes on `PRODUCT_ORIGIN/auth/callback?next=`; stray design `/auth/callback` redirects to product; tab bar never selected on catalogue; footer uses `PRODUCT_ORIGIN`.
- **Callers:** design host Sign-in / Saved / tabs / search entity hits

### 2026-11-14 — Centralization rule + typography font stack code block
- **Path:** `.cursor/rules/design-system-centralization.mdc`, `docs/DESIGN_SYSTEM_CHANGELOG.md`, `site/src/components/design-system/reference.tsx`
- **Change:** Always-on Cursor rule for DS ↔ product sync before merge; append-only changelog; `font-sans-stack` shown in a `<pre><code>` block with copy on Typography.
- **Callers:** all UI PRs; design host `/docs/type`

### 2026-11-14 — Docs content column (PreviewFrame + DocsArticle)
- **Path:** `site/src/components/design-system/docs-article.tsx`, `example-stage.tsx`, `site/src/pages/DesignSystem.tsx`
- **Change:** Catalogue right pane uses docs article header, When to use, On this page TOC, DocsPager; live demos use `PreviewFrame` (H2 + Preview toolbar). Product shell Header/Sidebar recipe reused; Saved/search/tabs hand off via `design-host.ts`.
- **Callers:** design host only (`design.fancy.cash` / `VITE_DESIGN_SYSTEM_HOST`)

### 2026-11-14 — ChartBars line on light docs
- **Path:** `site/src/components/app/chart.tsx`
- **Change:** Threshold line uses `border-foreground/35` so it reads on `design-light` as well as product dark.
- **Callers:** Player, ResultView, design-system Data & metrics stage
