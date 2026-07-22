import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { InvitationPreview } from "@/components/invitation-preview";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Loading,
  PageHeader,
  Screen,
  uiStyles,
} from "@/components/ui";
import { apiRequest, ApiError } from "@/lib/api";
import {
  clearInvitationEditorDraft,
  loadInvitationEditorDraft,
  saveInvitationEditorDraft,
  StoredInvitationEditorDraft,
} from "@/lib/editor-draft";
import {
  editableInvitationFields,
  initialFeatureSettings,
  initialInvitationValues,
  missingRequiredInvitationFields,
  normalizeFeatureConfig,
  renderInvitationPreview,
} from "@/lib/invitation";
import { colors, radii, spacing } from "@/lib/theme";
import {
  EventDesignRevision,
  InvitationFeatureSettings,
  PublicDesign,
  StyleSlot,
  TemplateField,
  UserEvent,
} from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

type EditorTab = "details" | "content" | "features" | "preview" | "history";
type SaveState = "ready" | "local" | "saving" | "saved" | "error";

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const eventQuery = useQuery({
    queryKey: ["event", id],
    queryFn: () => apiRequest<UserEvent>(`/events/${id}`, { token }),
  });
  const designsQuery = useQuery({
    queryKey: ["designs"],
    queryFn: () =>
      apiRequest<PublicDesign[]>("/template-design/public/designs"),
  });
  const revisionsQuery = useQuery({
    queryKey: ["design-revisions", id],
    queryFn: () =>
      apiRequest<EventDesignRevision[]>(`/events/${id}/design-revisions`, {
        token,
      }),
  });

  if (eventQuery.isError) {
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
          title="Could not open editor"
        />
      </Screen>
    );
  }
  if (eventQuery.isLoading || !eventQuery.data) {
    return <Loading label="Loading invitation editor…" />;
  }

  return (
    <InvitationEditor
      designs={designsQuery.data ?? []}
      designsUnavailable={designsQuery.isError}
      event={eventQuery.data}
      revisions={revisionsQuery.data ?? []}
      revisionsLoading={revisionsQuery.isLoading}
      token={token}
    />
  );
}

