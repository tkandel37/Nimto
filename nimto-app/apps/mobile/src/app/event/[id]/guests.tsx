import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { Button, Card, EmptyState, Field, Loading, PageHeader, Screen, uiStyles } from "@/components/ui";
import { apiRequest, WEB_URL } from "@/lib/api";
import { colors, spacing } from "@/lib/theme";
import { Invitee } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

export default function GuestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { token } = useAuth(); const client = useQueryClient();
  const [names, setNames] = useState(""); const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["invitees", id], queryFn: () => apiRequest<Invitee[]>(`/events/${id}/invitees`, { token }) });
  const create = useMutation({ mutationFn: (guestNames: string[]) => apiRequest<Invitee[]>(`/events/${id}/invitees`, { method: "POST", token, body: JSON.stringify({ names: guestNames }) }), onSuccess: async () => { setNames(""); await Promise.all([client.invalidateQueries({ queryKey: ["invitees", id] }), client.invalidateQueries({ queryKey: ["event", id] }), client.invalidateQueries({ queryKey: ["events"] })]); }, onError: (nextError) => setError(nextError instanceof Error ? nextError.message : "Could not add invitees.") });
  const remove = useMutation({ mutationFn: (inviteeId: string) => apiRequest(`/events/${id}/invitees/${inviteeId}`, { method: "DELETE", token }), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ["invitees", id] }), client.invalidateQueries({ queryKey: ["event", id] }), client.invalidateQueries({ queryKey: ["events"] })]); } });
  const linkAction = useMutation({
    mutationFn: ({ inviteeId, action }: { inviteeId: string; action: "enable" | "disable" | "regenerate" }) => apiRequest<Invitee>(`/events/${id}/invitees/${inviteeId}/${action}`, { method: "POST", token }),
    onSuccess: (updated) => client.setQueryData<Invitee[]>(["invitees", id], (current) => current?.map((invitee) => invitee.id === updated.id ? updated : invitee)),
  });
  const actionError = linkAction.error || remove.error;

  function addGuests() {
    const parsed = Array.from(new Set(names.split(/[\n,]/).map((name) => name.trim()).filter(Boolean)));
    if (!parsed.length) return setError("Enter at least one guest name.");
    setError(""); create.mutate(parsed);
  }

  async function shareInvitee(invitee: Invitee) {
    const url = `${WEB_URL}/invite/${invitee.slug}`;
    await Share.share({ title: `Invitation for ${invitee.name}`, message: `Dear ${invitee.name}, you're invited.\n${url}`, url });
    await apiRequest(`/events/${id}/invitees/${invitee.id}/share`, { method: "POST", token, body: JSON.stringify({ channel: "native_share" }) }).catch(() => undefined);
  }

  return <Screen>
    <PageHeader eyebrow="Guest management" title="Invitees" detail="Create personalized links and share through any app installed on your phone." />
    <Card><Field label="Guest names" multiline onChangeText={setNames} placeholder={"One name per line\nAarav Sharma\nKandel Family"} value={names} />{error ? <Text style={styles.error}>{error}</Text> : null}<Button busy={create.isPending} onPress={addGuests} title="Add invitees" /></Card>
    <View style={uiStyles.between}><Text style={uiStyles.sectionTitle}>Guest links</Text><Text style={uiStyles.badge}>{query.data?.length ?? 0}</Text></View>
    {query.isLoading ? <Loading label="Loading invitees…" /> : null}
    {!query.isLoading && !query.data?.length ? <EmptyState detail="Add names above to create personalized invitation links." icon="♙" title="No invitees yet" /> : null}
    {(query.data ?? []).map((invitee) => <Card key={invitee.id}><View style={uiStyles.between}><View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{invitee.name[0]?.toUpperCase() ?? "G"}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{invitee.name}</Text><Text style={uiStyles.muted}>{invitee.openCount} opens · {invitee.rsvpStatus.toLowerCase()}{invitee.linkDisabledAt ? " · link disabled" : ""}</Text></View></View><Text style={[styles.rsvp, invitee.rsvpStatus === "ATTENDING" && styles.attending, invitee.rsvpStatus === "DECLINED" && styles.declined]}>{invitee.rsvpStatus}</Text></View><View style={styles.actions}><View style={styles.action}><Button disabled={Boolean(invitee.linkDisabledAt)} onPress={() => shareInvitee(invitee)} title="Share" /></View><View style={styles.action}><Button busy={linkAction.isPending && linkAction.variables?.inviteeId === invitee.id && linkAction.variables.action !== "regenerate"} onPress={() => linkAction.mutate({ inviteeId: invitee.id, action: invitee.linkDisabledAt ? "enable" : "disable" })} title={invitee.linkDisabledAt ? "Enable link" : "Disable link"} variant="secondary" /></View><View style={styles.action}><Button busy={linkAction.isPending && linkAction.variables?.inviteeId === invitee.id && linkAction.variables.action === "regenerate"} onPress={() => Alert.alert("Regenerate guest link?", `${invitee.name}'s old link will stop working immediately.`, [{ text: "Cancel", style: "cancel" }, { text: "Regenerate", onPress: () => linkAction.mutate({ inviteeId: invitee.id, action: "regenerate" }) }])} title="Regenerate" variant="secondary" /></View><View style={styles.action}><Button busy={remove.isPending && remove.variables === invitee.id} onPress={() => Alert.alert("Delete invitee?", `Remove ${invitee.name} and invalidate their link?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(invitee.id) }])} title="Delete" variant="danger" /></View></View></Card>)}
    {actionError ? <Text style={styles.error}>{actionError instanceof Error ? actionError.message : "The guest-link action could not be completed."}</Text> : null}
  </Screen>;
}

const styles = StyleSheet.create({ error: { color: colors.danger }, identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }, avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceBrand, alignItems: "center", justifyContent: "center" }, avatarText: { color: colors.plumDeep, fontWeight: "900" }, name: { color: colors.ink, fontSize: 16, fontWeight: "800" }, rsvp: { color: colors.warning, fontSize: 10, fontWeight: "900" }, attending: { color: colors.success }, declined: { color: colors.danger }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, action: { flexGrow: 1, flexBasis: "46%" } });
