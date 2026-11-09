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
] }] };
let liveOn = true;
vi.mock("@/lib/queries", () => ({
  linesQuery: { queryKey: ["lines"], queryFn: async () => LINES },
  inplayQuery: { queryKey: ["inplay"], queryFn: async () => INPLAY },
}));
vi.mock("@/hooks/useLive", () => ({ useLiveDoc: () => ({ data: { matches: [{ status: liveOn ? "live" : "final" }] } }) }));
vi.mock("@/lib/data", () => ({
  useData: () => ({
    store: { teams: [{ n: "Bangladesh", g: 0 }, { n: "West Indies", g: 0 }], P: { id: ["p-rahim"], nm: ["Mushfiqur Rahim"] } },
    rz: { players: (name: string) => (/rahim/i.test(name) ? [{ idx: 0, score: 10 }] : []) },
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

describe("useLinesLive", () => {
  it("folds the live lines into the lines data while a match is on: the batter's line replaces the old one and is marked live, other markets go to `live`", async () => {
    liveOn = true;
    const { result } = renderHook(() => useLinesLive(), { wrapper });
    await waitFor(() => expect((result.current.data as any)?.live?.length).toBe(1));
    const d: any = result.current.data;
    expect(d.lines.map((l: any) => [l.pid, l.line, l.books[0].live])).toEqual([["p-rahim", 33.5, true]]);
    expect(d.lines[0].player).toBe("Mushfiqur Rahim");
    expect(d.live[0].markets[0].market).toBe("Runs in First 20 Overs");
  });

  it("is the plain lines data when no match is on, and never asks for in-play lines then", async () => {
    liveOn = false;
    const { result } = renderHook(() => useLinesLive(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect((result.current.data as any).live).toBeUndefined();
    expect((result.current.data as any).lines[0].line).toBe(25.5);
  });
});
