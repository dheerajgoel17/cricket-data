// POST /api/ads-admin — admin-only helpers (add/remove admins by email). JWT in Authorization; service role looks up users.
// Body JSON: { action: "add_admin"|"remove_admin"|"list_admins", email?: string }
import { createClient } from "@supabase/supabase-js";

const FETCH_MS = 12_000;

function sbAdmin() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function sbAuthed(jwt) {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!url || !anon || !jwt) return null;
  return createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireAdmin(req) {
  const jwt = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { error: "Sign in required", status: 401 };
  const userClient = sbAuthed(jwt);
  if (!userClient) return { error: "Auth not configured", status: 503 };
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) return { error: "Invalid session", status: 401 };
  const admin = sbAdmin();
  if (!admin) return { error: "Service key not configured", status: 503 };
  const { data: row } = await admin.from("ad_admins").select("user_id,email").eq("user_id", userData.user.id).maybeSingle();
  if (!row) return { error: "Not an ads admin", status: 403 };
  return { admin, actor: userData.user, jwt };
}

async function findUserIdByEmail(admin, email) {
  const want = email.trim().toLowerCase();
  // paginate Auth users (Admin API); fine for a small admin set
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data?.users || []).find((u) => String(u.email || "").toLowerCase() === want);
    if (hit) return hit.id;
    if (!data?.users?.length || data.users.length < 200) return null;
    page += 1;
    if (page > 20) return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { return res.status(400).json({ error: "Bad JSON" }); }
  }
  body = body || {};
  try {
    const gate = await requireAdmin(req);
    if (gate.error) return res.status(gate.status).json({ error: gate.error });
    const { admin, actor } = gate;
    const action = String(body.action || "");

    if (action === "list_admins") {
      const { data, error } = await admin.from("ad_admins").select("user_id,email,created_at").order("created_at", { ascending: true });
      if (error) return res.status(502).json({ error: error.message });
      return res.status(200).json({ admins: data || [] });
    }

    if (action === "add_admin") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email required" });
      const userId = await findUserIdByEmail(admin, email);
      if (!userId) return res.status(404).json({ error: "No Auth user with that email. They must sign up on the site first." });
      const { error } = await admin.from("ad_admins").upsert({ user_id: userId, email, created_by: actor.id }, { onConflict: "user_id" });
      if (error) return res.status(502).json({ error: error.message });
      return res.status(200).json({ ok: true, user_id: userId, email });
    }

    if (action === "remove_admin") {
      const email = String(body.email || "").trim().toLowerCase();
      const userId = String(body.user_id || "").trim();
      if (!email && !userId) return res.status(400).json({ error: "email or user_id required" });
      if (userId && userId === actor.id) return res.status(400).json({ error: "Cannot remove yourself" });
      let q = admin.from("ad_admins").delete();
      q = userId ? q.eq("user_id", userId) : q.eq("email", email);
      const { data: before } = userId
        ? await admin.from("ad_admins").select("user_id").eq("user_id", userId)
        : await admin.from("ad_admins").select("user_id").eq("email", email);
      if ((before || []).some((r) => r.user_id === actor.id)) return res.status(400).json({ error: "Cannot remove yourself" });
      const { count } = await admin.from("ad_admins").select("user_id", { count: "exact", head: true });
      if ((count || 0) <= 1) return res.status(400).json({ error: "Keep at least one admin" });
      const { error } = await q;
      if (error) return res.status(502).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    const msg = e.name === "TimeoutError" ? "timeout" : String(e.message || "unavailable").slice(0, 120);
    return res.status(502).json({ error: msg });
  }
}

void FETCH_MS;
