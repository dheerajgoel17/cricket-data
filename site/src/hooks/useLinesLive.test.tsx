import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { useLinesLive } from "./useLinesLive";

const LINES = {
  lines: [{ pid: "p-rahim", player: "Mushfiqur Rahim", team: "Bangladesh", fmt: "Test", stat: "runs", line: 25.5, match: "Bangladesh vs West Indies", competition: "2nd Test", start_utc: "2026-11-05T03:00:00Z", books: [{ source: "bet365", kind: "bookmaker", over: 1.8, under: 1.9 }] }],
  fancy: [],
};
const INPLAY = { matches: [{ home: "Bangladesh", away: "West Indies", lines: [
  { kind: "player_runs", player: "M Rahim", line: 33.5, over: 1.8, under: 1.9 },
  { kind: "ou", market: "Runs in First 20 Overs", line: 68.5, over: null, under: 1.83 },
] }, { home: "Bangladesh", away: "Malaysia", kickoff: "2026-11-09T05:00:00Z", lines: [{ kind: "ou", market: "Runs in First 6 Overs", line: 8.5, over: 1.9, under: 1.8, book: "BookE" }] }] };
let liveOn = true;
// a live fixture no book priced before the start, named as the site names it (the books drop the U19)
const FIXTURES = [{ a: "Bangladesh U19", b: "Malaysia U19", start: "2026-11-09T05:00Z", fmt: "ODI", series: "U19 Asia Cup" }];
vi.mock("@/lib/queries", () => ({
  linesQuery: { queryKey: ["lines"], queryFn: async () => LINES },
  inplayQuery: { queryKey: ["inplay"], queryFn: async () => INPLAY },
}));
// the live match: Bangladesh batting, Rahim on 30 (past the 25.5 he was priced at before the start, so his live line takes over)
const LIVE_MATCH = { teams: [{ name: "Bangladesh", batting: true }, { name: "West Indies" }], players: [{ name: "Mushfiqur Rahim", team: "Bangladesh", runs: 30, balls: 40, out: false }], innings: [{ n: 1, team: "Bangladesh", runs: 90, wkts: 2, overs: 20 }] };
vi.mock("@/hooks/useLive", () => ({ useLiveDoc: () => ({ data: { matches: [{ ...LIVE_MATCH, status: liveOn ? "live" : "final" }] } }) }));
vi.mock("@/lib/data", () => ({
  useData: () => ({
    store: { teams: [{ n: "Bangladesh", g: 0 }, { n: "West Indies", g: 0 }], P: { id: ["p-rahim"], nm: ["Mushfiqur Rahim"] }, loadFixtures: async () => FIXTURES },
    rz: { players: (name: string) => (/rahim/i.test(name) ? [{ idx: 0, score: 10 }] : []) },
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

describe("useLinesLive", () => {
  it("folds the live lines into the lines data while a match is on: the batter's live line is his innings line, marked live, beside his match total, other markets go to `live`", async () => {
    liveOn = true;
    const { result } = renderHook(() => useLinesLive(), { wrapper });
    await waitFor(() => expect((result.current.data as any)?.live?.length).toBe(2));
    const d: any = result.current.data;
    // a Test: the live line is his side's 1st innings (counted from the live match), so his match-total line (25.5, no innings) stays beside it
    expect(d.lines.map((l: any) => [l.pid, l.line, l.inn ?? 0, !!l.books[0].live])).toEqual([["p-rahim", 25.5, 0, false], ["p-rahim", 33.5, 1, true]]);
    expect(d.lines[1].player).toBe("Mushfiqur Rahim");
    expect(d.live[0].markets[0].market).toBe("Runs in First 20 Overs");
    // the unpriced live match is matched to the site's fixture ("Bangladesh U19 v Malaysia U19") by its sides and start, and carries the site's names
    expect([d.live[1].home, d.live[1].away, d.live[1].fmt]).toEqual(["Bangladesh U19", "Malaysia U19", "ODI"]);
  });

  it("is the plain lines data when no match is on, and never asks for in-play lines then", async () => {
    liveOn = false;
    const { result } = renderHook(() => useLinesLive(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect((result.current.data as any).live).toBeUndefined();
    expect((result.current.data as any).lines[0].line).toBe(25.5);
  });
});
