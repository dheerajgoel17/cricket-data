/* eslint-disable @typescript-eslint/no-explicit-any */
import { CompactFancyItem } from "./fancy-lines";

/** Lean the shorter decimal (nearer evens); Over when tied — unscored fallback only. */
function leanSide(over: number, under: number) {
  if (over > 1 && under > 1) return under < over ? "under" : "over";
  return over > 1 ? "over" : "under";
}

/**
 * Match Fancy `liveRows`: CompactFancyItem with `live` (In play line).
 * Prefer `scored` from `scoreLiveOuRow` (Edge + L10 from the overs tape). Unscored fallback has no book logo.
 */
export function LiveMarketRow({ m, scored }: { m: any; scored?: any | null }) {
  if (scored) return <CompactFancyItem r={scored} />;
  if (m.kind === "ou") {
    const side = leanSide(m.over, m.under);
    return (
      <CompactFancyItem
        r={{
          label: m.market,
          live: true,
          line: m.line,
          over: m.over,
          under: m.under,
          side,
          edge: null,
          last: [],
        }}
      />
    );
  }
  const first = m.outcomes?.[0];
  return (
    <CompactFancyItem
      r={{
        label: m.market,
        live: true,
        line: first?.price ?? 0,
        over: first?.price ?? 0,
        under: null,
        side: "over",
        edge: null,
        last: [],
      }}
      sub={(m.outcomes || []).map((o: any) => `${o.label}${o.sub ? ` (${o.sub})` : ""} ${o.price}`).join(" · ")}
    />
  );
}
