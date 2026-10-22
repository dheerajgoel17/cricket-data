// POST /api/ask {question} -> {plan, model}. Turns a free-text question into a query plan with the Gemini free tier.
// The model never sees data and never supplies numbers; the browser runs the validated plan on the real rows.
// Needs the GEMINI_API_KEY environment variable (Vercel project settings). Without it the site uses its built-in parser.
import { buildPrompt } from "../public/js/engine/prompt.js";
import { sanitizePlan } from "../public/js/engine/plan.js";

const MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite,gemini-2.5-flash").split(",").map((s) => s.trim()).filter(Boolean);
const PER_MINUTE = Number(process.env.ASK_PER_MINUTE || 12);
const DAILY_CAP = Number(process.env.ASK_DAILY_CAP || 800);
const hits = new Map();
let day = { d: "", n: 0 };

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  const d = new Date().toISOString().slice(0, 10);
  if (day.d !== d) day = { d, n: 0 };
  day.n++;
  return arr.length > PER_MINUTE || day.n > DAILY_CAP;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "AI parsing is not configured; using the built-in parser" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 300) : "";
  if (!question) return res.status(400).json({ error: "question required" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  if (limited(ip)) return res.status(429).json({ error: "rate limit; using the built-in parser" });

  const { system, user } = buildPrompt(question, new Date().toISOString().slice(0, 10));
  let lastErr = "unavailable";
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 600, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) { lastErr = `model ${model}: HTTP ${r.status}`; continue; }
      const j = await r.json();
      const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      const plan = sanitizePlan(JSON.parse(text.replace(/^```json|```$/g, "")));
      return res.status(200).json({ plan, model });
    } catch (e) {
      lastErr = `model ${model}: ${e.name === "TimeoutError" ? "timeout" : "unparseable reply"}`;
    }
  }
  return res.status(502).json({ error: lastErr });
}
