import test from "node:test";
import assert from "node:assert/strict";
import { clearedHits, fancyWords, messages, propAlerts, MAX_LINES } from "@cricket/engine/alerts.js";
import { postAlerts } from "@cricket/engine/alert-post.js";
import { claimAlerts, releaseAlerts } from "@cricket/engine/alert-claims.js";
import { lineBelongs } from "@cricket/engine/live.js";
import { sendMessage } from "@cricket/engine/telegram.js";
import { alertMode } from "../../state/worker.js";

const START = "2026-11-01T09:00:00Z", NOW = Date.parse("2026-11-01T10:30:00Z");
const base = { match: "India vs Australia", start_utc: START, fmt: "T20" };
const player = (pid, name, stat, line, books) => ({ ...base, pid, player: name, stat, line, books });
const fancy = (key, line, over, source, extra = {}) => ({ ...base, key, scope: "match", team: null, line, over, under: 1.5, source, ...extra });
const live = (o = {}) => ({
  teams: [{ name: "India" }, { name: "Australia" }], start: START, fmt: "T20", status: "live", series: "Tri-series",
  innings: [{ n: 1, team: "India", runs: 180, wkts: 5, fours: 14, sixes: 9, overs: 20 }, { n: 2, team: "Australia", runs: 60, wkts: 2, fours: 5, sixes: 4, overs: 7 }],
  lines: [
    { pid: "a1", stat: "runs", line: 28.5, value: 31, state: "live", verdict: "cleared" },
    { pid: "a2", stat: "sixes", line: 1.5, value: 2, state: "out", verdict: "cleared" }, // best over 2.49: just under the bar
    { pid: "a3", stat: "wickets", line: 1.5, value: 1, state: "live", verdict: null }, // not cleared yet
    { pid: "a4", stat: "runs", line: 19.5, value: 22, state: "final", verdict: "cleared" }, // best over exactly 2.50
    { pid: "a5", stat: "runs", line: 9.5, value: 4, state: "final", verdict: "missed" },
  ],
  ...o,
});
const books = {
  lines: [
    player("a1", "A One", "runs", 28.5, [{ source: "bet365", over: 3.2, under: 1.3 }, { source: "LeoVegas", over: 3.4, under: 1.25 }]),
    player("a2", "A Two", "sixes", 1.5, [{ source: "bet365", over: 2.49, under: 1.5 }]),
    player("a3", "A Three", "wickets", 1.5, [{ source: "bet365", over: 4, under: 1.2 }]),
    player("a4", "A Four", "runs", 19.5, [{ source: "bet365", over: 2.5, under: 1.5 }, { source: "LeoVegas", over: 2.4, under: 1.55 }]),
    player("a5", "A Five", "runs", 9.5, [{ source: "bet365", over: 5, under: 1.1 }]),
    { ...player("a1", "A One", "runs", 28.5, [{ source: "bet365", over: 9, under: 1.1 }]), match: "England vs Pakistan" }, // another match: never read
  ],
  fancy: [
    fancy("match_sixes", 12.5, 2.6, "bet365"), fancy("match_sixes", 12.5, 2.8, "LeoVegas"), // one market, best price 2.80, 9 + 4 = 13 sixes so far
    fancy("team_total_runs", 150.5, 2.0, "bet365", { scope: "team", team: "India" }), // cleared (180) but only 2.00
    fancy("match_fours", 30.5, 3.0, "bet365"), // 14 + 5 = 19 fours: not cleared
    { ...fancy("match_sixes", 3.5, 5, "bet365"), match: "England vs Pakistan" },
  ],
};

test("clearedHits: only cleared lines whose best over price is 2.50 or longer, longest first, one entry per line", () => {
  const hits = clearedHits([live()], books);
  assert.deepEqual(hits.map((h) => [h.what, h.so, h.final, h.over, h.book]), [
    ["A One over 28.5 runs", 31, false, 3.4, "LeoVegas"],
    ["Match sixes over 12.5", 13, false, 2.8, "LeoVegas"],
    ["A Four over 19.5 runs", 22, true, 2.5, "bet365"],
  ]);
  assert.equal(hits[0].key, "hit|australia|india|T20|2026-11-01|p|a1|runs|28.5|0");
  assert.equal(hits[1].key, "hit|australia|india|T20|2026-11-01|f|match_sixes||0|12.5");
  assert.equal(new Set(hits.map((h) => h.matchKey)).size, 1);
});

