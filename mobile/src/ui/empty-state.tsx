import type { ReactNode } from "react";
import { IconBadge } from "@/ui/icon-badge";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { color, font, radius, space, type, surface, t } from "@/ui/tokens";

/**
 * Empty section / page: a quiet surface, optional icon, a short title and one supporting line.
 * Matches the site's EmptyState on Home Props, Fancy, Saved, leagues and search.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <View style={[styles.box, compact ? styles.compact : styles.pad]} accessibilityRole="text">
      {icon ? <IconBadge size={40}>{icon}</IconBadge> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { ...surface.card, gap: space.snug },
  pad: { paddingHorizontal: space.gutter, paddingVertical: space.group },
  compact: { paddingHorizontal: space.stack, paddingVertical: space.stack },
  title: { ...t.bodyLabel, color: color.foreground },
  body: { ...type.callout, color: color["muted-foreground"] },
  action: { paddingTop: space.tight },
});
