import { useEffect, useState } from "react";
import { Button } from "@/ui/button";
import { Grabber, SheetBackdrop } from "@/ui/sheet";
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { getAuthProviderFlags } from "@/lib/supabase";
import { BrandMark } from "@/ui/brand";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, radius, space, type, fs, w, icon } from "@/ui/tokens";

/** Sign-in sheet — same hierarchy as the site: brand, Google, one email form, mode link. */
export function SignInSheet() {
  const insets = useSafeAreaInsets();
  const { signInOpen, closeSignIn, configured, signInWithGoogle, signInWithPassword, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [googleOn, setGoogleOn] = useState(false);

  useEffect(() => {
    if (!signInOpen || !configured) return;
    let alive = true;
    getAuthProviderFlags().then((f) => { if (alive) setGoogleOn(f.google); });
    return () => { alive = false; };
  }, [signInOpen, configured]);

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
    <Modal visible={signInOpen} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={closeSignIn}>
      <View style={styles.root}>
        <SheetBackdrop onClose={closeSignIn} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetWrap} pointerEvents="box-none">
          <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, space.stack) }]} accessibilityViewIsModal>
            <Grabber style={styles.grabber} />
            <Press accessibilityRole="button" accessibilityLabel="Close" onPress={closeSignIn} style={styles.close} hitSlop={10}>
              <Ionicons name="close" size={icon.md} color={color["muted-foreground"]} />
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
                {googleOn ? (
                  <>
                    <Button variant="secondary" disabled={busy} icon={<Ionicons name="logo-google" size={icon.md} color={color.foreground} />} label="Continue with Google" onPress={google} />
                    <View style={styles.orRow} accessibilityElementsHidden>
                      <View style={styles.rule} />
                      <Text style={styles.or}>or</Text>
                      <View style={styles.rule} />
                    </View>
                  </>
                ) : null}

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

                <Button disabled={busy} label={mode === "in" ? "Sign in with email" : "Create account"} onPress={submit} style={styles.submitGap} />

                <Press accessibilityRole="button" accessibilityLabel={mode === "in" ? "Create an account" : "Sign in instead"} onPress={() => { setMode((m) => (m === "in" ? "up" : "in")); setErr(null); }} style={styles.switchRow}>
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
  grabber: { marginTop: space.snug, marginBottom: space.tight },
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
  title: { ...type.title, fontSize: fs.figure, lineHeight: 26, color: color.foreground, textAlign: "center" },
  sub: { ...type.callout, color: color["muted-foreground"], textAlign: "center", maxWidth: 280 },
  body: { gap: space.snug, paddingBottom: space.snug },
  hint: { ...type.callout, color: color["muted-foreground"], paddingBottom: space.stack },
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
  submitGap: { marginTop: space.tight },
  switchRow: { alignItems: "center", paddingVertical: space.snug },
  switchMuted: { ...type.callout, color: color["muted-foreground"], textAlign: "center" },
  switchLink: { color: color.primary, ...w.label },
});