test("clearedHits: a match with no two sides or no start is skipped, and a missing book file gives nothing", () => {
  assert.deepEqual(clearedHits([live({ teams: [{ name: "India" }] })], books), []);
  assert.deepEqual(clearedHits([live({ start: "" })], books), []);
  assert.deepEqual(clearedHits([live()], {}), []);
  assert.deepEqual(clearedHits(undefined, books), []);
});

test("a Test innings line is its own key and is read against the innings line's price", () => {
  const m = live({ fmt: "Test", lines: [{ pid: "a1", stat: "runs", line: 28.5, inn: 2, value: 40, state: "out", verdict: "cleared" }] });
  const b = { lines: [{ ...player("a1", "A One", "runs", 28.5, [{ source: "bet365", over: 2.6, under: 1.5 }]), inn: 2, fmt: "Test" }, player("a1", "A One", "runs", 28.5, [{ source: "bet365", over: 1.9, under: 1.9 }])] };
  const [h] = clearedHits([m], b);
  assert.equal(h.over, 2.6); // the match-total line at 1.90 is another bet
  assert.match(h.what, /\(2nd innings\)$/);
  assert.match(h.key, /\|28\.5\|2$/);
});

test("fancyWords names a market the way the site does", () => {
  assert.equal(fancyWords({ key: "match_sixes" }), "Match sixes");
  assert.equal(fancyWords({ key: "overs_6", team: "India" }), "India first 6 overs runs");
  assert.equal(fancyWords({ key: "first_over" }), "1st over runs");
  assert.equal(fancyWords({ key: "team_total_fours", team: "India", inn: 1 }), "India fours (1st innings)");
});

test("lineBelongs: the same two sides and a start within 14 hours, or 6 days for a Test", () => {
  const m = live();
  assert.equal(lineBelongs(m, { match: "Australia vs India", start_utc: "2026-11-01T20:00:00Z" }), true); // 11 h, sides in the other order
  assert.equal(lineBelongs(m, { match: "India vs Australia", start_utc: "2026-11-02T08:00:00Z" }), false); // 23 h
  assert.equal(lineBelongs(m, { match: "India vs England", start_utc: START }), false);
  assert.equal(lineBelongs(live({ fmt: "Test" }), { match: "India vs Australia", start_utc: "2026-11-05T09:00:00Z", fmt: "Test" }), true);
});

test("messages: one message per match for hits, stats wording, escaped, with no stake advice", () => {
  const hits = clearedHits([live()], { lines: [...books.lines.slice(0, 1), player("a4", "A <Four> & Co", "runs", 19.5, [{ source: "bet365", over: 2.5, under: 1.5 }])], fancy: [] });
  const [m] = messages(hits);
  assert.equal(messages(hits).length, 1);
  assert.deepEqual(m.keys, hits.map((h) => h.key));
  assert.equal(m.text, [
    "✅ <b>High-odds lines cleared</b>",
    "India v Australia · T20 · Tri-series",
    "",
    "• A One over 28.5 runs: 31 so far · listed 3.40 (LeoVegas)",
    "• A &lt;Four&gt; &amp; Co over 19.5 runs: 22 final · listed 2.50 (bet365)",
    "",
    "Cricket stats from the live scorecard, not advice.",
  ].join("\n"));
  assert.doesNotMatch(m.text, /stake|bet on|tip/i);
  assert.match(messages(hits, { siteUrl: "https://site.test" })[0].text, /<a href="https:\/\/site\.test">Open the site<\/a>$/);
});

test("messages: more than MAX_LINES lines of one match go out in more than one message (8 + 2)", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ kind: "hit", key: `k${i}`, matchKey: "m", match: "A v B", fmt: "T20", series: "", what: `P${i} over 1.5 runs`, so: 2, final: false, over: 3, book: "" }));
  assert.equal(MAX_LINES, 8);
  assert.deepEqual(messages(items).map((m) => m.keys.length), [8, 2]);
  assert.match(messages(items)[1].text, /High-odds lines cleared/);
  assert.match(messages(items.slice(0, 1))[0].text, /High-odds line cleared/); // singular for one
});

