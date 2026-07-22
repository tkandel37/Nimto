import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Field, PageHeader, Screen } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { colors } from "@/lib/theme";
import { UserEvent } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

const eventTypes = ["WEDDING", "BIRTHDAY", "CORPORATE", "OTHER"] as const;

export default function CreateEventScreen() {
  const params = useLocalSearchParams<{
    designVersionId?: string;
    designName?: string;
  }>();
  const { isReady, token } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof eventTypes)[number]>("WEDDING");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      apiRequest<UserEvent>("/events", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title.trim(),
          type,
          eventDate: date
            ? new Date(`${date}T12:00:00`).toISOString()
            : undefined,
          venue: venue.trim() || undefined,
          description: description.trim() || undefined,
          designVersionId: params.designVersionId,
        }),
      }),
    onSuccess: async (event) => {
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      router.replace(`/event/${event.id}/edit`);
    },
    onError: (nextError) =>
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not create event.",
      ),
  });

  if (isReady && !token) {
    return (
      <Redirect
        href={{
          pathname: "/(auth)/login",
          params: {
            returnTo: "create",
            designVersionId: params.designVersionId ?? "",
            designName: params.designName ?? "",
          },
        }}
      />
    );
  }

  function submit() {
    if (title.trim().length < 2)
      return setError("Event title must contain at least two characters.");
    if (!params.designVersionId)
      return setError("Please choose a design first.");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return setError("Use YYYY-MM-DD for the event date.");
    setError("");
    create.mutate();
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="New invitation"
        title={params.designName || "Create event"}
        detail="Add the core event details. The live invitation editor opens next."
      />
      <Card>
        <Field
          label="Event title"
          onChangeText={setTitle}
          placeholder="Aarav & Sita's Wedding"
          value={title}
        />
        <Text style={styles.label}>Event type</Text>
        <View style={styles.types}>
          {eventTypes.map((item) => (
            <Pressable key={item} onPress={() => setType(item)}>
              <Text style={[styles.type, type === item && styles.typeActive]}>
                {item.charAt(0) + item.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          autoCapitalize="none"
          label="Date"
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          value={date}
        />
        <Field
          label="Venue"
          onChangeText={setVenue}
          placeholder="Venue or address"
          value={venue}
        />
        <Field
          label="Description"
          multiline
          onChangeText={setDescription}
          placeholder="A warm note for your guests"
          value={description}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button busy={create.isPending} onPress={submit} title="Create event" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  type: {
    color: colors.body,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 99,
    overflow: "hidden",
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "700",
  },
  typeActive: { color: colors.white, backgroundColor: colors.plum },
  error: { color: colors.danger, fontSize: 13 },
});
