import test from "node:test";
import assert from "node:assert/strict";
import { CRAWLER } from "../middleware.js";

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