const alert = (o = {}) => ({ alert_id: "id1", selection: "Ellyse Perry under 28.5", market: "Ellyse Perry - Over/Under 28.5 Runs", match: "Sydney Sixers vs Hobart Hurricanes", format: "T20",
  start_utc: "2026-11-01T12:00:00Z", start_ist: "2026-11-01 17:30 IST", best_odds: 1.83, best_source: "feede_lb", fair_odds: 1.734, edge_pct: 5.53, kelly_quarter_stake_pct: 1.67,
  why: "Model 63% vs market 54% for under 28.5 runs; form 31.0 runs/inn", realert: false, ...o });

test("propAlerts: the pipeline's alerts as model-edge text, with no stake and no internal feed name", () => {
  const [a] = propAlerts({ alerts: [alert()] }, NOW);
  assert.equal(a.key, "prop|id1");
  assert.equal(a.text, [
    "📊 <b>Model edge +5.5%</b>",
    "Ellyse Perry under 28.5 runs",
    "Sydney Sixers v Hobart Hurricanes · T20 · 2026-11-01 17:30 IST",
    "Listed 1.83 · model fair price 1.73",
    "Model 63% vs market 54% for under 28.5 runs; form 31.0 runs/inn",
  ].join("\n"));
  assert.doesNotMatch(a.text, /1\.67|stake|kelly|feede/i);
  assert.match(propAlerts({ alerts: [alert({ best_source: "feedx_bet365" })] }, NOW)[0].text, /Listed 1\.83 \(bet365\)/);
  assert.match(propAlerts({ alerts: [alert({ realert: true })] }, NOW)[0].text, /Edge grew to \+5\.5%/);
  assert.match(messages(propAlerts({ alerts: [alert()] }, NOW))[0].text, /Model output from past data, not advice\.$/);
});

test("propAlerts: a started match, a missing id or price is left out, the biggest edge first, a long reason is cut", () => {
  const list = propAlerts({ alerts: [alert({ alert_id: "late", start_utc: "2026-11-01T10:00:00Z" }), alert({ alert_id: "" }), alert({ alert_id: "nop", best_odds: null }),
    alert({ alert_id: "small", edge_pct: 5.1 }), alert({ alert_id: "big", edge_pct: 12.34, why: "word ".repeat(80) })] }, NOW);
  assert.deepEqual(list.map((a) => a.key), ["prop|big", "prop|small"]);
  assert.match(list[0].text, /word…\n?/);
  assert.ok(list[0].text.split("\n").at(-1).length <= 221);
  assert.deepEqual(propAlerts(undefined, NOW), []);
});

test("a player line carries its card (by id, whole-match lines only); a fancy line and a Test innings line have none", () => {
  const hits = clearedHits([live()], books);
  assert.deepEqual(hits[0].image, { pid: "a1", stat: "runs", line: 28.5 });
  assert.equal(hits[1].image, undefined); // the fancy line
  const inn = clearedHits([live({ fmt: "Test", lines: [{ pid: "a1", stat: "runs", line: 28.5, inn: 2, value: 40, state: "out", verdict: "cleared" }] })], { lines: [{ ...player("a1", "A One", "runs", 28.5, [{ source: "bet365", over: 2.6 }]), inn: 2, fmt: "Test" }] });
  assert.equal(inn[0].image, undefined);
});

test("messages: the picture is the card of the first player line, as an address on the site; no site address, no picture", () => {
  const hits = clearedHits([live()], books);
  assert.equal(messages(hits, { siteUrl: "https://site.test/" })[0].image, "https://site.test/card/v14/pid/a1/runs/28.5.jpg");
  assert.equal(messages(hits)[0].image, "");
  assert.equal(messages(hits.filter((h) => !h.image), { siteUrl: "https://site.test" })[0].image, ""); // only a fancy line: text alone
});

