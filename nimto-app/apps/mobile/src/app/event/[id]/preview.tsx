import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Loading } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { applyInvitationValues } from "@/lib/invitation";
import { colors } from "@/lib/theme";
import { UserEvent } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function PreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { token } = useAuth();
  const query = useQuery({ queryKey: ["event", id], queryFn: () => apiRequest<UserEvent>(`/events/${id}`, { token }) });
  if (query.isLoading || !query.data) return <Loading label="Preparing preview…" />;
  const rawHtml = query.data.designVersion?.rawHtml ?? "";
  if (!rawHtml) return <View style={styles.center}><Text style={styles.message}>This event does not have preview HTML.</Text></View>;
  return <View style={styles.frame}><WebView allowFileAccess={false} javaScriptEnabled={false} originWhitelist={["about:blank"]} source={{ html: applyInvitationValues(rawHtml, query.data.designFieldValues) }} /></View>;
}
const styles = StyleSheet.create({ frame: { flex: 1, backgroundColor: colors.surface }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, message: { color: colors.muted, textAlign: "center" } });
