import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Button, Card, EmptyState, Field, Loading, PageHeader, Screen, uiStyles } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { colors } from "@/lib/theme";
import { UserEvent } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["event", id],
    queryFn: () => apiRequest<UserEvent>(`/events/${id}`, { token }),
  });
  if (query.isError) {
    return <Screen><EmptyState action={<Button onPress={() => query.refetch()} title="Try again" />} detail={query.error instanceof Error ? query.error.message : "Could not load this event."} title="Could not open editor" /></Screen>;
  }
  if (query.isLoading || !query.data) {
    return <Loading label="Loading event details…" />;
  }
  return <EditEventForm event={query.data} token={token} />;
}

function EditEventForm({ event, token }: { event: UserEvent; token: string | null }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.eventDate?.slice(0, 10) ?? "");
  const [venue, setVenue] = useState(event.venue ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(event.designFieldValues ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  );
  const [error, setError] = useState("");
  const fields = event.designVersion?.scanResult?.fields ?? [];
  const update = useMutation({
    mutationFn: () =>
      apiRequest<UserEvent>(`/events/${event.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          title: title.trim(),
          eventDate: date ? new Date(`${date}T12:00:00`).toISOString() : undefined,
          venue: venue.trim() || undefined,
          description: description.trim() || undefined,
          designFieldValues: values,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["event", event.id] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]);
      router.back();
    },
    onError: (nextError) =>
      setError(nextError instanceof Error ? nextError.message : "Could not save event."),
  });

  return (
    <Screen>
      <PageHeader eyebrow="Event editor" title="Edit invitation" detail="Changes are synchronized with the website and public invitation." />
      <Card>
        <Text style={uiStyles.sectionTitle}>Event details</Text>
        <Field label="Title" onChangeText={setTitle} value={title} />
        <Field autoCapitalize="none" label="Date" onChangeText={setDate} placeholder="YYYY-MM-DD" value={date} />
        <Field label="Venue" onChangeText={setVenue} value={venue} />
        <Field label="Description" multiline onChangeText={setDescription} value={description} />
      </Card>
      {fields.length ? (
        <Card>
          <Text style={uiStyles.sectionTitle}>Invitation text</Text>
          {fields.filter((field) => !field.locked).map((field) => (
            <Field
              key={field.key}
              label={`${field.label}${field.paid ? " · Paid field" : ""}`}
              multiline={field.type === "textarea"}
              onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              value={values[field.key] ?? ""}
            />
          ))}
        </Card>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button busy={update.isPending} onPress={() => update.mutate()} title="Save changes" />
    </Screen>
  );
}

const styles = StyleSheet.create({ error: { color: colors.danger } });
