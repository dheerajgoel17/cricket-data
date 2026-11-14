# Design-system documentation audit

The existing catalogue shows production examples and the handbook defines shared rules. The source inventory adds 177 TSX modules, including 33 page and screen modules, with named exports and direct UI dependencies. Generate it with `npm run design:inventory` in the site workspace. Web page modules can contain several routes, and shared native modules can serve both platforms.

## Verified gaps and rollout

1. **Discovery.** The original page exposes selected swatches, spacing and sizes. The searchable reference derives all groups directly from the shared JSON. The registry covers the inventoried source directories and identifies standalone technical specs separately from source entries.
2. **Foundations.** Typography specimens currently demonstrate the two shipped families. Complete the usage notes for wrapping, scaling, fallback, and per-platform measurements. Document contrast against actual foreground/background pairs, accounting for alpha and platform surface composition.
3. **Components.** Start with shared primitives. The Button spec uses the production implementation and typed variant controls. Extend that approach to forms, overlays, navigation and data displays, then to product compositions. A registry entry is discovery coverage. Full specs still need native previews or annotated captures, anatomy, measurements, state behavior and accessibility.
4. **Patterns and platforms.** The reference links pattern flows to source modules. Deepen the flows with route-specific state handling and keyboard or touch behavior. Record intentional differences, including system segmented controls and Android navigation.
5. **Governance.** The inventory check detects added, removed or renamed modules and changes to their indexed imports and exports. Continue with compile-checked examples, per-spec coverage checks, and responsive accessibility and visual verification.

The registry uses source declarations and direct imports as evidence. It does not infer runtime usage, type contracts, platform parity, or documentation completeness.
