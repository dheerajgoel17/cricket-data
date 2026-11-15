import { QueryClient } from "@tanstack/react-query";
import { createStore } from "@cricket/engine/store.js";
import { storeQuery } from "@/lib/data";

jest.mock("@cricket/engine/store.js", () => ({ createStore: jest.fn() }));
jest.mock("@cricket/engine/identity.js", () => ({ identityIndex: () => ({}) }));
jest.mock("@cricket/engine/resolve.js", () => ({ Resolver: Object.assign(class {}, { create: (): Promise<object> => Promise.resolve({}) }) }));
jest.mock("@/lib/net", () => ({ getJson: async () => ({}), setDataBuild: jest.fn() }));
jest.mock("@/lib/perf", () => ({ mark: jest.fn(), span: jest.fn(), timed: (_n: string, fn: () => unknown) => fn() }));

const settle = () => new Promise((r) => setTimeout(r, 20));

test("warm matches stay ready when resolved before the initial query is cached", async () => {
  const client = new QueryClient();
  const store = { P: { id: ["p"] }, M: { id: ["m"] }, ready: Promise.resolve() };
  jest.mocked(createStore).mockResolvedValueOnce(store as never);
  const data = await client.fetchQuery(storeQuery);
  expect(data.matchesReady).toBe(true);
  await settle();
  expect(client.getQueryData(storeQuery.queryKey)).toMatchObject({ matchesReady: true });
  client.clear();
});

test("late matches publish readiness to every store observer", async () => {
  const client = new QueryClient();
  let finish!: () => void;
  const store = { P: { id: ["p"] }, M: null as unknown, ready: new Promise<void>((r) => { finish = r; }) };
  jest.mocked(createStore).mockResolvedValueOnce(store as never);
  expect((await client.fetchQuery(storeQuery)).matchesReady).toBe(false);
  store.M = { id: ["m"] };
  finish();
  await settle();
  expect(client.getQueryData(storeQuery.queryKey)).toMatchObject({ matchesReady: true });
  client.clear();
});

test("failed matches report an error without opening the history gate", async () => {
  const client = new QueryClient();
  let fail!: (error: Error) => void;
  const store = { P: { id: ["p"] }, M: null, ready: new Promise<void>((_, reject) => { fail = reject; }) };
  jest.mocked(createStore).mockResolvedValueOnce(store as never);
  await client.fetchQuery(storeQuery);
  fail(new Error("offline"));
  await settle();
  expect(client.getQueryData(storeQuery.queryKey)).toMatchObject({ matchesReady: false, matchesError: new Error("offline") });
  client.clear();
});
