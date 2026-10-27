import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { sanitizeRail } from "@/lib/priority";
import { loadRail } from "@/lib/feeds";

/** The home rail's settings: the published file over the built-in ones (the built-in ones alone until it loads, or if it cannot). */
export function useRail() {
  const q = useQuery({ queryKey: ["rail"], queryFn: loadRail, staleTime: 10 * 60_000 });
  return useMemo(() => sanitizeRail(q.data), [q.data]);
}
