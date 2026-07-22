import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { InvitationPreview } from "@/components/invitation-preview";
import { Button, EmptyState, Loading, Screen } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import {
  editableInvitationFields,
  initialFeatureSettings,
  initialInvitationValues,
  normalizeFeatureConfig,
  renderInvitationPreview,
} from "@/lib/invitation";
import { colors } from "@/lib/theme";
import { UserEvent } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function PreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["event", id],
    queryFn: () => apiRequest<UserEvent>(`/events/${id}`, { token }),
  });
  if (query.isError)
    return (
      <Screen>
        <EmptyState
          action={<Button onPress={() => query.refetch()} title="Try again" />}
          detail={
            query.error instanceof Error
              ? query.error.message
              : "Could not prepare this invitation."
          }
          title="Preview unavailable"
        />
      </Screen>
    );
  if (query.isLoading || !query.data)
    return <Loading label="Preparing preview…" />;
  const version = query.data.draftDesignVersion ?? query.data.designVersion;
  const rawHtml = version?.rawHtml ?? "";
  if (!rawHtml)
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          This event does not have preview HTML.
        </Text>
      </View>
    );
  const config = normalizeFeatureConfig(version?.featureConfig);
  const settings = initialFeatureSettings(
    query.data.draftFeatureSettings ?? query.data.featureSettings,
    config,
    version?.scanResult?.styleSlots ?? [],
  );
  const fields = editableInvitationFields(version?.scanResult);
  const values = initialInvitationValues(
    fields,
    query.data.draftDesignFieldValues ?? query.data.designFieldValues,
  );
  const html = renderInvitationPreview({
    config,
    event: query.data,
    featureSettings: settings,
    rawHtml,
    values,
  });
  return (
    <View style={styles.frame}>
      <InvitationPreview html={html} title={`${query.data.title} preview`} />
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: colors.surface },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  message: { color: colors.muted, textAlign: "center" },
});
