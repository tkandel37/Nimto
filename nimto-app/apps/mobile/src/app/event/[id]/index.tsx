import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import {
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  Screen,
  uiStyles,
} from "@/components/ui";
import { apiRequest, WEB_URL } from "@/lib/api";
import {
  editableInvitationFields,
  hasInvitationDraft,
  initialInvitationValues,
  missingRequiredInvitationFields,
} from "@/lib/invitation";
import { colors, spacing } from "@/lib/theme";
import { EventStatistics, UserEvent } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const eventQuery = useQuery({
    queryKey: ["event", id],
    enabled: Boolean(id),
    queryFn: () => apiRequest<UserEvent>(`/events/${id}`, { token }),
  });
  const statsQuery = useQuery({
    queryKey: ["statistics", id],
    enabled: Boolean(id),
    queryFn: () =>
      apiRequest<EventStatistics>(`/events/${id}/statistics`, { token }),
  });
  const event = eventQuery.data;
  const updatePublish = useMutation({
    mutationFn: (isPublished: boolean) =>
      isPublished && event && hasInvitationDraft(event)
        ? apiRequest<UserEvent>(`/events/${id}/design-draft/publish`, {
            method: "POST",
            token,
          })
        : apiRequest<UserEvent>(`/events/${id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ isPublished }),
          }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["event", id] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["design-revisions", id] }),
      ]);
    },
  });
  const duplicate = useMutation({
    mutationFn: () =>
      apiRequest<UserEvent>(`/events/${id}/duplicate`, {
        method: "POST",
        token,
      }),
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      router.replace(`/event/${copy.id}`);
    },
  });
  const toggleArchive = useMutation({
    mutationFn: (action: "archive" | "restore") =>
      apiRequest<UserEvent>(`/events/${id}/${action}`, {
        method: "POST",
        token,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(["event", id], updated);
      await queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
  const remove = useMutation({
    mutationFn: () => apiRequest(`/events/${id}`, { method: "DELETE", token }),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["event", id] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      router.replace("/(tabs)/events");
    },
  });
  const actionError =
    duplicate.error ||
    toggleArchive.error ||
    remove.error ||
    updatePublish.error;

  async function shareEvent() {
    if (!event) return;
    const url = `${WEB_URL}/invite/${event.slug}`;
    await Share.share({
      title: event.title,
      message: `You're invited to ${event.title}\n${url}`,
      url,
    });
    await apiRequest(`/events/${id}/share`, {
      method: "POST",
      token,
      body: JSON.stringify({ channel: "native_share" }),
    }).catch(() => undefined);
  }

  if (eventQuery.isError)
    return (
      <Screen>
        <EmptyState
          action={
            <Button onPress={() => eventQuery.refetch()} title="Try again" />
          }
          detail={
            eventQuery.error instanceof Error
              ? eventQuery.error.message
              : "Could not load this event."
          }
          title="Could not open event"
        />
      </Screen>
    );
  if (eventQuery.isLoading || !event) return <Loading label="Opening event…" />;
  const currentEvent = event;
  const stats = statsQuery.data;
  const invitationDraft = hasInvitationDraft(event);
  const draftVersion = event.draftDesignVersion ?? event.designVersion;
  const draftFields = editableInvitationFields(draftVersion?.scanResult);
  const missingRequired = missingRequiredInvitationFields(
    draftFields,
    initialInvitationValues(
      draftFields,
      event.draftDesignFieldValues ?? event.designFieldValues,
    ),
  );
  function togglePublish() {
    const publishing = invitationDraft || !currentEvent.isPublished;
    if (publishing && (!currentEvent.eventDate || !currentEvent.venue)) {
      Alert.alert(
        "Event details are incomplete",
        "Add the event date and venue before publishing.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open editor",
            onPress: () => router.push(`/event/${id}/edit`),
          },
        ],
      );
      return;
    }
    if (publishing && missingRequired.length) {
      Alert.alert(
        "Invitation fields are incomplete",
        `${missingRequired.map((field) => field.label).join(", ")} ${missingRequired.length === 1 ? "is" : "are"} required before publishing.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open editor",
            onPress: () => router.push(`/event/${id}/edit`),
          },
        ],
      );
      return;
    }
    updatePublish.mutate(publishing);
  }
  return (
    <Screen>
      <PageHeader
        eyebrow={event.designVersion?.design?.name ?? event.type}
        title={event.title}
        detail={[formatDate(event.eventDate), event.venue]
          .filter(Boolean)
          .join(" · ")}
      />
      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={uiStyles.stat}>{event._count?.invitees ?? 0}</Text>
          <Text style={uiStyles.muted}>Invitees</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={uiStyles.stat}>
            {stats?.invitationOpens ?? event.openCount ?? 0}
          </Text>
          <Text style={uiStyles.muted}>Opens</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={uiStyles.stat}>{stats?.attending ?? 0}</Text>
          <Text style={uiStyles.muted}>Attending</Text>
        </Card>
      </View>
      <Card>
        <View style={uiStyles.between}>
          <View style={styles.statusCopy}>
            <Text style={uiStyles.sectionTitle}>Invitation status</Text>
            <Text style={uiStyles.muted}>
              {event.archivedAt
                ? "Archived events have disabled public links."
                : invitationDraft && event.isPublished
                  ? "Your current invitation is live. New edits remain private until published."
                  : event.isPublished
                    ? "Your public invitation link is live."
                    : "Publish when the invitation is ready."}
            </Text>
          </View>
          <Text
            style={[
              styles.status,
              event.isPublished && !event.archivedAt && styles.statusLive,
            ]}
          >
            {event.archivedAt
              ? "Archived"
              : invitationDraft
                ? "Changes"
                : event.isPublished
                  ? "Live"
                  : "Draft"}
          </Text>
        </View>
        <Button
          busy={updatePublish.isPending}
          disabled={Boolean(event.archivedAt)}
          onPress={togglePublish}
          title={
            invitationDraft
              ? "Publish invitation changes"
              : event.isPublished
                ? "Unpublish"
                : "Publish invitation"
          }
          variant={
            event.isPublished && !invitationDraft ? "secondary" : "primary"
          }
        />
      </Card>
      <Text style={uiStyles.sectionTitle}>Manage</Text>
      <View style={styles.actions}>
        <Action
          title="Edit invitation"
          detail="Live preview, content, theme, features, and history"
          onPress={() => router.push(`/event/${id}/edit`)}
        />
        <Action
          title="Invitees"
          detail="Guest links, sharing, and RSVP status"
          onPress={() => router.push(`/event/${id}/guests`)}
        />
        <Action
          title="Preview"
          detail="See the current version on a mobile canvas"
          onPress={() => router.push(`/event/${id}/preview`)}
        />
        <Action
          title="Duplicate event"
          detail="Create a new unpublished copy with the same design"
          onPress={() => duplicate.mutate()}
        />
      </View>
      <Button
        disabled={!event.isPublished || Boolean(event.archivedAt)}
        onPress={shareEvent}
        title="Share public invitation"
      />
      {!event.isPublished || event.archivedAt ? (
        <Text style={styles.hint}>
          {event.archivedAt
            ? "Restore the event before sharing its link."
            : "Publish the event before sharing its public link."}
        </Text>
      ) : null}
      <Card>
        <Text style={uiStyles.sectionTitle}>Event lifecycle</Text>
        <Text style={uiStyles.muted}>
          Archive an event to disable its public links without deleting its
          history.
        </Text>
        <Button
          busy={toggleArchive.isPending}
          onPress={() => {
            if (event.archivedAt) return toggleArchive.mutate("restore");
            Alert.alert(
              "Archive event?",
              "This will disable the event's public and guest links until it is restored.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Archive",
                  onPress: () => toggleArchive.mutate("archive"),
                },
              ],
            );
          }}
          title={event.archivedAt ? "Restore event" : "Archive event"}
          variant="secondary"
        />
        <Button
          busy={remove.isPending}
          onPress={() =>
            Alert.alert(
              "Permanently delete event?",
              `Delete “${event.title}” and all of its guest links? This cannot be undone.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete permanently",
                  style: "destructive",
                  onPress: () => remove.mutate(),
                },
              ],
            )
          }
          title="Delete event permanently"
          variant="danger"
        />
      </Card>
      {actionError ? (
        <Text style={styles.error}>
          {actionError instanceof Error
            ? actionError.message
            : "The event action could not be completed."}
        </Text>
      ) : null}
    </Screen>
  );
}

function Action({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={uiStyles.between}>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={uiStyles.muted}>{detail}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </View>
      </Card>
    </Pressable>
  );
}
function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "Date not set";
}
const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, padding: 12 },
  statusCopy: { flex: 1 },
  status: { color: colors.warning, fontWeight: "800" },
  statusLive: { color: colors.success },
  actions: { gap: spacing.sm },
  actionTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  arrow: { color: colors.plum, fontSize: 30 },
  hint: { color: colors.muted, fontSize: 12, textAlign: "center" },
  error: { color: colors.danger, fontSize: 13 },
});
