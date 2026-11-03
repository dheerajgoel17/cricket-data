/* eslint-disable @typescript-eslint/no-explicit-any */
import { modelSide, sideRate as engineSideRate } from "@cricket/engine/props-view.js";
import type { Row } from "@/lib/hot";

/** The row with the model's projection on it (`edge` and `side`, from the shared `modelSide`): the better of the over and the under over his last 10 games. */
export function withModelSide(r: Row): Row {
  const { edge, side } = modelSide(r.l10, r.prior, r.over, r.under) as { edge: number | null; side: "over" | "under" };
  return { ...r, edge, side };
}

/** The hit rate on the side the model leans to (what the home order uses). */
export const sideRate = (r: Row): number | null => engineSideRate(r.l10.p, r.side ?? "over");