test("propAlerts: the card is found by his name, line and stat in the book file; a milestone market or an unknown name has none", () => {
  const a = alert({ market_type: "batter_runs", player_matched_as: "A One", line: 28.5, match: "India vs Australia", format: "T20", start_utc: "2026-11-01T12:00:00Z" });
  assert.deepEqual(propAlerts({ alerts: [a] }, NOW, books)[0].image, { pid: "a1", stat: "runs", line: 28.5 });
  assert.equal(propAlerts({ alerts: [a] }, NOW)[0].image, undefined); // no book file
  assert.equal(propAlerts({ alerts: [{ ...a, market_type: "batter_milestone" }] }, NOW, books)[0].image, undefined);
  assert.equal(propAlerts({ alerts: [{ ...a, player_matched_as: "Nobody" }] }, NOW, books)[0].image, undefined);
  assert.equal(propAlerts({ alerts: [{ ...a, match: "India vs England" }] }, NOW, books)[0].image, undefined); // his line is for another match
  assert.equal(messages(propAlerts({ alerts: [a] }, NOW, books), { siteUrl: "https://site.test" })[0].image, "https://site.test/card/v14/pid/a1/runs/28.5.jpg");
});

// ---------------------------------------------------------------------------------------------- the run, with a fake claim table and a fake Telegram
const TOKEN = "123456:SECRET-bot-token", DB = { base: "https://db.test", key: "pub", token: "write-tok" };
function world({ tgStatus = 200, tgBody = {}, dbDown = false, tgThrow = false, photoStatus = 200 } = {}) {
  const sent = new Set(), posts = [], calls = [], w = { sent, posts, calls, tgStatus, photoStatus };
  w.fetchImpl = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push(url.replace(/^https?:\/\/[^/]+/, ""));
    if (url.startsWith("https://api.telegram.org/")) {
      if (tgThrow) throw new Error(`fetch failed for ${url}`);
      const photo = url.endsWith("/sendPhoto");
      if (photo && w.photoStatus !== 200) return { ok: false, status: w.photoStatus, json: async () => ({ description: "Bad Request: failed to get HTTP URL content", parameters: w.photoStatus === 429 ? { retry_after: 3 } : undefined }) };
      if (w.tgStatus !== 200) return { ok: false, status: w.tgStatus, json: async () => tgBody };
      posts.push({ ...body, method: photo ? "sendPhoto" : "sendMessage" }); return { ok: true, status: 200, json: async () => ({}) };
    }
    if (dbDown) return { ok: false, status: 404, json: async () => null };
    if (url.endsWith("/claim_alerts")) {
      const fresh = [...new Set(body.keys)].filter((k) => !sent.has(k));
      if (!body.dry) fresh.forEach((k) => sent.add(k));
      return { ok: true, status: 200, json: async () => fresh };
    }
    if (url.endsWith("/release_alerts")) { body.keys.forEach((k) => sent.delete(k)); return { ok: true, status: 200, json: async () => ({ released: body.keys.length }) }; }
    throw new Error(`unexpected ${url}`);
  };
  return w;
}
const run = (w, o = {}) => postAlerts({ matches: [live()], booksDoc: books, propsDoc: { alerts: [alert()] }, telegram: { token: TOKEN, chat: "@chan" }, db: DB, now: NOW, fetchImpl: w.fetchImpl, ...o });

test("a run posts the hits (one message) and the prop alert once, and the next run with the same data posts nothing", async () => {
  const w = world();
  const first = await run(w);
  assert.deepEqual(first, { candidates: 4, fresh: 4, sent: 2 });
  assert.equal(w.posts.length, 2);
  assert.equal(w.posts[0].chat_id, "@chan");
  assert.equal(w.posts[0].parse_mode, "HTML");
  assert.match(w.posts[0].text, /High-odds lines cleared/);
  assert.match(w.posts[1].text, /Model edge \+5\.5%/);
  assert.deepEqual(await run(w), { candidates: 4, fresh: 0, sent: 0 });
  assert.equal(w.posts.length, 2);
  // a line that clears later is new
  const more = live({ lines: [...live().lines, { pid: "a3", stat: "wickets", line: 1.5, value: 2, state: "live", verdict: "cleared" }] });
  assert.equal((await run(w, { matches: [more] })).sent, 1);
  assert.match(w.posts[2].text, /A Three over 1\.5 wickets: 2 so far · listed 4\.00 \(bet365\)/);
  assert.doesNotMatch(w.posts[2].text, /A One/);
});

test("preview builds what is new, sends nothing and marks nothing", async () => {
  const w = world();
  const p = await run(w, { mode: "preview", telegram: undefined });
  assert.equal(p.fresh, 4);
  assert.equal(p.sent, 0);
  assert.equal(p.messages.length, 2);
  assert.equal(w.posts.length, 0);
  assert.equal(w.sent.size, 0);
  assert.equal((await run(w)).sent, 2); // the real run still finds everything new
});

