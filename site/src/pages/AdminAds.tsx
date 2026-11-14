/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AD_SLOTS, CREATIVE_BUCKET, CREATIVE_MAX_BYTES, CREATIVE_MIME, type AdSlotId } from "@/lib/ad-slots";
import { useAuth } from "@/lib/auth";
import { isAdAdmin, creativePublicUrl, type ManualPlacement } from "@/lib/manual-ads";
import { getSupabase } from "@/lib/supabase";
import { setTitle } from "@/lib/title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/app/empty-state";
import { cn } from "@/lib/utils";

async function adminPost(action: string, body: Record<string, unknown> = {}) {
  const sb = getSupabase();
  const { data: sess } = await sb!.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Sign in required");
  const r = await fetch("/api/ads-admin", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

type Tab = "placements" | "admins";

/** Internal ads dashboard: manual creatives (override AdSense) and admin membership. noindex. */
export function AdminAdsPage() {
  setTitle("Ads admin");
  const { user, loading, openSignIn } = useAuth();
  const qc = useQueryClient();
  const adminQ = useQuery({ queryKey: ["is-ad-admin", user?.id], queryFn: isAdAdmin, enabled: !!user });
  const [tab, setTab] = useState<Tab>("placements");

  const placementsQ = useQuery({
    queryKey: ["admin-placements"],
    enabled: !!adminQ.data,
    queryFn: async () => {
      const sb = getSupabase()!;
      const { data, error } = await sb.from("ad_placements").select("*").order("priority", { ascending: false });
      if (error) throw error;
      return (data || []) as ManualPlacement[];
    },
  });

  const adminsQ = useQuery({
    queryKey: ["admin-admins"],
    enabled: !!adminQ.data && tab === "admins",
    queryFn: async () => (await adminPost("list_admins")).admins as { user_id: string; email: string; created_at: string }[],
  });

  if (!user) {
    return (
      <div className="flex flex-col gap-group">
        <h1 className="text-title font-bold tracking-tight">Ads admin</h1>
        <EmptyState title="Sign in required" body="Sign in with an ads admin account to manage manual creatives." />
        <Button type="button" disabled={loading} className="h-control w-fit rounded-full" onClick={openSignIn}>Sign in</Button>
      </div>
    );
  }
  if (adminQ.isLoading) return <p className="text-callout text-muted-foreground">Checking access…</p>;
  if (!adminQ.data) {
    return (
      <div className="flex flex-col gap-group">
        <h1 className="text-title font-bold tracking-tight">Ads admin</h1>
        <EmptyState title="Not an ads admin" body="Ask an existing admin to add your account email, or bootstrap the first row in Supabase (see OPERATIONS)." />
        <Button asChild variant="secondary" className="w-fit rounded-full"><Link to="/">Home</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <header className="flex flex-wrap items-end justify-between gap-snug">
        <div>
          <h1 className="text-title font-bold tracking-tight">Ads admin</h1>
          <p className="text-footnote text-muted-foreground">Manual creatives override AdSense. Empty slots stay hidden.</p>
        </div>
        <div className="flex gap-tight">
          {(["placements", "admins"] as Tab[]).map((t) => (
            <Button key={t} type="button" size="sm" variant={tab === t ? "default" : "secondary"} className="rounded-full capitalize" onClick={() => setTab(t)}>{t}</Button>
          ))}
        </div>
      </header>

      {tab === "placements" && (
        <PlacementsPanel
          rows={placementsQ.data || []}
          loading={placementsQ.isLoading}
          onChange={() => { void qc.invalidateQueries({ queryKey: ["admin-placements"] }); void qc.invalidateQueries({ queryKey: ["ad-placement"] }); }}
        />
      )}
      {tab === "admins" && (
        <AdminsPanel
          rows={adminsQ.data || []}
          loading={adminsQ.isLoading}
          selfId={user.id}
          onChange={() => void qc.invalidateQueries({ queryKey: ["admin-admins"] })}
        />
      )}
    </div>
  );
}

function PlacementsPanel({ rows, loading, onChange }: { rows: ManualPlacement[]; loading: boolean; onChange: () => void }) {
  const [slotId, setSlotId] = useState<AdSlotId>("fancy_detail_top");
  const [name, setName] = useState("");
  const [href, setHref] = useState("https://");
  const [alt, setAlt] = useState("");
  const [priority, setPriority] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const slot = AD_SLOTS.find((s) => s.id === slotId)!;

  const save = async () => {
    const sb = getSupabase();
    if (!sb || !file) { toast("Choose an image"); return; }
    if (!CREATIVE_MIME.includes(file.type as any)) { toast("Use GIF, PNG, WebP or JPEG"); return; }
    if (file.size > CREATIVE_MAX_BYTES) { toast("Max 2 MB"); return; }
    if (!/^https?:\/\//i.test(href)) { toast("Click URL must start with http(s)"); return; }
    setBusy(true);
    try {
      const path = `${slotId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_").slice(0, 80)}`;
      const { error: upErr } = await sb.storage.from(CREATIVE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: sess } = await sb.auth.getSession();
      const { error } = await sb.from("ad_placements").insert({
        slot_id: slotId,
        name: name.trim() || file.name,
        href: href.trim(),
        image_path: path,
        alt: alt.trim(),
        enabled: true,
        priority: Number(priority) || 0,
        created_by: sess.session?.user.id ?? null,
      });
      if (error) throw error;
      toast("Placement saved");
      setName(""); setAlt(""); setFile(null);
      onChange();
    } catch (e: any) {
      toast(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: ManualPlacement) => {
    const sb = getSupabase()!;
    const { error } = await sb.from("ad_placements").update({ enabled: !row.enabled }).eq("id", row.id);
    if (error) toast(error.message); else { toast(row.enabled ? "Disabled" : "Enabled"); onChange(); }
  };

  const remove = async (row: ManualPlacement) => {
    if (!confirm(`Delete “${row.name}”?`)) return;
    const sb = getSupabase()!;
    await sb.storage.from(CREATIVE_BUCKET).remove([row.image_path]);
    const { error } = await sb.from("ad_placements").delete().eq("id", row.id);
    if (error) toast(error.message); else { toast("Deleted"); onChange(); }
  };

  return (
    <div className="flex flex-col gap-section">
      <section className="grid gap-snug rounded-2xl bg-card p-inset ring-1 ring-hairline">
        <h2 className="text-body font-medium">New placement</h2>
        <label className="grid gap-hair text-callout">
          Slot
          <select className="h-control rounded-lg border border-input bg-background px-snug" value={slotId} onChange={(e) => setSlotId(e.target.value as AdSlotId)}>
            {AD_SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <p className="text-footnote text-muted-foreground">{slot.sizeNote} · {slot.paths.map((r) => r.source).join(" · ")}</p>
        <Input placeholder="Name (book / campaign)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Click URL (https://…)" value={href} onChange={(e) => setHref(e.target.value)} />
        <Input placeholder="Alt text" value={alt} onChange={(e) => setAlt(e.target.value)} />
        <Input type="number" placeholder="Priority (higher wins)" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
        <Input type="file" accept={CREATIVE_MIME.join(",")} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button type="button" disabled={busy} className="w-fit rounded-full" onClick={() => void save()}>{busy ? "Saving…" : "Save placement"}</Button>
      </section>

      <section className="flex flex-col gap-snug">
        <h2 className="text-body font-medium">All placements {loading ? "…" : `(${rows.length})`}</h2>
        {!rows.length && !loading ? <EmptyState compact title="None yet" body="Save a placement to list it here." /> : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-hairline">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-snug px-inset py-snug">
                <img src={creativePublicUrl(r.image_path)} alt="" className="h-12 w-24 object-contain bg-muted" />
                <div className="min-w-0 flex-1 grid gap-hair">
                  <span className="truncate text-body font-medium">{r.name}</span>
                  <span className="truncate text-footnote text-muted-foreground">{r.slot_id} · prio {r.priority} · {r.enabled ? "on" : "off"}</span>
                  <a href={r.href} className="truncate text-footnote text-primary" target="_blank" rel="noreferrer">{r.href}</a>
                </div>
                <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={() => void toggle(r)}>{r.enabled ? "Disable" : "Enable"}</Button>
                <Button type="button" size="sm" variant="ghost" className="rounded-full text-miss" onClick={() => void remove(r)}>Delete</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AdminsPanel({ rows, loading, selfId, onChange }: { rows: { user_id: string; email: string; created_at: string }[]; loading: boolean; selfId: string; onChange: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await adminPost("add_admin", { email });
      toast("Admin added");
      setEmail("");
      onChange();
    } catch (e: any) {
      toast(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: { user_id: string; email: string }) => {
    if (row.user_id === selfId) { toast("Cannot remove yourself"); return; }
    if (!confirm(`Remove ${row.email}?`)) return;
    try {
      await adminPost("remove_admin", { user_id: row.user_id });
      toast("Removed");
      onChange();
    } catch (e: any) {
      toast(e?.message || "Failed");
    }
  };

  return (
    <div className="flex flex-col gap-section">
      <section className="grid gap-snug rounded-2xl bg-card p-inset ring-1 ring-hairline">
        <h2 className="text-body font-medium">Add admin</h2>
        <p className="text-footnote text-muted-foreground">They must already have signed up (email/password or Google). Passwords stay in Supabase Auth.</p>
        <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="button" disabled={busy || !email.includes("@")} className="w-fit rounded-full" onClick={() => void add()}>{busy ? "Adding…" : "Add"}</Button>
      </section>
      <ul className="divide-y divide-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-hairline">
        {loading && <li className="px-inset py-snug text-callout text-muted-foreground">Loading…</li>}
        {rows.map((r) => (
          <li key={r.user_id} className="flex items-center gap-snug px-inset py-snug">
            <span className="min-w-0 flex-1 truncate text-body">{r.email}{r.user_id === selfId ? " (you)" : ""}</span>
            <Button type="button" size="sm" variant="ghost" className={cn("rounded-full", r.user_id === selfId && "invisible")} onClick={() => void remove(r)}>Remove</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
