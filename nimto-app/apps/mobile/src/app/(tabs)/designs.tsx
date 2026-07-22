import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import { Card, EmptyState, Loading, PageHeader, Screen, uiStyles } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { colors, radii, spacing } from "@/lib/theme";
import { PublicCategory, PublicDesign } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function DesignsScreen() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => apiRequest<PublicCategory[]>("/template-design/public/categories") });
  const designs = useQuery({ queryKey: ["designs"], queryFn: () => apiRequest<PublicDesign[]>("/template-design/public/designs") });
  const visible = useMemo(() => (designs.data ?? []).filter((design) => {
    const matchesCategory = !category || design.category?.id === category;
    const value = search.trim().toLowerCase();
    return matchesCategory && (!value || [design.name, design.category?.name, design.subcategory?.name].filter(Boolean).some((item) => item!.toLowerCase().includes(value)));
  }), [category, designs.data, search]);
  return <Screen>
    <PageHeader eyebrow="Invitation catalogue" title="Choose your design" detail={token ? "Start with a published design, then personalize every editable field." : "Browse and preview freely. Sign in only when you are ready to use a design."} />
    <TextInput onChangeText={setSearch} placeholder="Search wedding, birthday, puja…" placeholderTextColor={colors.muted} style={styles.search} value={search} />
    <View style={styles.chips}><Pressable onPress={() => setCategory("")}><Text style={[styles.chip, !category && styles.chipActive]}>All</Text></Pressable>{(categories.data ?? []).map((item) => <Pressable key={item.id} onPress={() => setCategory(item.id)}><Text style={[styles.chip, category === item.id && styles.chipActive]}>{item.name}</Text></Pressable>)}</View>
    {designs.isLoading ? <Loading label="Loading designs…" /> : null}
    {designs.isError ? <Text style={styles.error}>{designs.error instanceof Error ? designs.error.message : "Could not load designs."}</Text> : null}
    {!designs.isLoading && !visible.length ? <EmptyState detail="Try a broader search or a different category." title="No designs found" /> : null}
    <View style={styles.grid}>{visible.map((design) => { const version = design.versions[0]; const previewHtml = version?.thumbnailHtml || version?.rawHtml; return <Pressable key={design.id} onPress={() => version && router.push(`/design/${design.id}`)} style={styles.gridItem}><Card style={styles.designCard}><View pointerEvents="none" style={styles.art}>{previewHtml ? <WebView allowFileAccess={false} javaScriptEnabled={false} originWhitelist={["about:blank"]} scrollEnabled={false} source={{ html: previewHtml }} style={styles.webPreview} /> : <><Text style={styles.artMark}>✦</Text><Text numberOfLines={2} style={styles.artName}>{design.name}</Text></>}</View><Text numberOfLines={1} style={styles.designName}>{design.name}</Text><Text style={uiStyles.muted}>{design.category?.name ?? "Invitation"} · Preview</Text></Card></Pressable>; })}</View>
  </Screen>;
}

const styles = StyleSheet.create({
  search: { minHeight: 50, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 14, color: colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { color: colors.body, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 99, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: "700" },
  chipActive: { color: colors.white, backgroundColor: colors.plum, borderColor: colors.plum },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridItem: { width: "48%", flexGrow: 1 },
  designCard: { padding: 10 },
  art: { height: 170, borderRadius: 12, backgroundColor: colors.surfaceBrand, alignItems: "center", justifyContent: "center", padding: 16, gap: 12 },
  webPreview: { width: "100%", height: "100%", backgroundColor: colors.surfaceBrand },
  artMark: { color: colors.berry, fontSize: 34 },
  artName: { color: colors.plumDeep, fontSize: 17, fontWeight: "900", textAlign: "center" },
  designName: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 4 },
  error: { color: colors.danger, fontSize: 13 },
});
