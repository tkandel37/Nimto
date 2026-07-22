import { Redirect, Stack, usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Loading } from "@/components/ui";
import { colors } from "@/lib/theme";
import { useAuth } from "@/providers/auth-provider";

export default function EventLayout() {
  const pathname = usePathname();
  const { isReady, token } = useAuth();

  if (!isReady) {
    return <View style={styles.loading}><Loading label="Checking your account…" /></View>;
  }
  if (!token) {
    return <Redirect href={{ pathname: "/(auth)/login", params: { returnTo: pathname } }} />;
  }
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.canvas },
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: colors.plum,
        headerTitleStyle: { color: colors.ink, fontWeight: "800" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Event" }} />
      <Stack.Screen name="edit" options={{ title: "Edit event" }} />
      <Stack.Screen name="guests" options={{ title: "Invitees" }} />
      <Stack.Screen name="preview" options={{ title: "Invitation preview" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", backgroundColor: colors.canvas },
});
