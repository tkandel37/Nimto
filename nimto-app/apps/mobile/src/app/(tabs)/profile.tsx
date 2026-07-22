import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Brand, Button, Card, PageHeader, Screen, uiStyles } from "@/components/ui";
import { API_URL, WEB_URL } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { useAuth } from "@/providers/auth-provider";

export default function ProfileScreen() {
  const { token, user, logout } = useAuth();
  if (!token) {
    return <Screen>
      <Brand />
      <PageHeader eyebrow="Your invitations" title="Save your progress" detail="Explore every design without an account. Sign in only when you are ready to create and save an invitation." />
      <Card><Text style={uiStyles.sectionTitle}>Ready to make it yours?</Text><Text style={uiStyles.body}>Sign in to create events, personalize invitation text, manage guest links, and see responses across mobile and web.</Text><Button onPress={() => router.push("/(auth)/login")} title="Sign in" /><Button onPress={() => router.push("/(auth)/register")} title="Create account" variant="secondary" /></Card>
      <Button onPress={() => router.push("/(tabs)/designs")} title="Keep browsing designs" variant="secondary" />
    </Screen>;
  }
  return <Screen>
    <Brand />
    <PageHeader eyebrow="Your account" title="Profile" detail="The same profile is used across native apps and the web." />
    <Card><View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? "N"}</Text></View><Text style={styles.name}>{user?.name}</Text><Text style={uiStyles.body}>{user?.email}</Text></Card>
    <Card><Text style={uiStyles.sectionTitle}>Connected services</Text><View style={styles.line}><Text style={uiStyles.muted}>API</Text><Text numberOfLines={1} style={styles.value}>{API_URL}</Text></View><View style={styles.line}><Text style={uiStyles.muted}>Invitation website</Text><Text numberOfLines={1} style={styles.value}>{WEB_URL}</Text></View></Card>
    <Button onPress={logout} title="Sign out" variant="secondary" />
  </Screen>;
}
const styles = StyleSheet.create({ avatar: { width: 68, height: 68, borderRadius: 24, backgroundColor: colors.surfaceBrand, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.plumDeep, fontSize: 28, fontWeight: "900" }, name: { color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: spacing.xs }, line: { gap: 3 }, value: { color: colors.body, fontSize: 14 } });
