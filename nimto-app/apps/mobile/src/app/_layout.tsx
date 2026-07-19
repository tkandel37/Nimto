import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";
import { AuthProvider } from "@/providers/auth-provider";

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: colors.canvas },
                headerBackButtonDisplayMode: "minimal",
                headerTintColor: colors.plum,
                headerTitleStyle: { color: colors.ink, fontWeight: "800" },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="create" options={{ title: "Create event" }} />
              <Stack.Screen name="event/[id]/index" options={{ title: "Event" }} />
              <Stack.Screen name="event/[id]/edit" options={{ title: "Edit event" }} />
              <Stack.Screen name="event/[id]/guests" options={{ title: "Invitees" }} />
              <Stack.Screen name="event/[id]/preview" options={{ title: "Invitation preview" }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
