# Design-system documentation audit

The existing catalogue shows production examples and the handbook defines shared rules. The source inventory adds 177 TSX modules, including 33 page and screen modules, with named exports and direct UI dependencies. Generate it with `npm run design:inventory` in the site workspace. Web page modules can contain several routes, and shared native modules can serve both platforms.

## Verified gaps and rollout

1. **Discovery.** The original page exposes selected swatches, spacing and sizes. The searchable reference derives all groups directly from the shared JSON. The registry covers the inventoried source directories and identifies standalone technical specs separately from source entries.
2. **Foundations.** Typography specimens currently demonstrate the two shipped families. Complete the usage notes for wrapping, scaling, fallback, and per-platform measurements. Document contrast against actual foreground/background pairs, accounting for alpha and platform surface composition.
3. **Components.** Start with shared primitives. The Button spec uses the production implementation and typed variant controls. Extend that approach to forms, overlays, navigation and data displays, then to product compositions. A registry entry is discovery coverage. Full specs still need native previews or annotated captures, anatomy, measurements, state behavior and accessibility.
4. **Patterns and platforms.** The reference links pattern flows to source modules. Deepen the flows with route-specific state handling and keyboard or touch behavior. Record intentional differences, including system segmented controls and Android navigation.
5. **Governance.** The inventory check detects added, removed or renamed modules and changes to their indexed imports and exports. Continue with compile-checked examples, per-spec coverage checks, and responsive accessibility and visual verification.

The registry uses source declarations and direct imports as evidence. It does not infer runtime usage, type contracts, platform parity, or documentation completeness.

## Layout / spacing / typography foundation (2026-11-15)

Reference for this pass: structural consistency (centralized tokens, predictable rhythm, shared gutters) — not cloning a marketing column width or body LH from an external screenshot.

| Area | Status | Evidence |
| --- | --- | --- |
| Design tokens SSOT | **Already implemented** | `site/packages/tokens/tokens.json` → web `tokens.generated.css` + Tailwind roles; app `mobile/src/ui/tokens.ts` via `remPx` |
| Spacing scale | **Already implemented** | `space-hair` … `space-section`, `gutter`, `inset`; utilities `gap-*` / `p-*` / `px-gutter` |
| Typography scale | **Already implemented** | `text-display` … `text-caption` + weights; Satoshi + Barlow Condensed; app `type` / `cap` / `num` |
| Page containers / gutters | **Already implemented** | Web `Shell` `px-gutter` + `max-w-(--content-max)`; app screens/`Bleed` use `space.gutter` |
| Layout primitives | **Already implemented** | Web `PageTitle`, `StickyFilterBand`, `DetailSplit`, `CardGrid`, `TABLE_BLEED`; app `PageHeader`, `Bleed`, `DataTable` |
| Vertical rhythm rule | **Already implemented** | Parent `gap-*` stacks; GOVERNED forbids own `mt`/`mb`/`my` (except `mt-auto`) |
| Cross-platform contract | **Already implemented** | Same role names; compatibility map in `docs/DESIGN_SYSTEM.md` |
| Token lint coverage | **Was partial → closed** | Four product modules used named roles but were off GOVERNED; now enrolled |
| App micro-gaps (2 px) | **Intentional** | Icon+label tight pairs; not competing with `space.hair` (4) / `space.tight` (6) |
| Condensed figure sizes | **Intentional** | Scoreboard `fontSize` overrides on native twin web `font-condensed text-metric` / `text-title` |
| Content max width (narrow column) | **Missing by design** | Product is full-bleed stats (`content-max: 100%`), not a 536 px editorial column |

**Inconsistencies found:** governance enrollment lag only (no arbitrary spacing/type regressions in ungoverned product files). No visual redesign required.
