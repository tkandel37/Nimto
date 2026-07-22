import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Brand, Button, Card, EmptyState, Loading, PageHeader, Screen, uiStyles } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { UserEvent } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function DashboardScreen() {
  const { token, user } = useAuth();
  const events = useQuery({ queryKey: ["events"], queryFn: () => apiRequest<UserEvent[]>("/events", { token }) });
  const items = events.data ?? [];
  const active = items.filter((event) => !event.archivedAt);
  const published = active.filter((event) => event.isPublished);
  const invitees = active.reduce((sum, event) => sum + (event._count?.invitees ?? 0), 0);

  return <Screen>
    <View style={uiStyles.between}><Brand /><View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? "N"}</Text></View></View>
    <PageHeader eyebrow="Host workspace" title={`Namaste, ${user?.name?.split(" ")[0] ?? "there"}`} detail="Your invitations, guest links, and responses in one place." />
    <View style={styles.stats}>
      <Card style={styles.statCard}><Text style={uiStyles.stat}>{active.length}</Text><Text style={uiStyles.muted}>Active events</Text></Card>
      <Card style={styles.statCard}><Text style={uiStyles.stat}>{published.length}</Text><Text style={uiStyles.muted}>Published</Text></Card>
      <Card style={styles.statCard}><Text style={uiStyles.stat}>{invitees}</Text><Text style={uiStyles.muted}>Guest links</Text></Card>
    </View>
    <Button onPress={() => router.push("/(tabs)/designs")} title="Create an invitation" />
    <View style={uiStyles.between}><Text style={uiStyles.sectionTitle}>Recent events</Text><Pressable onPress={() => router.push("/(tabs)/events")}><Text style={styles.link}>View all</Text></Pressable></View>
    {events.isLoading ? <Loading label="Loading your events…" /> : null}
    {events.isError ? <EmptyState action={<Button onPress={() => events.refetch()} title="Try again" />} detail={events.error instanceof Error ? events.error.message : "Could not load your events."} title="Could not load your dashboard" /> : null}
    {!events.isLoading && !events.isError && !items.length ? <EmptyState detail="Choose a design and create your first event in a few simple steps." title="Your celebrations start here" /> : null}
    {items.slice(0, 3).map((event) => <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}`)}><Card><View style={uiStyles.between}><View style={styles.eventText}><Text numberOfLines={1} style={styles.eventTitle}>{event.title}</Text><Text numberOfLines={1} style={uiStyles.muted}>{event.venue || event.type}</Text></View><Text style={event.isPublished ? styles.live : styles.draft}>{event.isPublished ? "Live" : "Draft"}</Text></View><Text style={uiStyles.muted}>{event._count?.invitees ?? 0} invitees · {event.openCount ?? 0} opens</Text></Card></Pressable>)}
  </Screen>;
}

const styles = StyleSheet.create({
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceBrand, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.plumDeep, fontSize: 18, fontWeight: "900" },
  stats: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, minWidth: 0, padding: 12 },
  link: { color: colors.plum, fontWeight: "800" },
  eventText: { flex: 1 },
  eventTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  live: { color: colors.success, fontSize: 12, fontWeight: "800", backgroundColor: "#E8F1EC", borderRadius: 99, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5 },
  draft: { color: colors.warning, fontSize: 12, fontWeight: "800", backgroundColor: "#F5EEDF", borderRadius: 99, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5 },
});
