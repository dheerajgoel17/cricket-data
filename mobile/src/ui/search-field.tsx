import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextInput } from "@/ui/text";
import { color, radius, space, t } from "@/ui/tokens";

/** The app's one search box (Search, Competitions): search glyph, a text input, the clear button the platform draws. Web twin: `SearchField` in the header. */
export function SearchField({ value, onChangeText, placeholder, label, autoFocus, style }: { value: string; onChangeText: (v: string) => void; placeholder: string; label?: string; autoFocus?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.field, style]}>
      <Ionicons name="search" size={18} color={color["muted-foreground"]} />
      <TextInput value={value} onChangeText={onChangeText} autoFocus={autoFocus} autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="while-editing"
        placeholder={placeholder} placeholderTextColor={color["muted-foreground"]} style={styles.input} accessibilityLabel={label ?? placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { height: 40, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.snug + 2, borderRadius: radius.control, backgroundColor: color.secondary },
  input: { flex: 1, ...t.body, paddingVertical: 0, color: color.foreground },
});
