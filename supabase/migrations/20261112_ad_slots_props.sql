-- Extra ad catalogue slots for player prop surfaces (parity with Match Fancy detail).
insert into public.ad_slots (id, label, size_note, path_hint) values
  ('player_detail_top', 'Player prop detail top strip', 'Full-bleed strip, about 1.75 × row height, square corners (GIF/PNG/WebP).', '/player/:id'),
  ('props_list_top', 'Player props list top strip', 'Full-bleed strip, about 1.75 × row height, square corners (GIF/PNG/WebP).', '/props')
on conflict (id) do update set label = excluded.label, size_note = excluded.size_note, path_hint = excluded.path_hint;
