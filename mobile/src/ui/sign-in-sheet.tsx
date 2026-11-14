import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { BrandMark } from "@/ui/brand";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, font, radius, space, type } from "@/ui/tokens";

/** Sign-in sheet — same hierarchy as the site: brand, Google, one email form, mode link. */
export function SignInSheet() {
  const insets = useSafeAreaInsets();
  const { signInOpen, closeSignIn, configured, signInWithGoogle, signInWithPassword, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || password.length < 6) { setErr("Use a valid email and a password of at least 6 characters."); return; }
    setBusy(true); setErr(null);
    const r = mode === "in" ? await signInWithPassword(email, password) : await signUp(email, password);
    setBusy(false);
    if (r.error) setErr(r.error);
  };

  const google = async () => {
    setBusy(true); setErr(null);
    const r = await signInWithGoogle();
    setBusy(false);
    if (r.error) setErr(r.error);
  };

  return (
    <Modal visible={signInOpen} animationType="slide" transparent onRequestClose={closeSignIn}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={closeSignIn} accessibilityRole="button" accessibilityLabel="Close" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetWrap} pointerEvents="box-none">
          <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, space.stack) }]} accessibilityViewIsModal>
            <View style={styles.grabber} accessibilityElementsHidden />
            <Press accessibilityRole="button" accessibilityLabel="Close" onPress={closeSignIn} style={styles.close} hitSlop={10}>
              <Ionicons name="close" size={18} color={color["muted-foreground"]} />
            </Press>

            <View style={styles.hero}>
              <BrandMark size={48} />
              <Text style={styles.title}>{mode === "in" ? "Sign in to save" : "Create a free account"}</Text>
              <Text style={styles.sub}>Watchlist, players and filters sync to your account.</Text>
            </View>

            {!configured ? (
              <Text style={styles.hint}>Sign-in is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env.local, then restart Expo.</Text>
            ) : (
              <View style={styles.body}>
                <Press disabled={busy} onPress={google} style={({ pressed }) => [styles.google, pressed && { opacity: 0.88 }]}>
                  <Ionicons name="logo-google" size={18} color={color.foreground} />
                  <Text style={styles.googleLabel}>Continue with Google</Text>
                </Press>

                <View style={styles.orRow} accessibilityElementsHidden>
                  <View style={styles.rule} />
                  <Text style={styles.or}>or</Text>
                  <View style={styles.rule} />
                </View>

                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  placeholder="you@email.com"
                  placeholderTextColor={color["muted-foreground"]}
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType={mode === "in" ? "password" : "newPassword"}
                  placeholder="At least 6 characters"
                  placeholderTextColor={color["muted-foreground"]}
                  style={styles.input}
                />
                {err ? <Text style={styles.err}>{err}</Text> : null}

                <Press disabled={busy} onPress={submit} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.92 }, busy && { opacity: 0.55 }]}>
                  {busy
                    ? <ActivityIndicator color={color["primary-foreground"]} />
                    : <Text style={styles.primaryLabel}>{mode === "in" ? "Sign in with email" : "Create account"}</Text>}
                </Press>

                <Press onPress={() => { setMode((m) => (m === "in" ? "up" : "in")); setErr(null); }} style={styles.switchRow}>
                  <Text style={styles.switchMuted}>
                    {mode === "in" ? "No account? " : "Already have an account? "}
                    <Text style={styles.switchLink}>{mode === "in" ? "Create one free" : "Sign in"}</Text>
                  </Text>
                </Press>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheetWrap: { width: "100%" },
  card: {
    backgroundColor: color.card,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    borderBottomWidth: 0,
    paddingHorizontal: space.group,
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginTop: space.snug, marginBottom: space.tight },
  close: {
    position: "absolute",
    right: space.group,
    top: space.stack,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: color.pill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  hero: { alignItems: "center", gap: space.tight, paddingTop: space.snug, paddingBottom: space.stack, paddingHorizontal: space.snug },
  title: { ...type.title, fontSize: 22, lineHeight: 26, color: color.foreground, textAlign: "center" },
  sub: { ...type.callout, color: color["muted-foreground"], textAlign: "center", maxWidth: 280 },
  body: { gap: space.snug, paddingBottom: space.snug },
  hint: { ...type.callout, color: color["muted-foreground"], paddingBottom: space.stack },
  google: {
    height: 48,
    borderRadius: 999,
    backgroundColor: color.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.snug,
  },
  googleLabel: { ...type.body, fontFamily: font.medium, color: color.foreground },
  orRow: { flexDirection: "row", alignItems: "center", gap: space.snug, marginVertical: 2 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: color.hairline },
  or: { ...type.caption, color: color["muted-foreground"] },
  fieldLabel: { ...type.footnote, color: color["muted-foreground"], marginTop: 2 },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    backgroundColor: color.background,
    paddingHorizontal: space.inset,
    color: color.foreground,
    ...type.body,
  },
  err: { ...type.footnote, color: color.miss },
  primary: {
    height: 48,
    borderRadius: 999,
    backgroundColor: color.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.tight,
  },
  primaryLabel: { ...type.body, fontFamily: font.medium, color: color["primary-foreground"] },
  switchRow: { alignItems: "center", paddingVertical: space.snug },
  switchMuted: { ...type.callout, color: color["muted-foreground"], textAlign: "center" },
  switchLink: { color: color.primary, fontFamily: font.medium },
});
