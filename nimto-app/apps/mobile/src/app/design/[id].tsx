import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Button, Card, Loading, PageHeader, Screen, uiStyles } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { PublicDesign } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function DesignPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["designs"],
    queryFn: () => apiRequest<PublicDesign[]>("/template-design/public/designs"),
  });
  const design = query.data?.find((item) => item.id === id);
  const version = design?.versions[0];

  if (query.isLoading) return <Loading label="Opening design…" />;
  if (query.isError) return <View style={styles.center}><Text style={styles.error}>{query.error instanceof Error ? query.error.message : "Could not open this design."}</Text><Button onPress={() => router.back()} title="Back to designs" variant="secondary" /></View>;
  if (!design || !version) return <View style={styles.center}><Text style={uiStyles.sectionTitle}>Design unavailable</Text><Text style={uiStyles.muted}>This design may have been unpublished. Choose another from the catalogue.</Text><Button onPress={() => router.replace("/(tabs)/designs")} title="Browse designs" /></View>;
  const selectedVersionId = version.id;

  function useDesign() {
    const intent = { designVersionId: selectedVersionId, designName: design!.name };
    if (token) return router.push({ pathname: "/create", params: intent });
    router.push({ pathname: "/(auth)/login", params: { returnTo: "create", ...intent } });
  }

  return <Screen>
    <PageHeader eyebrow={[design.category?.name, design.subcategory?.name].filter(Boolean).join(" · ") || "Invitation design"} title={design.name} detail="Preview the complete invitation before deciding. You only need an account when you choose to use it." />
    <Card style={styles.previewCard}><View style={styles.preview}><WebView allowFileAccess={false} javaScriptEnabled={false} originWhitelist={["about:blank"]} source={{ html: version.rawHtml }} style={styles.webView} /></View></Card>
    <Button onPress={useDesign} title={token ? "Use this design" : "Use this design · Sign in"} />
    <Button onPress={() => router.back()} title="Keep browsing" variant="secondary" />
    {!token ? <Text style={styles.note}>Browsing is free. Signing in saves this choice and lets you create the invitation.</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  error: { color: colors.danger, textAlign: "center" },
  previewCard: { padding: 8 },
  preview: { height: 560, overflow: "hidden", borderRadius: 14, backgroundColor: colors.surfaceBrand },
  webView: { flex: 1, backgroundColor: colors.surfaceBrand },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
