import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, EmptyState, Loading, PageHeader, Screen, uiStyles } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { colors, radii } from "@/lib/theme";
import { UserEvent } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { useState } from "react";

export default function EventsScreen() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft" | "archived">("all");
  const query = useQuery({ queryKey: ["events"], queryFn: () => apiRequest<UserEvent[]>("/events", { token }) });
  const normalized = search.trim().toLowerCase();
  const events = query.data ?? [];
  const counts = {
    all: events.filter((event) => !event.archivedAt).length,
    published: events.filter((event) => event.isPublished && !event.archivedAt).length,
    draft: events.filter((event) => !event.isPublished && !event.archivedAt).length,
    archived: events.filter((event) => Boolean(event.archivedAt)).length,
  };
  const items = events.filter((event) => {
    const matchesStatus =
      (status === "all" && !event.archivedAt) ||
      (status === "published" && event.isPublished && !event.archivedAt) ||
      (status === "draft" && !event.isPublished && !event.archivedAt) ||
      (status === "archived" && Boolean(event.archivedAt));
    const matchesSearch = !normalized || [event.title, event.type, event.venue, event.designVersion?.design?.name]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized));
    return matchesStatus && matchesSearch;
  });
  return <Screen>
    <PageHeader eyebrow="Event management" title="Events" detail="Create invitations, manage guests, and follow responses." />
    <Button onPress={() => router.push("/(tabs)/designs")} title="Create event" />
    <TextInput onChangeText={setSearch} placeholder="Search by event or venue…" placeholderTextColor={colors.muted} style={styles.search} value={search} />
    <View accessibilityRole="tablist" style={styles.filters}>
      {(["all", "published", "draft", "archived"] as const).map((option) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: status === option }}
          key={option}
          onPress={() => setStatus(option)}
          style={[styles.filter, status === option && styles.filterActive]}
        >
          <Text style={[styles.filterText, status === option && styles.filterTextActive]}>
            {option === "draft" ? "Drafts" : `${option[0].toUpperCase()}${option.slice(1)}`} · {counts[option]}
          </Text>
        </Pressable>
      ))}
    </View>
    {query.isLoading ? <Loading label="Loading events…" /> : null}
    {query.isError ? <EmptyState action={<Button onPress={() => query.refetch()} title="Try again" />} detail={query.error instanceof Error ? query.error.message : "Could not load events."} title="Could not load events" /> : null}
    {!query.isLoading && !query.isError && !items.length ? <EmptyState detail={search ? "Try another event name or venue." : status === "archived" ? "Archived events will appear here." : "Choose a design to create your first invitation."} title={search ? "No matching events" : status === "archived" ? "No archived events" : "No events yet"} /> : null}
    {items.map((event) => <Pressable key={event.id} onPress={() => router.push(`/event/${event.id}`)}><Card><View style={uiStyles.between}><View style={styles.identity}><View style={styles.monogram}><Text style={styles.monogramText}>{event.title[0]?.toUpperCase() || "E"}</Text></View><View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{event.title}</Text><Text numberOfLines={1} style={uiStyles.muted}>{event.designVersion?.design?.name ?? event.type}</Text></View></View><Text style={uiStyles.badge}>{event.isPublished ? "Published" : "Draft"}</Text></View><View style={uiStyles.between}><Text style={uiStyles.muted}>{formatDate(event.eventDate)}</Text><Text style={uiStyles.muted}>{event._count?.invitees ?? 0} invitees</Text></View></Card></Pressable>)}
  </Screen>;
}

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "Date not set"; }
const styles = StyleSheet.create({
  search: { minHeight: 50, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 14, color: colors.ink },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8 },
  filterActive: { borderColor: colors.plum, backgroundColor: colors.surfaceBrand },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: colors.plumDeep },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  monogram: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.surfaceBrand, alignItems: "center", justifyContent: "center" },
  monogramText: { color: colors.plumDeep, fontWeight: "900", fontSize: 18 },
  copy: { flex: 1 }, title: { color: colors.ink, fontSize: 17, fontWeight: "800" },
});
