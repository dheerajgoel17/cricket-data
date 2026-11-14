/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  DEFAULTS, INNS_LABEL, MIN_STEPS, SORT_LABEL, WIN_LABEL, activeFilters, clearFilter, screenerQuery,
  type Inns, type Screener, type Sort, type Win,
} from "@site/lib/screener";
import { useCombos } from "@/lib/saved";
import { Accordion } from "@/ui/accordion";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, control, font, radius, space, type } from "@/ui/tokens";

export interface FilterChoices {
  days: [string, string][];
  matches: { id: string; label: string }[];
  teams: string[];
  formats: string[];
  comps: string[];
  winLabel: Record<string, string>;
}

/** Props screener filters: draft until Apply (site ScreenerFilters). Modal sheet; saved combos sync with Saved. */
export function ScreenerFilters({ open, onOpenChange, state, onApply, choices }: {
  open: boolean; onOpenChange: (o: boolean) => void; state: Screener; onApply: (s: Screener) => void; choices: FilterChoices;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(state);
  const [name, setName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const { save } = useCombos();
  useEffect(() => { if (open) { setDraft(state); setNote(null); } }, [open, state]);
  const set = (patch: Partial<Screener>) => setDraft((d) => ({ ...d, ...patch }));
  const dayName = (d: string) => choices.days.find(([k]) => k === d)?.[1] ?? d;
  const matchName = (id: string) => choices.matches.find((m) => m.id === id)?.label ?? id;
  const active = useMemo(() => activeFilters(draft, { day: dayName, match: matchName }).length, [draft, choices]);
  const chip = (on: boolean, label: string, onPress: () => void) => (
    <Press key={label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
    </Press>
  );

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={() => onOpenChange(false)}>
      <Pressable style={styles.backdrop} onPress={() => onOpenChange(false)} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.stack) }]} accessibilityViewIsModal>
        <View style={styles.head}>
          <Text style={styles.title}>Filters{active ? ` · ${active}` : ""}</Text>
          <Press accessibilityRole="button" accessibilityLabel="Close filters" onPress={() => onOpenChange(false)} style={styles.round}>
            <Ionicons name="close" size={20} color={color.foreground} />
          </Press>
        </View>
        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: space.stack }} showsVerticalScrollIndicator={false}>
          <Accordion title="Day" value={draft.day !== DEFAULTS.day ? dayName(draft.day) : undefined} defaultOpen>
            <View style={styles.wrap}>{choices.days.map(([id, label]) => chip(draft.day === id, label, () => set({ day: id })))}</View>
          </Accordion>
          {choices.matches.length > 0 ? (
            <Accordion title="Match" value={draft.match !== "all" ? matchName(draft.match) : undefined}>
              <View style={styles.wrap}>
                {chip(draft.match === "all", "All matches", () => set({ match: "all" }))}
                {choices.matches.map((m) => chip(draft.match === m.id, m.label, () => set({ match: m.id })))}
              </View>
            </Accordion>
          ) : null}
          {choices.teams.length > 1 ? (
            <Accordion title="Team" value={draft.team !== "all" ? draft.team : undefined}>
              <View style={styles.wrap}>
                {chip(draft.team === "all", "Any team", () => set({ team: "all" }))}
                {choices.teams.map((t) => chip(draft.team === t, t, () => set({ team: t })))}
              </View>
            </Accordion>
          ) : null}
          {choices.formats.length > 1 ? (
            <Accordion title="Format" value={draft.fmt !== "all" ? draft.fmt : undefined}>
              <View style={styles.wrap}>
                {chip(draft.fmt === "all", "All formats", () => set({ fmt: "all" }))}
                {choices.formats.map((f) => chip(draft.fmt === f, f, () => set({ fmt: f })))}
              </View>
            </Accordion>
          ) : null}
          {choices.comps.length > 1 ? (
            <Accordion title="Competition" value={draft.comp !== "all" ? draft.comp : undefined}>
              <View style={styles.wrap}>
                {chip(draft.comp === "all", "All competitions", () => set({ comp: "all" }))}
                {choices.comps.map((c) => chip(draft.comp === c, c, () => set({ comp: c })))}
              </View>
            </Accordion>
          ) : null}
          <Accordion title="Hit-rate window" value={draft.win !== DEFAULTS.win || draft.min ? `${WIN_LABEL[draft.win]}${draft.min ? ` · ${draft.min}%+` : ""}` : undefined} defaultOpen>
            <View style={styles.block}>
              <View style={styles.wrap}>{(Object.keys(WIN_LABEL) as Win[]).map((w) => chip(draft.win === w, choices.winLabel[w] ?? WIN_LABEL[w], () => set({ win: w })))}</View>
              <Text style={styles.hint}>Minimum hit rate in this window. Thin histories are left out, never guessed.</Text>
              <View style={styles.wrap}>{MIN_STEPS.map((m) => chip(draft.min === m, m ? `${m}%+` : "Any", () => set({ min: m })))}</View>
            </View>
          </Accordion>
          <Accordion title="Batting innings" value={draft.inns !== "all" ? INNS_LABEL[draft.inns] : undefined}>
            <View style={styles.wrap}>{(Object.keys(INNS_LABEL) as Inns[]).map((i) => chip(draft.inns === i, INNS_LABEL[i], () => set({ inns: i })))}</View>
          </Accordion>
          <Accordion title="Sort" value={draft.sort !== DEFAULTS.sort ? SORT_LABEL[draft.sort] : undefined}>
            <View style={styles.wrap}>{(Object.keys(SORT_LABEL) as Sort[]).map((s) => chip(draft.sort === s, SORT_LABEL[s], () => set({ sort: s })))}</View>
          </Accordion>
          <Accordion title="Display" value={draft.value || !draft.bars ? [draft.value && "Edge > 0", !draft.bars && "No charts"].filter(Boolean).join(" · ") : undefined}>
            <View style={styles.block}>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>Only positive edge</Text><Switch value={draft.value} onValueChange={(v) => set({ value: v })} trackColor={{ true: color.primary }} /></View>
              <View style={styles.switchRow}><Text style={styles.switchLabel}>Form charts</Text><Switch value={draft.bars} onValueChange={(v) => set({ bars: v })} trackColor={{ true: color.primary }} /></View>
            </View>
          </Accordion>
          <Accordion title="Save">
            <View style={styles.block}>
              <View style={styles.saveRow}>
                <TextInput value={name} onChangeText={setName} placeholder="Name this combination" placeholderTextColor={color["muted-foreground"]} style={styles.input} maxLength={40} />
                <Press accessibilityRole="button" onPress={() => {
                  if (!screenerQuery(draft)) { setNote("Set a filter first, then save it."); return; }
                  const n = name.trim() || "My filters";
                  save(n, screenerQuery(draft));
                  setName("");
                  setNote(`Saved as “${n}”. Find it under Saved.`);
                }} style={styles.saveBtn}><Text style={styles.saveTxt}>Save</Text></Press>
              </View>
              {note ? <Text style={styles.hint}>{note}</Text> : <Text style={styles.hint}>Saved on this device (and your account when signed in).</Text>}
            </View>
          </Accordion>
        </ScrollView>
        <View style={styles.foot}>
          <Press accessibilityRole="button" onPress={() => setDraft({ ...DEFAULTS })} style={styles.clear}><Text style={styles.clearTxt}>Clear all</Text></Press>
          <Press accessibilityRole="button" onPress={() => { onApply(draft); onOpenChange(false); }} style={styles.apply}><Text style={styles.applyTxt}>Apply</Text></Press>
        </View>
      </View>
    </Modal>
  );
}

