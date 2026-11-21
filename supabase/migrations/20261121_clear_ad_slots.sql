-- Clear wrong inventory slots / placements; remount with a new catalogue later.
-- Admins, bucket, and table structure stay.

delete from public.ad_placements;
delete from public.ad_slots;
