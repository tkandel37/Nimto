import { Tabs } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { colors } from "@/lib/theme";
import { useAuth } from "@/providers/auth-provider";

const icons: Record<string, string> = { index: "⌂", designs: "✦", events: "▣", profile: "●" };

export default function TabLayout() {
  const { token } = useAuth();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.plum,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>{icons[route.name] ?? "•"}</Text>,
      })}
    >
      <Tabs.Screen name="index" options={{ href: token ? undefined : null, title: "Home" }} />
      <Tabs.Screen name="designs" options={{ title: token ? "Designs" : "Explore" }} />
      <Tabs.Screen name="events" options={{ href: token ? undefined : null, title: "Events" }} />
      <Tabs.Screen name="profile" options={{ title: token ? "Profile" : "Sign in" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { height: 68, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border, backgroundColor: colors.surface },
  label: { fontSize: 11, fontWeight: "700" },
  icon: { fontSize: 21, fontWeight: "900" },
});