function InvitationEditor({
  designs,
  designsUnavailable,
  event,
  revisions,
  revisionsLoading,
  token,
}: {
  designs: PublicDesign[];
  designsUnavailable: boolean;
  event: UserEvent;
  revisions: EventDesignRevision[];
  revisionsLoading: boolean;
  token: string | null;
}) {
  const client = useQueryClient();
  const initialVersion = event.draftDesignVersion ?? event.designVersion;
  const availableVersions = useMemo(() => {
    const versions = designs.flatMap((design) =>
      design.versions.map((version) => ({ ...version, design })),
    );
    if (
      initialVersion &&
      !versions.some((version) => version.id === initialVersion.id)
    ) {
      versions.unshift({
        ...initialVersion,
        rawHtml: initialVersion.rawHtml ?? "",
        design: {
          id: initialVersion.design?.id ?? "event-design",
          name: initialVersion.design?.name ?? "Current invitation",
          slug: initialVersion.design?.slug ?? "current-invitation",
          versions: [],
        },
      });
    }
    return versions;
  }, [designs, initialVersion]);
  const [tab, setTab] = useState<EditorTab>("content");
  const [versionId, setVersionId] = useState(initialVersion?.id ?? "");
  const version =
    availableVersions.find((item) => item.id === versionId) ?? initialVersion;
  const fields = useMemo(
    () => editableInvitationFields(version?.scanResult),
    [version?.scanResult],
  );
  const config = useMemo(
    () => normalizeFeatureConfig(version?.featureConfig),
    [version?.featureConfig],
  );
  const styleSlots = useMemo(
    () => version?.scanResult?.styleSlots ?? [],
    [version?.scanResult?.styleSlots],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialInvitationValues(
      fields,
      event.draftDesignFieldValues ?? event.designFieldValues,
    ),
  );
  const [featureSettings, setFeatureSettings] =
    useState<InvitationFeatureSettings>(() =>
      initialFeatureSettings(
        event.draftFeatureSettings ?? event.featureSettings,
        config,
        styleSlots,
      ),
    );
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.eventDate?.slice(0, 10) ?? "");
  const [venue, setVenue] = useState(event.venue ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [designRevision, setDesignRevision] = useState(0);
  const revisionRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const recoveryEventRef = useRef("");
  const [saveState, setSaveState] = useState<SaveState>("ready");
  const [saveMessage, setSaveMessage] = useState(
    "All invitation changes are saved.",
  );
  const [recoveryDraft, setRecoveryDraft] =
    useState<StoredInvitationEditorDraft | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [designPickerOpen, setDesignPickerOpen] = useState(false);
  const [error, setError] = useState("");

  const previewEvent = useMemo<UserEvent>(
    () => ({
      ...event,
      title,
      eventDate: date ? `${date}T12:00:00.000Z` : null,
      venue,
      description,
    }),
    [date, description, event, title, venue],
  );
  const previewHtml = useMemo(
    () =>
      renderInvitationPreview({
        config,
        event: previewEvent,
        featureSettings,
        rawHtml: version?.rawHtml ?? "",
        values,
      }),
    [config, featureSettings, previewEvent, values, version?.rawHtml],
  );
  const missingRequired = useMemo(
    () => missingRequiredInvitationFields(fields, values),
    [fields, values],
  );
  const inaccessibleFieldCount =
    (version?.scanResult?.fields ?? []).length - fields.length;

  useEffect(() => {
    if (recoveryEventRef.current === event.id) return;
    recoveryEventRef.current = event.id;
    let active = true;
    loadInvitationEditorDraft(event.id)
      .then((draft) => {
        if (!active || !draft) return;
        const serverTime = new Date(
          event.draftSavedAt ?? event.updatedAt,
        ).getTime();
        if (new Date(draft.savedAt).getTime() > serverTime)
          setRecoveryDraft(draft);
        else void clearInvitationEditorDraft(event.id);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [event.draftSavedAt, event.id, event.updatedAt]);

  const persistLocalDraft = useCallback(
    async (
      nextVersionId: string,
      nextValues: Record<string, string>,
      nextFeatures: InvitationFeatureSettings,
    ) => {
      await saveInvitationEditorDraft({
        version: 1,
        eventId: event.id,
        designVersionId: nextVersionId,
        values: nextValues,
        featureSettings: nextFeatures,
        savedAt: new Date().toISOString(),
      });
    },
    [event.id],
  );

  const saveDesignDraft = useCallback(
    (
      revision: number,
      nextVersionId = versionId,
      nextValues = values,
      nextFeatures = featureSettings,
    ) => {
      if (!nextVersionId) return Promise.resolve();
      const task = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          setSaveState("saving");
          setSaveMessage("Saving invitation draft…");
          try {
            await apiRequest<UserEvent>(`/events/${event.id}/design-draft`, {
              method: "PATCH",
              token,
              body: JSON.stringify({
                designVersionId: nextVersionId,
                designFieldValues: nextValues,
                featureSettings: nextFeatures,
              }),
            });
            await Promise.all([
              client.invalidateQueries({ queryKey: ["event", event.id] }),
              client.invalidateQueries({ queryKey: ["events"] }),
            ]);
            if (revision === revisionRef.current) {
              await clearInvitationEditorDraft(event.id);
              setSaveState("saved");
              setSaveMessage("Draft saved to your event just now.");
            }
          } catch (caughtError) {
            await persistLocalDraft(nextVersionId, nextValues, nextFeatures);
            setSaveState("error");
            setSaveMessage(
              caughtError instanceof ApiError && caughtError.status === 0
                ? "Offline — your draft is saved safely on this device."
                : caughtError instanceof Error
                  ? `${caughtError.message} Your draft remains on this device.`
                  : "Could not sync. Your draft remains on this device.",
            );
          }
        });
      saveQueueRef.current = task;
      return task;
    },
    [
      client,
      event.id,
      featureSettings,
      persistLocalDraft,
      token,
      values,
      versionId,
    ],
  );

  useEffect(() => {
    if (!hydrated || designRevision === 0) return;
    const revision = designRevision;
    void persistLocalDraft(versionId, values, featureSettings).then(() => {
      if (revision === revisionRef.current) {
        setSaveState("local");
        setSaveMessage("Draft saved on this device. Syncing shortly…");
      }
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveDesignDraft(revision, versionId, values, featureSettings);
    }, 1400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    designRevision,
    featureSettings,
    hydrated,
    persistLocalDraft,
    saveDesignDraft,
    values,
    versionId,
  ]);

  function markDesignChanged() {
    const next = revisionRef.current + 1;
    revisionRef.current = next;
    setDesignRevision(next);
    setSaveState("local");
    setSaveMessage("Unsaved invitation changes…");
    setError("");
  }

  function updateValue(fieldKey: string, value: string) {
    setValues((current) => ({ ...current, [fieldKey]: value }));
    markDesignChanged();
  }

  function updateFeatures(
    updater: (current: InvitationFeatureSettings) => InvitationFeatureSettings,
  ) {
    setFeatureSettings((current) => updater(current));
    markDesignChanged();
  }

  function selectDesign(nextVersionId: string) {
    const nextVersion = availableVersions.find(
      (item) => item.id === nextVersionId,
    );
    if (!nextVersion) return;
    const nextFields = editableInvitationFields(nextVersion.scanResult);
    const nextConfig = normalizeFeatureConfig(nextVersion.featureConfig);
    const nextSlots = nextVersion.scanResult?.styleSlots ?? [];
    setVersionId(nextVersionId);
    setValues(initialInvitationValues(nextFields, values));
    setFeatureSettings(
      initialFeatureSettings(featureSettings, nextConfig, nextSlots),
    );
    setDesignPickerOpen(false);
    markDesignChanged();
  }

  function restoreLocalDraft() {
    if (!recoveryDraft) return;
    const recoveredVersion = availableVersions.find(
      (item) => item.id === recoveryDraft.designVersionId,
    );
    const targetVersion = recoveredVersion ?? version;
    if (!recoveredVersion) {
      setError(
        "The locally saved design is no longer available. The field values were kept with the current design.",
      );
    } else {
      setVersionId(recoveryDraft.designVersionId);
    }
    const targetFields = editableInvitationFields(targetVersion?.scanResult);
    const targetConfig = normalizeFeatureConfig(targetVersion?.featureConfig);
    setValues(initialInvitationValues(targetFields, recoveryDraft.values));
    setFeatureSettings(
      initialFeatureSettings(
        recoveryDraft.featureSettings,
        targetConfig,
        targetVersion?.scanResult?.styleSlots ?? [],
      ),
    );
    setRecoveryDraft(null);
    markDesignChanged();
  }

  async function discardLocalDraft() {
    await clearInvitationEditorDraft(event.id);
    setRecoveryDraft(null);
  }

  const saveDetails = useMutation({
    mutationFn: () => {
      if (title.trim().length < 2)
        throw new Error("Event title must contain at least two characters.");
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw new Error("Use YYYY-MM-DD for the event date.");
      return apiRequest<UserEvent>(`/events/${event.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          title: title.trim(),
          eventDate: date ? new Date(`${date}T12:00:00`).toISOString() : null,
          venue: venue.trim(),
          description: description.trim(),
        }),
      });
    },
    onSuccess: async () => {
      setDetailsDirty(false);
      setError("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["event", event.id] }),
        client.invalidateQueries({ queryKey: ["events"] }),
      ]);
    },
    onError: (nextError) =>
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not save event details.",
      ),
  });

  const restoreRevision = useMutation({
    mutationFn: (revisionId: string) =>
      apiRequest<UserEvent>(
        `/events/${event.id}/design-revisions/${revisionId}/restore`,
        { method: "POST", token },
      ),
    onSuccess: async () => {
      await clearInvitationEditorDraft(event.id);
      const refreshed = await client.fetchQuery({
        queryKey: ["event", event.id],
        queryFn: () => apiRequest<UserEvent>(`/events/${event.id}`, { token }),
      });
      const restoredVersion =
        refreshed.draftDesignVersion ?? refreshed.designVersion;
      const restoredFields = editableInvitationFields(
        restoredVersion?.scanResult,
      );
      const restoredConfig = normalizeFeatureConfig(
        restoredVersion?.featureConfig,
      );
      const restoredSlots = restoredVersion?.scanResult?.styleSlots ?? [];
      setVersionId(restoredVersion?.id ?? "");
      setValues(
        initialInvitationValues(
          restoredFields,
          refreshed.draftDesignFieldValues ?? refreshed.designFieldValues,
        ),
      );
      setFeatureSettings(
        initialFeatureSettings(
          refreshed.draftFeatureSettings ?? refreshed.featureSettings,
          restoredConfig,
          restoredSlots,
        ),
      );
      revisionRef.current = 0;
      setDesignRevision(0);
      setSaveState("saved");
      setSaveMessage("Older invitation restored as a private draft.");
      await client.invalidateQueries({
        queryKey: ["design-revisions", event.id],
      });
      setTab("preview");
    },
    onError: (nextError) =>
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not restore that version.",
      ),
  });

  async function saveNow() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (detailsDirty) {
      try {
        await saveDetails.mutateAsync();
      } catch {
        return;
      }
    }
    await saveDesignDraft(
      revisionRef.current,
      versionId,
      values,
      featureSettings,
    );
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="Live invitation editor"
        title={event.title}
        detail="Edit safely on your phone. Invitation changes autosave as a private draft and stay unpublished until you publish them."
      />

      {recoveryDraft ? (
        <Card style={styles.recoveryCard}>
          <Text style={uiStyles.sectionTitle}>Unsynced draft found</Text>
          <Text style={uiStyles.body}>
            This device has newer invitation changes from{" "}
            {formatDateTime(recoveryDraft.savedAt)}.
          </Text>
          <Button onPress={restoreLocalDraft} title="Restore device draft" />
          <Button
            onPress={() => void discardLocalDraft()}
            title="Use server version"
            variant="secondary"
          />
        </Card>
      ) : null}

      <Card style={styles.statusCard}>
        <View style={uiStyles.between}>
          <View style={styles.statusCopy}>
            <Text style={uiStyles.sectionTitle}>Draft status</Text>
            <Text style={uiStyles.muted}>{saveMessage}</Text>
          </View>
          <View
            style={[
              styles.statusDot,
              saveState === "error" && styles.statusDotError,
              saveState === "saved" && styles.statusDotSaved,
            ]}
          />
        </View>
        {missingRequired.length ? (
          <Text style={styles.warning}>
            {missingRequired.length} required invitation field
            {missingRequired.length === 1 ? " is" : "s are"} still empty.
          </Text>
        ) : null}
      </Card>

      <EditorTabs active={tab} onChange={setTab} />

      {tab === "details" ? (
        <DetailsEditor
          date={date}
          description={description}
          onChange={() => setDetailsDirty(true)}
          setDate={setDate}
          setDescription={setDescription}
          setTitle={setTitle}
          setVenue={setVenue}
          title={title}
          venue={venue}
        />
      ) : null}

      {tab === "content" ? (
        <View style={styles.sectionGap}>
          <Card>
            <View style={uiStyles.between}>
              <View style={styles.statusCopy}>
                <Text style={uiStyles.sectionTitle}>
                  {version?.design?.name ?? "Invitation design"}
                </Text>
                <Text style={uiStyles.muted}>
                  Version {version?.versionNumber ?? "—"}
                </Text>
              </View>
              <Pressable
                onPress={() => setDesignPickerOpen(true)}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>Change</Text>
              </Pressable>
            </View>
            {designsUnavailable ? (
              <Text style={styles.warning}>
                The catalogue is unavailable, but you can keep editing the
                current design.
              </Text>
            ) : null}
          </Card>
          <ContentFields
            fields={fields}
            onChange={updateValue}
            values={values}
          />
          {inaccessibleFieldCount > 0 ? (
            <Text style={uiStyles.muted}>
              {inaccessibleFieldCount} locked or paid field
              {inaccessibleFieldCount === 1 ? " is" : "s are"} protected by the
              template and cannot be changed.
            </Text>
          ) : null}
        </View>
      ) : null}

      {tab === "features" ? (
        <FeatureEditor
          config={config}
          featureSettings={featureSettings}
          fields={fields}
          linkableFieldKeys={version?.scanResult?.linkableFieldKeys ?? []}
          onChange={updateFeatures}
          styleSlots={styleSlots}
        />
      ) : null}

      {tab === "preview" ? (
        <View style={styles.sectionGap}>
          <Card style={styles.previewCard}>
            <View style={uiStyles.between}>
              <Text style={uiStyles.sectionTitle}>Live mobile preview</Text>
              <Text style={uiStyles.badge}>Private draft</Text>
            </View>
            {previewHtml ? (
              <View style={styles.previewFrame}>
                <InvitationPreview
                  html={previewHtml}
                  style={styles.webView}
                  title={`${title} preview`}
                />
              </View>
            ) : (
              <EmptyState
                detail="Choose a published design to begin editing."
                title="No preview available"
              />
            )}
          </Card>
          <Button
            onPress={() => router.push(`/event/${event.id}/preview`)}
            title="Open full-screen preview"
            variant="secondary"
          />
        </View>
      ) : null}

      {tab === "history" ? (
        <RevisionHistory
          loading={revisionsLoading}
          onRestore={(revision) =>
            Alert.alert(
              "Restore this invitation?",
              "Your current published invitation stays live. This version will become your private draft.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Restore",
                  onPress: () => restoreRevision.mutate(revision.id),
                },
              ],
            )
          }
          restoringId={restoreRevision.variables}
          revisions={revisions}
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        busy={saveDetails.isPending || saveState === "saving"}
        onPress={() => void saveNow()}
        title={detailsDirty ? "Save all changes" : "Save draft now"}
      />
      <Text style={styles.footerNote}>
        Saving keeps changes private. Publish from the event page when the
        invitation is ready for guests.
      </Text>

      <DesignPickerModal
        designs={designs}
        onClose={() => setDesignPickerOpen(false)}
        onSelect={selectDesign}
        selectedVersionId={versionId}
        visible={designPickerOpen}
      />
    </Screen>
  );
}

function EditorTabs({
  active,
  onChange,
}: {
  active: EditorTab;
  onChange: (tab: EditorTab) => void;
}) {
  const tabs: { key: EditorTab; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "content", label: "Content" },
    { key: "features", label: "Features" },
    { key: "preview", label: "Preview" },
    { key: "history", label: "History" },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabScroll}
      contentContainerStyle={styles.tabs}
    >
      {tabs.map((item) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: active === item.key }}
          key={item.key}
          onPress={() => onChange(item.key)}
          style={[styles.tab, active === item.key && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabLabel,
              active === item.key && styles.tabLabelActive,
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function DetailsEditor({
  date,
  description,
  onChange,
  setDate,
  setDescription,
  setTitle,
  setVenue,
  title,
  venue,
}: {
  date: string;
  description: string;
  onChange: () => void;
  setDate: (value: string) => void;
  setDescription: (value: string) => void;
  setTitle: (value: string) => void;
  setVenue: (value: string) => void;
  title: string;
  venue: string;
}) {
  return (
    <Card>
      <Text style={uiStyles.sectionTitle}>Event details</Text>
      <Text style={uiStyles.muted}>
        These details are shared with the website and can also fill matching
        template fields.
      </Text>
      <Field
        label="Event title"
        maxLength={120}
        onChangeText={(value) => {
          setTitle(value);
          onChange();
        }}
        value={title}
      />
      <Field
        autoCapitalize="none"
        label="Date"
        onChangeText={(value) => {
          setDate(value);
          onChange();
        }}
        placeholder="YYYY-MM-DD"
        value={date}
      />
      <Field
        label="Venue"
        maxLength={180}
        onChangeText={(value) => {
          setVenue(value);
          onChange();
        }}
        value={venue}
      />
      <Field
        label="Description"
        maxLength={1200}
        multiline
        onChangeText={(value) => {
          setDescription(value);
          onChange();
        }}
        value={description}
      />
    </Card>
  );
}

function ContentFields({
  fields,
  onChange,
  values,
}: {
  fields: TemplateField[];
  onChange: (key: string, value: string) => void;
  values: Record<string, string>;
}) {
  const sections = useMemo(() => groupFields(fields), [fields]);
  if (!fields.length)
    return (
      <EmptyState
        detail="This design has no user-editable fields. You can still adjust event details and available features."
        title="No editable text"
      />
    );
  return (
    <View style={styles.sectionGap}>
      {sections.map(([section, sectionFields]) => (
        <Card key={section}>
          <Text style={styles.sectionLabel}>{humanize(section)}</Text>
          {sectionFields.map((field) => (
            <InvitationField
              field={field}
              key={field.key}
              onChange={(value) => onChange(field.key, value)}
              value={values[field.key] ?? ""}
            />
          ))}
        </Card>
      ))}
    </View>
  );
}

function InvitationField({
  field,
  onChange,
  value,
}: {
  field: TemplateField;
  onChange: (value: string) => void;
  value: string;
}) {
  const multiline = field.type === "textarea";
  const keyboardType =
    field.type === "number"
      ? "numeric"
      : ["url", "image", "audio"].includes(field.type)
        ? "url"
        : "default";
  const formatHint =
    field.type === "date"
      ? "YYYY-MM-DD"
      : field.type === "time"
        ? "HH:MM"
        : field.type === "datetime"
          ? "YYYY-MM-DD HH:MM"
          : field.type === "color"
            ? "#6B3655"
            : field.placeholder;
  return (
    <Field
      autoCapitalize={
        ["url", "image", "audio"].includes(field.type) ? "none" : "sentences"
      }
      keyboardType={keyboardType}
      label={`${field.label}${field.required ? " *" : ""}`}
      maxLength={4000}
      multiline={multiline}
      onChangeText={onChange}
      placeholder={formatHint}
      value={value}
    />
  );
}

function FeatureEditor({
  config,
  featureSettings,
  fields,
  linkableFieldKeys,
  onChange,
  styleSlots,
}: {
  config: ReturnType<typeof normalizeFeatureConfig>;
  featureSettings: InvitationFeatureSettings;
  fields: TemplateField[];
  linkableFieldKeys: string[];
  onChange: (
    updater: (current: InvitationFeatureSettings) => InvitationFeatureSettings,
  ) => void;
  styleSlots: StyleSlot[];
}) {
  const availableCount = [
    config.countdown,
    config.rsvp,
    config.music,
    config.additionalInfo,
    config.openingAnimation,
    config.theme,
    config.sharePreview,
    config.links,
  ].filter((item) => item.available).length;
  const linkableFields = fields.filter((field) =>
    linkableFieldKeys.includes(field.key),
  );
  if (!availableCount)
    return (
      <EmptyState
        detail="The selected template does not expose optional invitation features."
        title="No optional features"
      />
    );
  return (
    <View style={styles.sectionGap}>
      <Card>
        <Text style={uiStyles.sectionTitle}>Invitation features</Text>
        <Text style={uiStyles.muted}>
          Only capabilities approved for this template appear here.
        </Text>
        {config.countdown.available ? (
          <ToggleRow
            detail={`Template position: ${config.countdown.position}`}
            enabled={Boolean(featureSettings.countdown?.enabled)}
            label="Countdown"
            onChange={(enabled) =>
              onChange((current) => ({ ...current, countdown: { enabled } }))
            }
          />
        ) : null}
        {config.rsvp.available ? (
          <ToggleRow
            detail="Show the RSVP action on the invitation."
            enabled={Boolean(featureSettings.rsvp?.enabled)}
            label="RSVP"
            onChange={(enabled) =>
              onChange((current) => ({ ...current, rsvp: { enabled } }))
            }
          />
        ) : null}
        {config.openingAnimation.available ? (
          <ToggleRow
            detail="Use the template's opening animation."
            enabled={Boolean(featureSettings.openingAnimation?.enabled)}
            label="Opening animation"
            onChange={(enabled) =>
              onChange((current) => ({
                ...current,
                openingAnimation: { enabled },
              }))
            }
          />
        ) : null}
      </Card>
      {config.music.available ? (
        <Card>
          <ToggleRow
            detail="Use a direct public HTTPS audio URL."
            enabled={Boolean(featureSettings.music?.enabled)}
            label="Invitation music"
            onChange={(enabled) =>
              onChange((current) => ({
                ...current,
                music: { ...(current.music ?? {}), enabled },
              }))
            }
          />
          <Field
            autoCapitalize="none"
            editable={Boolean(featureSettings.music?.enabled)}
            keyboardType="url"
            label="Music URL"
            onChangeText={(url) =>
              onChange((current) => ({
                ...current,
                music: { ...(current.music ?? {}), url },
              }))
            }
            placeholder="https://example.com/music.mp3"
            value={featureSettings.music?.url ?? ""}
          />
        </Card>
      ) : null}
      {config.additionalInfo.available ? (
        <Card>
          <ToggleRow
            detail="Add parking, dress code, contact, or other notes."
            enabled={Boolean(featureSettings.additionalInfo?.enabled)}
            label="Additional information"
            onChange={(enabled) =>
              onChange((current) => ({
                ...current,
                additionalInfo: { ...(current.additionalInfo ?? {}), enabled },
              }))
            }
          />
          <Field
            editable={Boolean(featureSettings.additionalInfo?.enabled)}
            label="Additional note"
            maxLength={1200}
            multiline
            onChangeText={(text) =>
              onChange((current) => ({
                ...current,
                additionalInfo: { ...(current.additionalInfo ?? {}), text },
              }))
            }
            value={featureSettings.additionalInfo?.text ?? ""}
          />
        </Card>
      ) : null}
      {config.theme.available && styleSlots.length ? (
        <Card>
          <Text style={uiStyles.sectionTitle}>Theme</Text>
          {styleSlots.map((slot) => (
            <Field
              autoCapitalize="none"
              key={slot.key}
              label={slot.label ?? humanize(slot.key)}
              onChangeText={(value) =>
                onChange((current) => ({
                  ...current,
                  theme: { ...(current.theme ?? {}), [slot.key]: value },
                }))
              }
              placeholder={
                slot.type === "color" ? "#6B3655" : slot.defaultValue
              }
              value={
                featureSettings.theme?.[slot.key] ?? slot.defaultValue ?? ""
              }
            />
          ))}
        </Card>
      ) : null}
      {config.links.available ? (
        <LinkEditor
          featureSettings={featureSettings}
          fields={linkableFields}
          onChange={onChange}
        />
      ) : null}
      {config.sharePreview.available ? (
        <Card>
          <Text style={uiStyles.sectionTitle}>Share preview</Text>
          <Text style={uiStyles.muted}>
            Used for website and social link previews after publishing.
          </Text>
          <Field
            label="Preview title"
            maxLength={120}
            onChangeText={(title) =>
              onChange((current) => ({
                ...current,
                sharePreview: { ...(current.sharePreview ?? {}), title },
              }))
            }
            value={featureSettings.sharePreview?.title ?? ""}
          />
          <Field
            label="Preview description"
            maxLength={240}
            multiline
            onChangeText={(description) =>
              onChange((current) => ({
                ...current,
                sharePreview: { ...(current.sharePreview ?? {}), description },
              }))
            }
            value={featureSettings.sharePreview?.description ?? ""}
          />
          <Field
            autoCapitalize="none"
            keyboardType="url"
            label="Preview image URL"
            onChangeText={(imageUrl) =>
              onChange((current) => ({
                ...current,
                sharePreview: { ...(current.sharePreview ?? {}), imageUrl },
              }))
            }
            value={featureSettings.sharePreview?.imageUrl ?? ""}
          />
        </Card>
      ) : null}
      {config.print.available ? (
        <Card>
          <Text style={uiStyles.sectionTitle}>Print-ready sections</Text>
          <Text style={uiStyles.muted}>
            This template includes print/PDF page sections. No additional setup
            is required.
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

function ToggleRow({
  detail,
  enabled,
  label,
  onChange,
}: {
  detail: string;
  enabled: boolean;
  label: string;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={uiStyles.muted}>{detail}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.berry }}
        thumbColor={enabled ? colors.plum : colors.surface}
        value={enabled}
      />
    </View>
  );
}

function LinkEditor({
  featureSettings,
  fields,
  onChange,
}: {
  featureSettings: InvitationFeatureSettings;
  fields: TemplateField[];
  onChange: (
    updater: (current: InvitationFeatureSettings) => InvitationFeatureSettings,
  ) => void;
}) {
  const links = featureSettings.links ?? [];
  const selected = new Set(links.map((link) => link.fieldKey));
  function patchLink(
    index: number,
    patch: { fieldKey?: string; url?: string; hoverText?: string },
  ) {
    onChange((current) => ({
      ...current,
      links: (current.links ?? []).map((link, itemIndex) =>
        itemIndex === index ? { ...link, ...patch } : link,
      ),
    }));
  }
  function addLink() {
    const field = fields.find((item) => !selected.has(item.key));
    if (!field) return;
    onChange((current) => ({
      ...current,
      links: [
        ...(current.links ?? []),
        { fieldKey: field.key, url: "", hoverText: "Follow link" },
      ],
    }));
  }
  function removeLink(index: number) {
    onChange((current) => ({
      ...current,
      links: (current.links ?? []).filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  }
  return (
    <Card>
      <View style={uiStyles.between}>
        <View style={styles.statusCopy}>
          <Text style={uiStyles.sectionTitle}>Linked invitation text</Text>
          <Text style={uiStyles.muted}>
            Make eligible text open a secure URL, email, or phone action.
          </Text>
        </View>
        <Pressable
          disabled={fields.length <= links.length}
          onPress={addLink}
          style={styles.textButton}
        >
          <Text style={styles.textButtonLabel}>Add</Text>
        </Pressable>
      </View>
      {!fields.length ? (
        <Text style={uiStyles.muted}>
          This template has no linkable text fields.
        </Text>
      ) : null}
      {links.map((link, index) => (
        <View key={`${link.fieldKey}-${index}`} style={styles.linkCard}>
          <View style={uiStyles.between}>
            <Text style={styles.toggleLabel}>Link {index + 1}</Text>
            <Pressable onPress={() => removeLink(index)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
          <Text style={styles.inputLabel}>Invitation field</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fieldChips}
          >
            {fields.map((field) => {
              const disabled =
                field.key !== link.fieldKey && selected.has(field.key);
              return (
                <Pressable
                  disabled={disabled}
                  key={field.key}
                  onPress={() => patchLink(index, { fieldKey: field.key })}
                  style={[
                    styles.fieldChip,
                    link.fieldKey === field.key && styles.fieldChipActive,
                    disabled && styles.disabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.fieldChipLabel,
                      link.fieldKey === field.key &&
                        styles.fieldChipLabelActive,
                    ]}
                  >
                    {field.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Field
            autoCapitalize="none"
            keyboardType="url"
            label="Destination"
            onChangeText={(url) => patchLink(index, { url })}
            placeholder="https://example.com"
            value={link.url}
          />
          <Field
            label="Accessibility label"
            maxLength={80}
            onChangeText={(hoverText) => patchLink(index, { hoverText })}
            value={link.hoverText ?? ""}
          />
        </View>
      ))}
    </Card>
  );
}

function RevisionHistory({
  loading,
  onRestore,
  restoringId,
  revisions,
}: {
  loading: boolean;
  onRestore: (revision: EventDesignRevision) => void;
  restoringId?: string;
  revisions: EventDesignRevision[];
}) {
  if (loading) return <Loading label="Loading published history…" />;
  if (!revisions.length)
    return (
      <EmptyState
        detail="Published invitation versions will appear here."
        title="No published history yet"
      />
    );
  return (
    <View style={styles.sectionGap}>
      {revisions.map((revision) => (
        <Card key={revision.id}>
          <View style={uiStyles.between}>
            <View style={styles.statusCopy}>
              <Text style={styles.toggleLabel}>
                {revision.label ??
                  `Version ${revision.designVersion.versionNumber}`}
              </Text>
              <Text style={uiStyles.muted}>
                {revision.designVersion.design.name} ·{" "}
                {formatDateTime(revision.createdAt)}
              </Text>
            </View>
            <Text style={uiStyles.badge}>
              v{revision.designVersion.versionNumber}
            </Text>
          </View>
          <Button
            busy={restoringId === revision.id}
            onPress={() => onRestore(revision)}
            title="Restore as draft"
            variant="secondary"
          />
        </Card>
      ))}
    </View>
  );
}

function DesignPickerModal({
  designs,
  onClose,
  onSelect,
  selectedVersionId,
  visible,
}: {
  designs: PublicDesign[];
  onClose: () => void;
  onSelect: (versionId: string) => void;
  selectedVersionId: string;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <View style={styles.modal}>
        <View style={uiStyles.between}>
          <Text style={uiStyles.sectionTitle}>Change design</Text>
          <Pressable onPress={onClose} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>Done</Text>
          </Pressable>
        </View>
        <Text style={uiStyles.muted}>
          Changing design keeps matching field values and uses defaults for new
          fields.
        </Text>
        <ScrollView contentContainerStyle={styles.modalList}>
          {designs.map((design) => {
            const version = design.versions[0];
            if (!version) return null;
            const selected = version.id === selectedVersionId;
            return (
              <Pressable
                key={design.id}
                onPress={() => onSelect(version.id)}
                style={[
                  styles.designOption,
                  selected && styles.designOptionActive,
                ]}
              >
                <View>
                  <Text style={styles.toggleLabel}>{design.name}</Text>
                  <Text style={uiStyles.muted}>
                    {design.category?.name ?? "Invitation"} · Version{" "}
                    {version.versionNumber}
                  </Text>
                </View>
                {selected ? <Text style={styles.selectedMark}>✓</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function groupFields(fields: TemplateField[]) {
  const groups = new Map<string, TemplateField[]>();
  fields.forEach((field) => {
    const section = field.section?.trim() || "Invitation content";
    groups.set(section, [...(groups.get(section) ?? []), field]);
  });
  return [...groups.entries()].map(
    ([section, sectionFields]) =>
      [
        section,
        [...sectionFields].sort(
          (a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)),
        ),
      ] as const,
  );
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

const styles = StyleSheet.create({
  recoveryCard: { borderColor: colors.warning, backgroundColor: "#FFF9ED" },
  statusCard: { backgroundColor: colors.surfaceMuted },
  statusCopy: { flex: 1, minWidth: 0, gap: 3 },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.warning,
  },
  statusDotError: { backgroundColor: colors.danger },
  statusDotSaved: { backgroundColor: colors.success },
  warning: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  tabScroll: { flexGrow: 0, marginHorizontal: -spacing.md },
  tabs: { gap: 8, paddingHorizontal: spacing.md },
  tab: {
    minHeight: 42,
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 15,
  },
  tabActive: { borderColor: colors.plum, backgroundColor: colors.plum },
  tabLabel: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  tabLabelActive: { color: colors.white },
  sectionGap: { gap: spacing.md },
  sectionLabel: {
    color: colors.plumDeep,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  textButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  textButtonLabel: { color: colors.plum, fontSize: 14, fontWeight: "900" },
  previewCard: { padding: 10 },
  previewFrame: {
    height: 610,
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceBrand,
  },
  webView: { flex: 1, backgroundColor: colors.surfaceBrand },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 58,
    paddingVertical: 5,
  },
  toggleCopy: { flex: 1, gap: 3 },
  toggleLabel: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  linkCard: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  removeText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
    padding: 6,
  },
  inputLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  fieldChips: { gap: 7 },
  fieldChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  fieldChipActive: {
    borderColor: colors.plum,
    backgroundColor: colors.surfaceBrand,
  },
  fieldChipLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  fieldChipLabelActive: { color: colors.plumDeep },
  disabled: { opacity: 0.4 },
  footerNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  modal: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.canvas,
  },
  modalList: { gap: spacing.sm, paddingBottom: spacing.xl },
  designOption: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  designOptionActive: {
    borderColor: colors.plum,
    backgroundColor: colors.surfaceBrand,
  },
  selectedMark: { color: colors.plum, fontSize: 22, fontWeight: "900" },
});