test("a message Telegram refuses is handed back and tried again on the next run", async () => {
  const bad = world({ tgStatus: 500, tgBody: { description: "oops" } });
  const r = await run(bad);
  assert.equal(r.sent, 0);
  assert.match(r.error, /Telegram HTTP 500: oops/);
  assert.equal(bad.sent.size, 0); // all four keys released
  bad.tgStatus = 200; // Telegram is back: the same alerts go out now
  assert.equal((await run(bad)).sent, 2);
  assert.equal(bad.posts.length, 2);
  assert.equal(bad.sent.size, 4);
});

test("a 429 stops the run after the first refusal and releases every unsent key", async () => {
  const w = world({ tgStatus: 429, tgBody: { description: "Too Many Requests: retry after 5", parameters: { retry_after: 5 } } });
  const r = await run(w);
  assert.equal(r.sent, 0);
  assert.match(r.error, /429/);
  assert.equal(w.sent.size, 0);
  assert.equal(w.calls.filter((c) => c.startsWith("/bot")).length, 1); // it did not go on to the second message
});

test("at most maxMessages go out per run: the rest are released and follow on the next run", async () => {
  const w = world();
  const r = await run(w, { maxMessages: 1 });
  assert.equal(r.sent, 1);
  assert.equal(w.sent.size, 3); // the hits' three keys are claimed; the prop's key was given back
  const r2 = await run(w, { maxMessages: 1 });
  assert.equal(r2.sent, 1);
  assert.match(w.posts[1].text, /Model edge/);
});

test("with the claim table unreachable nothing is posted", async () => {
  const w = world({ dbDown: true });
  const r = await run(w);
  assert.equal(r.sent, 0);
  assert.match(r.error, /claim failed: claim_alerts -> HTTP 404/);
  assert.equal(w.posts.length, 0);
});

test("the bot token is never in a result, an error or a thrown message", async () => {
  for (const w of [world({ tgThrow: true }), world({ tgStatus: 401, tgBody: { description: "Unauthorized" } })]) {
    const r = await run(w);
    assert.doesNotMatch(JSON.stringify(r), /SECRET/);
    assert.ok(r.error);
  }
  await assert.rejects(sendMessage({ token: TOKEN, chat: "@c", text: "x", fetchImpl: async (u) => { throw new Error(`boom ${u}`); } }), (e) => !/SECRET/.test(e.message) && /unreachable/.test(e.message));
});

test("no candidates, no calls", async () => {
  const w = world();
  assert.deepEqual(await run(w, { matches: [], propsDoc: {} }), { candidates: 0, fresh: 0, sent: 0 });
  assert.equal(w.calls.length, 0);
});

test("sendMessage posts HTML without a link preview and reports Telegram's retry-after", async () => {
  let seen;
  await sendMessage({ token: "t", chat: "@c", text: "<b>x</b>", fetchImpl: async (u, i) => { seen = { u, b: JSON.parse(i.body) }; return { ok: true, status: 200 }; } });
  assert.equal(seen.u, "https://api.telegram.org/bott/sendMessage");
  assert.deepEqual(seen.b, { chat_id: "@c", text: "<b>x</b>", parse_mode: "HTML", disable_web_page_preview: true });
  await assert.rejects(sendMessage({ token: "t", chat: "@c", text: "x", fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ description: "slow down", parameters: { retry_after: 7 } }) }) }), (e) => e.status === 429 && e.retryAfter === 7);
});

test("claimAlerts only returns keys it was asked about, claims nothing for an empty list, and a refused call throws", async () => {
  let n = 0;
  const f = (out, ok = true) => async () => { n++; return { ok, status: ok ? 200 : 403, json: async () => out }; };
  assert.deepEqual(await claimAlerts({ keys: ["a", "b"], ...DB, fetchImpl: f(["a", "zzz"]) }), ["a"]);
  assert.deepEqual(await claimAlerts({ keys: ["a"], ...DB, fetchImpl: f(null) }), []);
  const before = n;
  assert.deepEqual(await claimAlerts({ keys: [], ...DB, fetchImpl: f([]) }), []);
  await releaseAlerts({ keys: [], ...DB, fetchImpl: f({}) });
  assert.equal(n, before);
  await assert.rejects(claimAlerts({ keys: ["a"], ...DB, fetchImpl: f(null, false) }), /HTTP 403/);
});

