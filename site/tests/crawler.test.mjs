import test from "node:test";
import assert from "node:assert/strict";
import middleware, { CRAWLER, crawlerSharePath } from "../middleware.js";
import { ASSISTANT_UA, BOT_UA } from "../packages/engine/guard.js";

const yes = [
  "Twitterbot/1.0",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Facebot",
  "WhatsApp/2.23.20.0",
  "TelegramBot (like TwitterBot)",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  "LinkedInBot/1.0 (compatible; Mozilla/5.0)",
  "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
  "Pinterest/0.2",
  "Mozilla/5.0 (Twitterbot/1.0) SkypeUriPreview Preview/0.5",
  "Mozilla/5.0 (compatible; Embedly/0.2)",
  "Iframely/1.0",
  "Redditbot/1.0",
  "vkShare",
  "Tumblr/1.0",
  "bitlybot/2.0",
  "FlipboardProxy/1.0",
  "Cardyb/1.0",
  "http.rb/5.2.0 (Mastodon/4.2.0; +https://example.social/)",
  "Mozilla/5.0 (compatible; MicrosoftPreview/2.0)",
  "Viber",
  "facebookexternalhit/1.1; Line/12.0",
];
const no = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Googlebot/2.1 (+http://www.google.com/bot.html)",
  "curl/8.0.0",
  "python-requests/2.31.0",
];

test("link-preview crawlers of every app we care about get the share HTML; browsers and search indexers do not", () => {
  for (const ua of yes) assert.equal(CRAWLER.test(ua), true, ua);
  for (const ua of no) assert.equal(CRAWLER.test(ua), false, ua);
});

test("a copied player page with a line in the query still names that prop", () => {
  assert.equal(crawlerSharePath(new URL("https://x.test/player/12?stat=runs&line=24.5")), "player/12/runs/24.5");
  assert.equal(crawlerSharePath(new URL("https://x.test/player/12")), "player/12");
  assert.equal(crawlerSharePath(new URL("https://x.test/fixture/a-v-b")), "fixture/a-v-b");
});

const assistants = [
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
  "Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
  "Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +searchbot@anthropic.com)",
  "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  "Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
  "Mozilla/5.0 (compatible; DuckAssistBot/1.2; +https://duckduckgo.com/duckassistbot)",
];
const scrapers = [
  "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)",
  "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  "CCBot/2.0 (https://commoncrawl.org/faq/)",
  "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
  "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
  "python-requests/2.31.0",
  "axios/1.6.0",
  "node-fetch/1.0",
  "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0 Safari/537.36",
  "Scrapy/2.11 (+https://scrapy.org)",
];
const people = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0",
];

test("AI assistants get the share HTML; training crawlers, SEO tools and scripts are refused on /data and /api; people are neither", () => {
  for (const ua of assistants) { assert.equal(ASSISTANT_UA.test(ua), true, ua); assert.equal(CRAWLER.test(ua), true, ua); assert.equal(BOT_UA.test(ua), false, ua); }
  for (const ua of scrapers) { assert.equal(BOT_UA.test(ua), true, ua); assert.equal(ASSISTANT_UA.test(ua), false, ua); assert.equal(CRAWLER.test(ua), false, ua); }
  for (const ua of people) { assert.equal(BOT_UA.test(ua), false, ua); assert.equal(ASSISTANT_UA.test(ua), false, ua); assert.equal(CRAWLER.test(ua), false, ua); }
});

const call = (path, ua, headers = {}) => middleware(new Request(`https://x.test${path}`, { headers: { "user-agent": ua, ...headers } }));

test("middleware: an assistant is refused on /data, /api and the gate; a training crawler is refused on /data; a person with the page's headers passes the UA checks", async () => {
  for (const path of ["/data/lines.json", "/api/live", "/api/gate"]) assert.equal((await call(path, assistants[0])).status, 403, path);
  assert.equal((await call("/data/lines.json", scrapers[0])).status, 403);
  assert.equal((await call("/api/live", scrapers[6])).status, 403);
  assert.equal(await call("/data/meta.json", people[0], { "sec-fetch-site": "same-origin" }), undefined);
});
