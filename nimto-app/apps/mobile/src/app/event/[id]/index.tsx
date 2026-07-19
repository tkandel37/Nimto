import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Button, Card, Loading, PageHeader, Screen, uiStyles } from "@/components/ui";
import { apiRequest, WEB_URL } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { EventStatistics, UserEvent } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const eventQuery = useQuery({ queryKey: ["event", id], enabled: Boolean(id), queryFn: () => apiRequest<UserEvent>(`/events/${id}`, { token }) });
  const statsQuery = useQuery({ queryKey: ["statistics", id], enabled: Boolean(id), queryFn: () => apiRequest<EventStatistics>(`/events/${id}/statistics`, { token }) });
  const event = eventQuery.data;
  const updatePublish = useMutation({ mutationFn: (isPublished: boolean) => apiRequest<UserEvent>(`/events/${id}`, { method: "PATCH", token, body: JSON.stringify({ isPublished }) }), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["event", id] }), queryClient.invalidateQueries({ queryKey: ["events"] })]); } });

  async function shareEvent() {
    if (!event) return;
    const url = `${WEB_URL}/invite/${event.slug}`;
    await Share.share({ title: event.title, message: `You're invited to ${event.title}\n${url}`, url });
    await apiRequest(`/events/${id}/share`, { method: "POST", token, body: JSON.stringify({ channel: "native_share" }) }).catch(() => undefined);
  }

  if (eventQuery.isLoading || !event) return <Loading label="Opening event…" />;
  const stats = statsQuery.data;
  return <Screen>
    <PageHeader eyebrow={event.designVersion?.design?.name ?? event.type} title={event.title} detail={[formatDate(event.eventDate), event.venue].filter(Boolean).join(" · ")} />
    <View style={styles.stats}><Card style={styles.stat}><Text style={uiStyles.stat}>{event._count?.invitees ?? 0}</Text><Text style={uiStyles.muted}>Invitees</Text></Card><Card style={styles.stat}><Text style={uiStyles.stat}>{stats?.invitationOpens ?? event.openCount ?? 0}</Text><Text style={uiStyles.muted}>Opens</Text></Card><Card style={styles.stat}><Text style={uiStyles.stat}>{stats?.attending ?? 0}</Text><Text style={uiStyles.muted}>Attending</Text></Card></View>
    <Card><View style={uiStyles.between}><View><Text style={uiStyles.sectionTitle}>Invitation status</Text><Text style={uiStyles.muted}>{event.isPublished ? "Your public invitation link is live." : "Publish when the invitation is ready."}</Text></View><Text style={[styles.status, event.isPublished && styles.statusLive]}>{event.isPublished ? "Live" : "Draft"}</Text></View><Button busy={updatePublish.isPending} onPress={() => updatePublish.mutate(!event.isPublished)} title={event.isPublished ? "Unpublish" : "Publish invitation"} variant={event.isPublished ? "secondary" : "primary"} /></Card>
    <Text style={uiStyles.sectionTitle}>Manage</Text>
    <View style={styles.actions}>
      <Action title="Edit details" detail="Date, venue, text, and invitation fields" onPress={() => router.push(`/event/${id}/edit`)} />
      <Action title="Invitees" detail="Guest links, sharing, and RSVP status" onPress={() => router.push(`/event/${id}/guests`)} />
      <Action title="Preview" detail="See the current version on a mobile canvas" onPress={() => router.push(`/event/${id}/preview`)} />
    </View>
    <Button disabled={!event.isPublished} onPress={shareEvent} title="Share public invitation" />
    {!event.isPublished ? <Text style={styles.hint}>Publish the event before sharing its public link.</Text> : null}
  </Screen>;
}

function Action({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) { return <Pressable onPress={onPress}><Card><View style={uiStyles.between}><View style={{ flex: 1 }}><Text style={styles.actionTitle}>{title}</Text><Text style={uiStyles.muted}>{detail}</Text></View><Text style={styles.arrow}>›</Text></View></Card></Pressable>; }
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "Date not set"; }
const styles = StyleSheet.create({ stats: { flexDirection: "row", gap: spacing.sm }, stat: { flex: 1, padding: 12 }, status: { color: colors.warning, fontWeight: "800" }, statusLive: { color: colors.success }, actions: { gap: spacing.sm }, actionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" }, arrow: { color: colors.plum, fontSize: 30 }, hint: { color: colors.muted, fontSize: 12, textAlign: "center" } });
