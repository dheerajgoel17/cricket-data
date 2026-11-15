import { mark } from "@/lib/perf";
import { IconBadge } from "@/ui/icon-badge";
import { Button } from "@/ui/button";
import { lazyTab } from "@/ui/lazy-tab";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { AppHeader } from "@/ui/brand";
import { useScreenInsets } from "@/ui/insets";
import { TabFade } from "@/ui/tab-fade";
import { color, font, numLg, radius, space, type, fs, surface, t, d, icon } from "@/ui/tokens";

const INBOX = "tech@fancy.cash";

const TOPICS: { id: string; title: string; blurb: string; subject: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "business", title: "Business & partnerships", blurb: "Sponsorship, media, or working together.", subject: "Business enquiry", icon: "briefcase-outline" },
  { id: "tech", title: "Tech & product", blurb: "Bugs, wrong numbers, outages, or a feature idea.", subject: "Tech / product", icon: "construct-outline" },
  { id: "privacy", title: "Privacy & account", blurb: "Saved data, sign-in, or a request to delete your account.", subject: "Privacy / account", icon: "shield-checkmark-outline" },
  { id: "general", title: "General", blurb: "Anything else about Fancy.cash that does not fit above.", subject: "General enquiry", icon: "chatbubble-ellipses-outline" },
];

function mailTo(subject: string) {
  return `mailto:${INBOX}?subject=${encodeURIComponent(`[Fancy.cash] ${subject}`)}`;
}

/** Sixth tab: contact — same inbox as the site, mailto only (no form backend). */
function ContactScreen() {
  mark("render:ContactScreen");
  const inset = useScreenInsets();
  const open = (url: string) => { void Linking.openURL(url); };
  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader title="Contact" />
      <ScrollView contentContainerStyle={{ paddingBottom: inset.bottom + space.section, paddingHorizontal: space.gutter, gap: space.stack, paddingTop: space.snug }}>
        <Text style={styles.lead}>Fancy.cash is a free cricket stats site. Write for business, tech, privacy, or anything else — one inbox.</Text>

        <View style={styles.hero}>
          <IconBadge><Ionicons name="mail-outline" size={icon.lg} color={color.primary} /></IconBadge>
          <Text style={styles.cap}>EMAIL</Text>
          <Press accessibilityRole="link" accessibilityLabel={`Email ${INBOX}`} onPress={() => open(mailTo("Hello"))}>
            <Text style={styles.email}>{INBOX}</Text>
          </Press>
          <Button label={`Email ${INBOX}`} icon={<Ionicons name="mail" size={icon.sm} color={color["primary-foreground"]} />} onPress={() => open(mailTo("Hello"))} style={styles.btn} />
        </View>

        <Text style={styles.section}>What is it about?</Text>
        {TOPICS.map((t) => (
          <View key={t.id} style={styles.card}>
            <IconBadge><Ionicons name={t.icon} size={icon.md} color={color.foreground} /></IconBadge>
            <Text style={styles.cardTitle}>{t.title}</Text>
            <Text style={styles.cardBlurb}>{t.blurb}</Text>
            <Button variant="secondary" size="sm" label="Write about this" onPress={() => open(mailTo(t.subject))} style={styles.secondary} />
          </View>
        ))}

        <Text style={styles.section}>Before you write</Text>
        <Text style={styles.note}>Include the page URL, match, player or ground when reporting a wrong number. We do not take wagers. For account deletion, say so in the subject.</Text>
      </ScrollView>
      <TabFade />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  lead: { ...type.body, color: color["muted-foreground"] },
  hero: { ...surface.card, padding: space.inset, gap: space.snug },
  cap: { ...d.footnote, letterSpacing: 0.44, color: color["muted-foreground"] },
  email: { ...numLg, fontSize: fs.display, letterSpacing: -0.5, color: color.primary },
  btn: { marginTop: space.tight },
  section: { ...type.heading, color: color.foreground, marginTop: space.snug },
  card: { ...surface.card, padding: space.inset, gap: space.snug },
  cardTitle: { ...t.bodyLabel, color: color.foreground },
  cardBlurb: { ...type.callout, color: color["muted-foreground"] },
  secondary: { alignSelf: "flex-start" },
  note: { ...type.callout, color: color["muted-foreground"] },
});

export default lazyTab(ContactScreen, "Contact");
