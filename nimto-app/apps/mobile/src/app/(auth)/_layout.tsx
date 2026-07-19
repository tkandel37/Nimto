import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/providers/auth-provider";

export default function AuthLayout() {
  const { isReady, token } = useAuth();
  if (isReady && token) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
