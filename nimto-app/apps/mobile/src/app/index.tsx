import { Redirect } from "expo-router";
import { View } from "react-native";
import { Loading } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

export default function Index() {
  const { isReady, token } = useAuth();
  if (!isReady) return <View style={{ flex: 1, justifyContent: "center" }}><Loading label="Opening myNimto…" /></View>;
  return <Redirect href={token ? "/(tabs)" : "/(auth)/login"} />;
}
