import { CREATIVE_BUCKET, type AdSlotId } from "@/lib/ad-slots";
import { getSupabase } from "@/lib/supabase";

export type ManualPlacement = {
  id: string;
  slot_id: AdSlotId | string;
  name: string;
  href: string;
  image_path: string;
  alt: string;
  enabled: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
};

export const creativePublicUrl = (imagePath: string) => {
  const sb = getSupabase();
  if (!sb || !imagePath) return "";
  const { data } = sb.storage.from(CREATIVE_BUCKET).getPublicUrl(imagePath);
  return data.publicUrl || "";
};

const inWindow = (p: ManualPlacement, now = Date.now()) => {
  if (p.starts_at && Date.parse(p.starts_at) > now) return false;
  if (p.ends_at && Date.parse(p.ends_at) <= now) return false;
  return true;
};

/** Best active manual creative for a slot (highest priority). Null when Supabase is unset or nothing is live. */
export async function fetchManualPlacement(slotId: string): Promise<ManualPlacement | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("ad_placements")
    .select("id,slot_id,name,href,image_path,alt,enabled,priority,starts_at,ends_at")
    .eq("slot_id", slotId)
    .eq("enabled", true)
    .order("priority", { ascending: false })
    .limit(8);
  if (error || !data?.length) return null;
  const live = (data as ManualPlacement[]).filter((p) => inWindow(p));
  return live[0] ?? null;
}

export async function isAdAdmin(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: session } = await sb.auth.getSession();
  if (!session.session?.user) return false;
  const { data, error } = await sb.from("ad_admins").select("user_id").eq("user_id", session.session.user.id).maybeSingle();
  return !error && !!data;
}
