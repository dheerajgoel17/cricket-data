import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { sanitizeRail } from "@/lib/priority";
import { railQuery } from "@/lib/queries";

/** The home rail's settings: the published file over the built-in ones (the built-in ones alone until it loads, or if it cannot). `settled` says the file has been read or given up on. */
export function useRail() {
  const q = useQuery(railQuery);
  return { rail: useMemo(() => sanitizeRail(q.data), [q.data]), settled: q.isFetched };
}