test("the Worker posts only with a bot and a channel; a preview needs neither", () => {
  assert.equal(alertMode({}, "post"), "off");
  assert.equal(alertMode({ TELEGRAM_BOT_TOKEN: "t" }, "post"), "off");
  assert.equal(alertMode({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "@c" }, "post"), "post");
  assert.equal(alertMode({}, "preview"), "preview");
  assert.equal(alertMode({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "@c" }, "off"), "off");
  assert.equal(alertMode({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "@c" }, "nonsense"), "off");
});

test("with the site address known, a message with a player line goes out as a photo with the text as caption, a text-only one as a message", async () => {
  const w = world();
  assert.deepEqual(await run(w, { siteUrl: "https://site.test", propsDoc: {} }), { candidates: 3, fresh: 3, sent: 1 });
  assert.equal(w.posts[0].method, "sendPhoto");
  assert.equal(w.posts[0].photo, "https://site.test/card/v14/pid/a1/runs/28.5.jpg");
  assert.match(w.posts[0].caption, /^✅ <b>High-odds lines cleared<\/b>/);
  assert.equal(w.posts[0].text, undefined);
  const fancyOnly = world();
  await run(fancyOnly, { siteUrl: "https://site.test", propsDoc: {}, matches: [live({ lines: [] })] });
  assert.equal(fancyOnly.posts[0].method, "sendMessage"); // only the fancy line cleared: no player card
  assert.equal(fancyOnly.posts[0].link_preview_options, undefined);
  assert.equal(fancyOnly.posts[0].disable_web_page_preview, true);
});

test("the prop alert goes out with its player's card", async () => {
  const w = world();
  const a = alert({ market_type: "batter_runs", player_matched_as: "A One", line: 28.5, match: "India vs Australia", start_utc: "2026-11-01T12:00:00Z" });
  await run(w, { siteUrl: "https://site.test", matches: [], propsDoc: { alerts: [a] } });
  assert.equal(w.posts[0].method, "sendPhoto");
  assert.equal(w.posts[0].photo, "https://site.test/card/v14/pid/a1/runs/28.5.jpg");
  assert.match(w.posts[0].caption, /Model edge \+5\.5%/);
});

test("a picture Telegram cannot fetch (400) costs the picture, not the alert; a 429 on the photo still stops the run", async () => {
  const w = world({ photoStatus: 400 });
  const r = await run(w, { siteUrl: "https://site.test", propsDoc: {} });
  assert.deepEqual(r, { candidates: 3, fresh: 3, sent: 1 });
  assert.equal(w.posts.length, 1);
  assert.equal(w.posts[0].method, "sendMessage");
  assert.match(w.posts[0].text, /A One over 28\.5 runs: 31 so far/);
  const slow = world({ photoStatus: 429 });
  const r2 = await run(slow, { siteUrl: "https://site.test", propsDoc: {} });
  assert.equal(r2.sent, 0);
  assert.match(r2.error, /429/);
  assert.equal(slow.sent.size, 0); // given back
});

test("a text too long for a caption goes as a message with the picture above it", async () => {
  const w = world();
  const long = Array.from({ length: 8 }, (_, i) => player(`b${i}`, `${"A Very Long Player Name ".repeat(3)}${i}`, "runs", 20.5, [{ source: "bet365", over: 3 + i / 10, under: 1.3 }]));
  const m = live({ lines: long.map((l) => ({ pid: l.pid, stat: "runs", line: 20.5, value: 25, state: "live", verdict: "cleared" })) });
  await run(w, { siteUrl: "https://site.test", propsDoc: {}, matches: [m], booksDoc: { lines: long, fancy: [] } });
  assert.equal(w.posts[0].method, "sendMessage");
  assert.ok(w.posts[0].text.length > 1024); // over the caption limit
  assert.equal(w.posts[0].link_preview_options.url, "https://site.test/card/v14/pid/b7/runs/20.5.jpg");
  assert.equal(w.posts[0].link_preview_options.show_above_text, true);
});
