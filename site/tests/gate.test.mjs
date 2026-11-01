import test from "node:test";
import assert from "node:assert/strict";
import { sign, verify } from "../api/gate.js";

test("gate cookie HMAC verifies and expires", () => {
  const secret = "ci-test-key";
  const ok = sign(secret, Math.floor(Date.now() / 1000) + 60);
  assert.equal(verify(secret, ok), true);
  assert.equal(verify("other", ok), false);
  assert.equal(verify(secret, sign(secret, Math.floor(Date.now() / 1000) - 10)), false);
});

import { fromOurPage } from "../packages/engine/guard.js";
const hdr = (o) => (h) => o[h];
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const OLD_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1";

test("the data gate answers a request from our own page, not a script that only borrows a browser's User-Agent", () => {
  assert.equal(fromOurPage(hdr({ "sec-fetch-site": "same-origin", "user-agent": CHROME })), true);
  assert.equal(fromOurPage(hdr({ "sec-fetch-site": "cross-site", "user-agent": CHROME })), false); // another site's page
  assert.equal(fromOurPage(hdr({ "user-agent": CHROME })), false); // Chrome always says where it came from; a script with its UA does not
  assert.equal(fromOurPage(hdr({ "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0" })), false);
  assert.equal(fromOurPage(hdr({ "user-agent": OLD_SAFARI })), true); // Safari before 16.4 sends none, and is let through
  assert.equal(fromOurPage(hdr({})), true); // no UA at all is refused elsewhere (the bot list), not here
});
