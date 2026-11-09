import test from "node:test";
import assert from "node:assert/strict";
import { PROFILES, pickProfile, chForUa, upstreamHeaders } from "../../relay/browser.js";

test("browser profiles: every pick is a Chromium-in-India fingerprint", () => {
  assert.ok(PROFILES.length >= 4);
  for (let i = 0; i < 20; i++) {
    const p = pickProfile(() => i / 20);
    assert.match(p.ua, /Chrome\/\d+/);
    assert.match(p.lang, /en-IN|hi/);
    assert.match(p.ch, /Chrome/);
  }
});

test("chForUa follows the Chrome major in a caller UA", () => {
  assert.match(chForUa("Mozilla/5.0 Chrome/129.0.0.0 Safari/537.36", "x"), /v="129"/);
});

test("upstreamHeaders forwards a book's session cookie and headers", () => {
  const h = upstreamHeaders(new URL("https://book.example/a"), (name) => ({
    "x-relay-cookie": "csrf=abc",
    "x-relay-csrf": "abc",
    "x-relay-ct": "12",
    "x-relay-ct-d": "34",
    "x-relay-accept": "text/html",
    "x-relay-dest": "document", "x-relay-mode": "navigate", "x-relay-site": "none",
  }[name] || ""), false, "");
  assert.equal(h.Cookie, "csrf=abc");
  assert.equal(h["X-CSRF-Token"], "abc");
  assert.equal(h["x-ct"], "12");
  assert.equal(h["x-ct-d"], "34");
  assert.equal(h.Accept, "text/html");
  assert.equal(h["Sec-Fetch-Dest"], "document");
  assert.equal(h["Sec-Fetch-Mode"], "navigate");
  assert.equal(h["Sec-Fetch-Site"], "none");
});

test("upstreamHeaders rotate UA when the caller does not override", () => {
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const h = upstreamHeaders(new URL("https://book.example/a"), () => "", false, "");
    seen.add(h["User-Agent"]);
    assert.equal(h.Origin, "https://book.example");
    assert.equal(h["Sec-Fetch-Site"], "same-site");
  }
  assert.ok(seen.size >= 2, "expected more than one UA across calls");
});
