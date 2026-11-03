/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sideEdge } from "@cricket/engine/stats.js";
import { lineNotIn, lineStanding, liveForFixture } from "@cricket/engine/live.js";
import { hotOrder, otherHotCount, type HotScope } from "@site/lib/hot-lines";
import { lineHomePhase, type HomePhase } from "@site/lib/home-phase";
import { storeQuery } from "@/lib/data";
import { scoreHotRows, type Row } from "@/lib/hot";
import { sideRate, withModelSide } from "@/lib/model-side";
import { fixturesQuery, linesQuery, liveQuery } from "@/lib/queries";

/** The scored rows (see `scoreHotRows`) for a day (`{ day }`) or one match (`{ teams }`), put in the cache as they come. `scoring` is true while more are still arriving. */
export function useHotRows(scope?: HotScope, doc?: any) {
  const stats = useQuery(storeQuery), linesQ = useQuery(linesQuery), fixtures = useQuery(fixturesQuery);
  const lines = { data: doc ?? linesQ.data }; // `doc`: the book doc with an archived match added, for that match's own page
  const qc = useQueryClient();
  const what = !scope ? "none" : "day" in scope ? scope.day : scope.teams.join("|");
  const key = ["hot-rows", what, new Date().toDateString(), lines.data?.generated_at_utc, doc ? lines.data?.lines?.length : ""];
  const rows = useQuery({
    queryKey: key,
    enabled: !!scope && !!stats.data && !!lines.data && fixtures.isSuccess,
    staleTime: 10 * 60_000,
    queryFn: () => scoreHotRows({ ...stats.data!, lines: lines.data.lines || [], fixtures: fixtures.data!, scope: scope!, onRows: (r) => qc.setQueryData(key, r) }),
  });
  const day = scope && "day" in scope ? scope.day : -1;
  const otherDay = useMemo(() => (day >= 0 ? otherHotCount(lines.data?.lines || [], day) : 0), [lines.data, day]); // other days' lines, only counted
  // the store and the book file are idle until they are in: treat that as loading too, so an empty message never flashes
  return { ...rows, isLoading: !!scope && (rows.isLoading || (!rows.data && !rows.isError)), scoring: rows.isFetching, otherDay };
}

/** The rows ready to show: edge worked out, the live feed's word on each, and where a line stands so far. Ordered: matches in play, higher hit rate, higher edge. */
export function useHotView(scope?: HotScope, phase?: HomePhase, doc?: any) {
  const hot = useHotRows(scope, doc);
  const live = useQuery(liveQuery);
  const identity = useQuery(storeQuery).data?.identity;
  const matchOf = (r: Row) => { const [a, b] = String(r.match).split(/\s+vs\s+/i); return liveForFixture(live.data, { a, b, start: r.start, fmt: r.fmt }); };
  const asLine = (r: Row) => ({ pid: r.pid, player: r.name, book_name: r.bookName, team: r.team, stat: r.stat, line: r.line, inn: r.inn });
  const soFarOf = (r: Row) => lineStanding(matchOf(r), asLine(r), identity, { stored: r.stored, settled: r.settled });
  const outOf = (r: Row) => lineNotIn(matchOf(r), asLine(r), identity);
  const day = scope && "day" in scope ? scope.day : -1;
  const rows = useMemo(
    () => (hot.data || [])
      .map((r) => withModelSide(r))
      .filter((r) => (day < 0 || r.day === day) && (!phase || lineHomePhase(r, live.data) === phase))
      .sort((x, y) => hotOrder({ live: matchOf(x)?.status === "live", p: sideRate(x), edge: x.edge }, { live: matchOf(y)?.status === "live", p: sideRate(y), edge: y.edge })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hot.data, live.data, phase, day],
  );
  return { rows, isLoading: hot.isLoading, scoring: hot.scoring, error: hot.isError, otherDay: hot.otherDay, soFarOf, outOf, matchOf };
}
