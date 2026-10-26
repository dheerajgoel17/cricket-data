/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { runPlan } from "@/engine/plan.js";
import { useData } from "@/lib/data";

/** Runs an engine plan (cached by plan + hints). Every number the pages show comes from this, never from an LLM. */
export function useRunPlan(plan: any, hints: any = {}, enabled = true) {
  const { store, rz } = useData();
  return useQuery({ queryKey: ["plan", JSON.stringify(plan), JSON.stringify(hints)], queryFn: () => runPlan(store, rz, plan, hints) as Promise<any>, enabled });
}

export function useFixtures() {
  const { store } = useData();
  return useQuery({ queryKey: ["fixtures"], queryFn: () => store.loadFixtures() as Promise<any[]> });
}

/** Fixtures that have not finished yet (4 h grace after the start). */
export const upcomingOnly = (fx: any[]) => { const cut = new Date(Date.now() - 4 * 3600e3).toISOString(); return fx.filter((f) => (f.start.length > 10 ? f.start : `${f.start}T23:59Z`) >= cut); };
