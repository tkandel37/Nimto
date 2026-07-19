import { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/lib/theme";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PageHeader({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return (
    <View style={styles.header}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>N</Text></View>
      {!compact ? <Text style={styles.brandText}>myNimto</Text> : null}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  disabled,
  busy,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator color={variant === "secondary" ? colors.plum : colors.white} /> : <Text style={[styles.buttonText, variant === "secondary" && styles.buttonSecondaryText]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline && styles.inputMultiline, error && styles.inputError]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function EmptyState({ icon = "✦", title, detail, action }: { icon?: string; title: string; detail: string; action?: ReactNode }) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
      {action}
    </Card>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.plum} /><Text style={styles.detail}>{label}</Text></View>;
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  body: { color: colors.body, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  stat: { color: colors.ink, fontSize: 27, fontWeight: "900" },
  badge: { alignSelf: "flex-start", borderRadius: radii.pill, backgroundColor: colors.surfaceBrand, color: colors.plumDeep, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "800", overflow: "hidden" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  screen: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },
  header: { gap: 5, paddingTop: 6, paddingBottom: 4 },
  eyebrow: { color: colors.plum, fontSize: 12, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 31, fontWeight: "900", letterSpacing: -0.8 },
  detail: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.plum },
  brandMarkText: { color: colors.white, fontSize: 22, fontWeight: "900" },
  brandText: { color: colors.plumDeep, fontSize: 22, fontWeight: "900", letterSpacing: -0.7 },
  card: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm, shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  button: { minHeight: 50, borderRadius: radii.sm, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.plum },
  buttonDanger: { backgroundColor: colors.danger },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  buttonSecondaryText: { color: colors.plumDeep },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
  fieldWrap: { gap: 7 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  input: { minHeight: 50, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: 14, fontSize: 16 },
  inputMultiline: { minHeight: 104, paddingTop: 14, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: spacing.xl },
  emptyIcon: { color: colors.berry, fontSize: 32 },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", textAlign: "center" },
  emptyDetail: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 300 },
  loading: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: spacing.sm },
});