export { clearFilter };

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { position: "absolute", left: 0, right: 0, top: 48, bottom: 0, backgroundColor: color.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  head: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.gutter, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  title: { ...type.title, color: color.foreground },
  round: { width: control, height: control, borderRadius: control / 2, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, paddingHorizontal: space.gutter },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.snug, paddingBottom: space.stack },
  block: { gap: space.snug, paddingBottom: space.stack },
  chip: { height: control, paddingHorizontal: space.stack, borderRadius: radius.chip, backgroundColor: color.card, justifyContent: "center" },
  chipOn: { backgroundColor: color.primary },
  chipTxt: { ...type.callout, fontFamily: font.medium, color: color.foreground },
  chipTxtOn: { color: color["primary-foreground"] },
  hint: { ...type.footnote, color: color["muted-foreground"] },
  switchRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { ...type.body, color: color.foreground },
  saveRow: { flexDirection: "row", gap: space.snug },
  input: { flex: 1, height: control, borderRadius: radius.chip, backgroundColor: color.secondary, paddingHorizontal: space.snug, ...type.body, color: color.foreground },
  saveBtn: { height: control, paddingHorizontal: space.stack, borderRadius: radius.chip, backgroundColor: color.secondary, justifyContent: "center" },
  saveTxt: { ...type.callout, fontFamily: font.medium, color: color.foreground },
  foot: { flexDirection: "row", gap: space.snug, paddingHorizontal: space.gutter, paddingTop: space.snug, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  clear: { flex: 1, height: 44, borderRadius: 999, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  clearTxt: { ...type.body, color: color.foreground },
  apply: { flex: 2, height: 44, borderRadius: 999, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" },
  applyTxt: { ...type.body, fontFamily: font.medium, color: color["primary-foreground"] },
});
