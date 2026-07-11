"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { UserWorkspace } from "../../user-workspace";
import {
  formatEventDate,
  InvitationInvitee,
  EventStatistics,
  EventActivity,
  EventDesignRevision,
  EventRsvpResponse,
  RsvpConfig,
  RsvpFieldConfig,
  UserEvent,
} from "../event-types";
import {
  csvCell,
  InviteeManager,
  validateInviteeDrafts,
} from "../invitee-manager";
import { InvitationQrCode } from "../qr-code";
import { EventDesignEditor } from "../event-design-editor";

type PublicDesign = {
  id: string;
  name: string;
  versions: {
    id: string;
    rawHtml: string;
    featureConfig?: Record<string, unknown> | null;
    scanResult?: UserEvent["designVersion"] extends infer T
      ? T extends { scanResult?: infer S }
        ? S
        : never
      : never;
  }[];
};

type CsvImportState = {
  headers: string[];
  rows: string[][];
  mapping: Record<string, number>;
} | null;

type EventWorkspaceCache = {
  event: UserEvent;
  invitees: InvitationInvitee[];
  expiresAt: number;
};

type EventTab =
  | "overview"
  | "invitation"
  | "guests"
  | "rsvp"
  | "sharing"
  | "activity"
  | "settings";

type RsvpWorkspaceTab = "form" | "responses" | "follow-up";

type MobileAction = {
  label: string;
  action?: () => void;
  disabled: boolean;
  submitFormId?: string;
};

const eventTabs: { id: EventTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "invitation", label: "Invitation" },
  { id: "guests", label: "Guests" },
  { id: "rsvp", label: "RSVP" },
  { id: "sharing", label: "Sharing" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

const eventWorkspaceCache = new Map<string, EventWorkspaceCache>();

export default function EventDetailPage() {
  return (
    <UserWorkspace activePage="events">
      {({ authHeaders, showToast }) => (
        <EventDetailContent authHeaders={authHeaders} showToast={showToast} />
      )}
    </UserWorkspace>
  );
}

function EventDetailContent({
  authHeaders,
  showToast,
}: {
  authHeaders: Record<string, string>;
  showToast: (message: string, tone?: "success" | "error") => void;
}) {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = params.eventId;
  const cacheKey = `${authHeaders.Authorization ?? "anonymous"}:${eventId}`;
  const cachedWorkspace = eventWorkspaceCache.get(cacheKey);
  const [event, setEvent] = useState<UserEvent | null>(
    cachedWorkspace?.event ?? null,
  );
  const [invitees, setInvitees] = useState<InvitationInvitee[]>(
    cachedWorkspace?.invitees ?? [],
  );
  const [inviteeInput, setInviteeInput] = useState("");
  const [inviteePaste, setInviteePaste] = useState("");
  const [inviteeSearch, setInviteeSearch] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [sharePreviewDevice, setSharePreviewDevice] = useState<
    "mobile" | "desktop"
  >("mobile");
  const [activeTab, setActiveTab] = useState<EventTab>("overview");
  const [showEventMenu, setShowEventMenu] = useState(false);
  const [showCreatedSuccess, setShowCreatedSuccess] = useState(
    searchParams.get("created") === "1",
  );
  const [showConfetti, setShowConfetti] = useState(false);
  const [isLoading, setIsLoading] = useState(!cachedWorkspace);
  const [isInviteeLoading, setIsInviteeLoading] = useState(!cachedWorkspace);
  const [isSaving, setIsSaving] = useState(false);
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [rsvpResponses, setRsvpResponses] = useState<EventRsvpResponse[]>([]);
  const [activity, setActivity] = useState<EventActivity[]>([]);
  const [revisions, setRevisions] = useState<EventDesignRevision[]>([]);
  const [designs, setDesigns] = useState<PublicDesign[]>([]);
  const [rsvpDraft, setRsvpDraft] = useState<RsvpConfig>(defaultRsvpConfig());
  const [rsvpWorkspaceTab, setRsvpWorkspaceTab] =
    useState<RsvpWorkspaceTab>("form");
  const [isRsvpDeadlineEnabled, setIsRsvpDeadlineEnabled] = useState(false);
  const [isRsvpNoteEnabled, setIsRsvpNoteEnabled] = useState(false);
  const [csvImport, setCsvImport] = useState<CsvImportState>(null);
  const [deletedInvitee, setDeletedInvitee] =
    useState<InvitationInvitee | null>(null);
  const deleteTimer = useRef<number | null>(null);

  useEffect(() => {
    let isActive = true;
    const cached = eventWorkspaceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setEvent(cached.event);
      setInvitees(cached.invitees);
      setIsLoading(false);
      setIsInviteeLoading(false);
      return;
    }

    setIsLoading(true);
    setIsInviteeLoading(true);

    Promise.all([
      apiRequest<UserEvent>(`/events/${eventId}`, { headers: authHeaders }),
      apiRequest<InvitationInvitee[]>(`/events/${eventId}/invitees`, {
        headers: authHeaders,
      }),
      apiRequest<EventStatistics>(`/events/${eventId}/statistics`, {
        headers: authHeaders,
      }),
      apiRequest<EventActivity[]>(`/events/${eventId}/activity`, {
        headers: authHeaders,
      }),
      apiRequest<EventRsvpResponse[]>(`/events/${eventId}/rsvp-responses`, {
        headers: authHeaders,
      }),
      apiRequest<EventDesignRevision[]>(`/events/${eventId}/design-revisions`, {
        headers: authHeaders,
      }),
      apiRequest<PublicDesign[]>("/template-design/public/designs"),
    ])
      .then(
        ([
          item,
          items,
          eventStatistics,
          eventActivity,
          eventRsvpResponses,
          designRevisions,
          publicDesigns,
        ]) => {
          if (!isActive) return;
          eventWorkspaceCache.set(cacheKey, {
            event: item,
            invitees: items,
            expiresAt: Date.now() + 5 * 60_000,
          });
          setEvent(item);
          setInvitees(items);
          setStatistics(eventStatistics);
          setActivity(eventActivity);
          setRsvpResponses(eventRsvpResponses);
          setRevisions(designRevisions);
          setDesigns(publicDesigns);
        },
      )
      .catch((error) => {
        if (!isActive) return;
        showToast(
          error instanceof Error ? error.message : "Could not load the event.",
          "error",
        );
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
        setIsInviteeLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [authHeaders, cacheKey, eventId, showToast]);

  useEffect(() => {
    if (!event) return;
    eventWorkspaceCache.set(cacheKey, {
      event,
      invitees,
      expiresAt: Date.now() + 5 * 60_000,
    });
  }, [cacheKey, event, invitees]);

  useEffect(() => {
    if (!event) return;
    const config = normalizeRsvpConfig(event.rsvpConfig);
    setRsvpDraft(config);
    setIsRsvpDeadlineEnabled(Boolean(event.rsvpDeadline));
    setIsRsvpNoteEnabled(Boolean(config.note.trim()));
  }, [event]);

  useEffect(() => {
    setShowEventMenu(false);
  }, [activeTab]);

  const draftInvitees = useMemo(
    () =>
      validateInviteeDrafts(
        [...inviteeInput.split(/\n/), ...inviteePaste.split(/\n/)],
        invitees,
      ),
    [inviteeInput, inviteePaste, invitees],
  );
  const readiness = useMemo(
    () => [
      { label: "Event title", ready: (event?.title.trim().length ?? 0) >= 2 },
      { label: "Date", ready: Boolean(event?.eventDate) },
      { label: "Venue", ready: Boolean(event?.venue) },
      { label: "Invitation design", ready: Boolean(event?.designVersion?.id) },
      { label: "Guests", ready: invitees.length > 0 },
      { label: "RSVP deadline", ready: Boolean(event?.rsvpDeadline) },
    ],
    [event, invitees.length],
  );

  async function refreshInsights() {
    const [nextStatistics, nextActivity, nextResponses] = await Promise.all([
      apiRequest<EventStatistics>(`/events/${eventId}/statistics`, {
        headers: authHeaders,
      }),
      apiRequest<EventActivity[]>(`/events/${eventId}/activity`, {
        headers: authHeaders,
      }),
      apiRequest<EventRsvpResponse[]>(`/events/${eventId}/rsvp-responses`, {
        headers: authHeaders,
      }),
    ]);
    setStatistics(nextStatistics);
    setActivity(nextActivity);
    setRsvpResponses(nextResponses);
  }

  async function copyShareLink() {
    if (!event) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/invite/${event.slug}`,
    );
    await apiRequest(`/events/${event.id}/share`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ channel: "COPY" }),
    });
    showToast("Event link copied.");
  }

  async function generateInviteeLinks() {
    if (!event) return;
    const names = draftInvitees
      .filter((draft) => draft.status === "Ready")
      .map((draft) => draft.name);
    if (!names.length) {
      showToast("Add at least one valid guest name.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest<{
        created: InvitationInvitee[];
        skipped: { name: string; reason: string }[];
      }>(`/events/${event.id}/invitees`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ names }),
      });
      setInvitees((current) => [...current, ...response.created]);
      setEvent((current) =>
        current
          ? {
              ...current,
              _count: {
                invitees:
                  (current._count?.invitees ?? 0) + response.created.length,
              },
            }
          : current,
      );
      setInviteeInput("");
      setInviteePaste("");
      void refreshInsights();
      markEventsChanged();
      showToast(
        response.skipped.length
          ? `Created ${response.created.length} links. Skipped ${response.skipped.length} duplicates.`
          : `Created ${response.created.length} guest links.`,
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not create links.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteInvitee(invitee: InvitationInvitee) {
    if (!event) return;
    if (!window.confirm(`Delete ${invitee.name}'s personalized link?`)) return;
    setInvitees((current) => current.filter((item) => item.id !== invitee.id));
    setDeletedInvitee(invitee);
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    deleteTimer.current = window.setTimeout(async () => {
      try {
        await apiRequest(`/events/${event.id}/invitees/${invitee.id}`, {
          method: "DELETE",
          headers: authHeaders,
        });
        setEvent((current) =>
          current
            ? {
                ...current,
                _count: {
                  invitees: Math.max(0, (current._count?.invitees ?? 0) - 1),
                },
              }
            : current,
        );
        markEventsChanged();
        showToast("Guest deleted.");
        setDeletedInvitee(null);
        void refreshInsights();
      } catch (error) {
        setInvitees((current) => [...current, invitee]);
        showToast(
          error instanceof Error ? error.message : "Could not delete guest.",
          "error",
        );
      }
    }, 5000);
  }

  function undoDeleteInvitee() {
    if (!deletedInvitee) return;
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    setInvitees((current) => [...current, deletedInvitee]);
    setDeletedInvitee(null);
    showToast("Guest deletion undone.");
  }

  async function regenerateInvitee(invitee: InvitationInvitee) {
    if (!event) return;
    if (
      !window.confirm(
        `Regenerate ${invitee.name}'s link? Their old link will stop working.`,
      )
    )
      return;
    try {
      const updated = await apiRequest<InvitationInvitee>(
        `/events/${event.id}/invitees/${invitee.id}/regenerate`,
        { method: "POST", headers: authHeaders },
      );
      setInvitees((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      void refreshInsights();
      showToast("Guest link regenerated.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not regenerate link.",
        "error",
      );
    }
  }

  async function copyInviteeLink(invitee: InvitationInvitee) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/invite/${invitee.slug}`,
    );
    await logInviteeShare(invitee, "COPY");
    showToast("Guest link copied.");
  }

  async function copyAllInviteeLinks() {
    const rows = invitees.map(
      (invitee) =>
        `${invitee.name},${window.location.origin}/invite/${invitee.slug}`,
    );
    await navigator.clipboard.writeText(
      ["Guest Name,Link", ...rows].join("\n"),
    );
    showToast("All invitee links copied.");
  }

  function downloadInviteeCsv() {
    const rows = invitees.map((invitee) =>
      [
        invitee.name,
        invitee.email ?? "",
        invitee.phone ?? "",
        invitee.groupName ?? "",
        invitee.rsvpStatus,
        String(invitee.partySize ?? ""),
        invitee.mealPreference ?? "",
        invitee.rsvpMessage ?? "",
        String(invitee.openCount),
        invitee.lastOpenedAt ?? "",
        invitee.lastShareChannel ?? "",
        invitee.lastSharedAt ?? "",
        `${window.location.origin}/invite/${invitee.slug}`,
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = [
      [
        "Guest Name",
        "Email",
        "Phone",
        "Group",
        "RSVP",
        "Party Size",
        "Meal",
        "Message",
        "Opens",
        "Last Opened",
        "Last Share Channel",
        "Last Shared",
        "Link",
      ].join(","),
      ...rows,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event?.slug ?? "invitees"}-links.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadRsvpCsv() {
    const exportFields = rsvpDraft.fields.filter((field) => field.enabled);
    const rows = buildRsvpResponseRows(
      invitees,
      rsvpResponses,
      exportFields,
    ).map((response) =>
      [
        response.source,
        response.submittedAt,
        ...exportFields.map((field) =>
          csvResponseValue(response.answers, field.key),
        ),
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = [
      [
        "Source",
        "Submitted At",
        ...exportFields.map((field) => field.label),
      ].join(","),
      ...rows,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event?.slug ?? "event"}-rsvp-responses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function readInviteeCsv(file?: File) {
    if (!file) return;
    const text = await file.text();
    const rows = text
      .split(/\r?\n/)
      .map((line) =>
        line
          .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map((cell) => cell.trim().replace(/^"|"$/g, "")),
      );
    const headers = rows[0] ?? [];
    const normalizedHeaders = headers.map((header) => header.toLowerCase());
    const nameColumn = normalizedHeaders.findIndex((header) =>
      ["invitee name", "name", "full name", "guest name"].includes(header),
    );
    const guess = (candidates: string[]) =>
      normalizedHeaders.findIndex((header) => candidates.includes(header));
    setCsvImport({
      headers,
      rows: rows.slice(1).filter((row) => row.some(Boolean)),
      mapping: {
        name: nameColumn >= 0 ? nameColumn : 0,
        email: guess(["email", "email address"]),
        phone: guess(["phone", "mobile", "whatsapp"]),
        groupName: guess(["group", "family", "category"]),
        mealPreference: guess(["meal", "meal preference", "food"]),
      },
    });
  }

  async function importMappedCsv() {
    if (!event || !csvImport) return;
    const existingNames = new Set(
      invitees.map((invitee) => invitee.name.trim().toLowerCase()),
    );
    const seenNames = new Set<string>();
    const guests = csvImport.rows
      .map((row) => mappedCsvGuest(row, csvImport.mapping))
      .filter((guest) => {
        const normalizedName = guest.name.trim().toLowerCase();
        if (!normalizedName) return false;
        if (existingNames.has(normalizedName) || seenNames.has(normalizedName))
          return false;
        seenNames.add(normalizedName);
        return true;
      });
    const response = await apiRequest<{
      created: InvitationInvitee[];
      skipped: { name: string; reason: string }[];
    }>(`/events/${event.id}/invitees/import`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ guests }),
    });
    setInvitees((current) => [...current, ...response.created]);
    setCsvImport(null);
    showToast(
      `Imported ${response.created.length} guests${response.skipped.length ? `; ${response.skipped.length} skipped` : ""}.`,
    );
    void refreshInsights();
  }

  async function updateInvitee(
    invitee: InvitationInvitee,
    values: Record<string, unknown>,
  ) {
    if (!event) return;
    const updated = await apiRequest<InvitationInvitee>(
      `/events/${event.id}/invitees/${invitee.id}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(values),
      },
    );
    setInvitees((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    showToast("Guest details saved.");
    void refreshInsights();
  }

  async function toggleInviteeLink(invitee: InvitationInvitee) {
    if (!event) return;
    const action = invitee.linkDisabledAt ? "enable" : "disable";
    const updated = await apiRequest<InvitationInvitee>(
      `/events/${event.id}/invitees/${invitee.id}/${action}`,
      { method: "POST", headers: authHeaders },
    );
    setInvitees((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    showToast(`Guest link ${action}d.`);
  }

  async function logInviteeShare(invitee: InvitationInvitee, channel: string) {
    if (!event) return;
    await apiRequest(`/events/${event.id}/invitees/${invitee.id}/share`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ channel }),
    });
    setInvitees((current) =>
      current.map((item) =>
        item.id === invitee.id
          ? {
              ...item,
              lastSharedAt: new Date().toISOString(),
              lastShareChannel: channel,
            }
          : item,
      ),
    );
    void refreshInsights();
  }

  async function saveEventDetails(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event) return;
    const form = new FormData(eventForm.currentTarget);
    const wantsPublished = form.get("isPublished") === "on";
    if (
      wantsPublished &&
      (!String(form.get("eventDate") || "") ||
        !String(form.get("venue") || "").trim() ||
        !event.designVersion?.id)
    ) {
      showToast(
        "Add the event date, venue, and invitation design before publishing.",
        "error",
      );
      return;
    }
    setIsSaving(true);
    try {
      const updated = await apiRequest<UserEvent>(`/events/${event.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          title: String(form.get("title") || event.title),
          type: String(form.get("type") || event.type),
          eventDate: form.get("eventDate") || event.eventDate || undefined,
          venue: String(form.get("venue") || event.venue || ""),
          description: String(
            form.get("description") || event.description || "",
          ),
          rsvpDeadline: isRsvpDeadlineEnabled
            ? form.get("rsvpDeadline") || null
            : null,
          organizerNotes: String(
            form.get("organizerNotes") || event.organizerNotes || "",
          ),
          checklist: {
            details: form.has("checklistDetails")
              ? form.get("checklistDetails") === "on"
              : Boolean(event.checklist?.details),
            guests: form.has("checklistGuests")
              ? form.get("checklistGuests") === "on"
              : Boolean(event.checklist?.guests),
            reviewed: form.has("checklistReviewed")
              ? form.get("checklistReviewed") === "on"
              : Boolean(event.checklist?.reviewed),
            shared: form.has("checklistShared")
              ? form.get("checklistShared") === "on"
              : Boolean(event.checklist?.shared),
          },
          rsvpConfig: {
            ...rsvpDraft,
            note: form.has("rsvpNote")
              ? String(form.get("rsvpNote") || "")
              : rsvpDraft.note,
            closedMessage: form.has("rsvpClosedMessage")
              ? String(form.get("rsvpClosedMessage") || "") ||
                "Sorry, RSVP is closed for this event."
              : rsvpDraft.closedMessage,
          },
          isPublished: form.has("isPublished")
            ? wantsPublished
            : event.isPublished,
        }),
      });
      setEvent((current) => (current ? { ...current, ...updated } : updated));
      markEventsChanged();
      showToast("Event details saved.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not save event.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveRsvpSetup(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event) return;
    const form = new FormData(eventForm.currentTarget);
    setIsSaving(true);
    try {
      const updated = await apiRequest<UserEvent>(`/events/${event.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          rsvpDeadline: form.get("rsvpDeadline") || null,
          rsvpConfig: {
            ...rsvpDraft,
            note: isRsvpNoteEnabled ? rsvpDraft.note : "",
          },
        }),
      });
      setEvent((current) => (current ? { ...current, ...updated } : updated));
      setRsvpDraft(normalizeRsvpConfig(updated.rsvpConfig));
      markEventsChanged();
      showToast("RSVP setup saved.");
      void refreshInsights();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not save RSVP setup.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updateRsvpField(fieldId: string, patch: Partial<RsvpFieldConfig>) {
    setRsvpDraft((current) => ({
      ...current,
      fields: current.fields.map((field) =>
        field.id === fieldId ? { ...field, ...patch } : field,
      ),
    }));
  }

  function removeRsvpField(fieldId: string) {
    setRsvpDraft((current) => ({
      ...current,
      fields: current.fields.filter(
        (field) => field.id !== fieldId || field.builtIn,
      ),
    }));
  }

  function addCustomRsvpField() {
    const suffix =
      rsvpDraft.fields.filter((field) => !field.builtIn).length + 1;
    setRsvpDraft((current) => ({
      ...current,
      fields: [
        ...current.fields,
        {
          id: `custom_${Date.now()}_${suffix}`,
          key: `custom_field_${suffix}`,
          label: `Custom field ${suffix}`,
          type: "text",
          required: false,
          enabled: true,
          builtIn: false,
          options: [],
          placeholder: "",
        },
      ],
    }));
  }

  async function duplicateEvent() {
    if (!event) return;
    setIsSaving(true);
    try {
      const duplicate = await apiRequest<UserEvent>(
        `/events/${event.id}/duplicate`,
        {
          method: "POST",
          headers: authHeaders,
        },
      );
      markEventsChanged();
      showToast("Event duplicated as a draft.");
      router.push(`/events/${duplicate.id}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleArchive() {
    if (!event) return;
    const action = event.archivedAt ? "restore" : "archive";
    if (
      !event.archivedAt &&
      !window.confirm("Archive this event and disable its public links?")
    )
      return;
    const updated = await apiRequest<UserEvent>(
      `/events/${event.id}/${action}`,
      {
        method: "POST",
        headers: authHeaders,
      },
    );
    setEvent((current) => (current ? { ...current, ...updated } : updated));
    markEventsChanged();
    showToast(action === "archive" ? "Event archived." : "Event restored.");
  }

  async function deleteEvent() {
    if (
      !event ||
      !window.confirm(
        `Permanently delete “${event.title}” and all guest links?`,
      )
    )
      return;
    await apiRequest(`/events/${event.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    markEventsChanged();
    showToast("Event deleted.");
    router.replace("/events");
  }

  function shareEvent(channel: "email" | "whatsapp" | "messenger") {
    if (!event) return;
    const url = `${window.location.origin}/invite/${event.slug}`;
    const message = `${event.title}: ${url}`;
    const target =
      channel === "email"
        ? `mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(message)}`
        : channel === "whatsapp"
          ? `https://wa.me/?text=${encodeURIComponent(message)}`
          : `fb-messenger://share/?link=${encodeURIComponent(url)}`;
    window.open(target, "_blank", "noopener,noreferrer");
    void apiRequest(`/events/${event.id}/share`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        channel:
          channel === "email"
            ? "EMAIL"
            : channel === "whatsapp"
              ? "WHATSAPP"
              : "MESSENGER",
      }),
    }).then(() => refreshInsights());
  }

  async function nativeShareEvent() {
    if (!event) return;
    const url = `${window.location.origin}/invite/${event.slug}`;
    if (navigator.share) {
      await navigator.share({
        title: event.title,
        text: event.description ?? "",
        url,
      });
      await apiRequest(`/events/${event.id}/share`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ channel: "NATIVE" }),
      });
      void refreshInsights();
    } else {
      await copyShareLink();
    }
  }

  async function publishEvent() {
    if (!event) return;
    if (!event.eventDate || !event.venue || !event.designVersion?.id) {
      setActiveTab("settings");
      showToast(
        "Add the event date, venue, and invitation before publishing.",
        "error",
      );
      return;
    }

    setIsSaving(true);
    try {
      let updated = event;
      if (hasInvitationDraft(event)) {
        updated = await apiRequest<UserEvent>(
          `/events/${event.id}/design-draft/publish`,
          { method: "POST", headers: authHeaders },
        );
      }
      if (!updated.isPublished) {
        updated = await apiRequest<UserEvent>(`/events/${event.id}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ isPublished: true }),
        });
      }
      setEvent((current) => (current ? { ...current, ...updated } : updated));
      markEventsChanged();
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 2600);
      showToast("Invitation published and ready to share.");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Could not publish invitation.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openGuestAddSheet() {
    document
      .querySelector<HTMLButtonElement>("[data-add-guests-trigger='true']")
      ?.click();
  }

  if (isLoading && !event) {
    return (
      <section className="user-panel user-empty">Loading event...</section>
    );
  }

  if (!event) {
    return (
      <section className="user-panel user-empty">
        <h1>Event not found</h1>
        <p>This event may have been removed or belongs to another account.</p>
        <Link className="user-primary-button mt-4" href="/events">
          Back to events
        </Link>
      </section>
    );
  }

  const invitationDraft = hasInvitationDraft(event);
  const rsvpClosed = Boolean(
    event.rsvpDeadline && new Date(event.rsvpDeadline).getTime() < Date.now(),
  );
  const rsvpConfig = rsvpDraft;
  const rsvpResponseRows = buildRsvpResponseRows(
    invitees,
    rsvpResponses,
    rsvpConfig.fields,
  );
  const rsvpFollowUpGuests = invitees.filter(
    (guest) => guest.rsvpStatus === "PENDING" || guest.openCount === 0,
  );
  const status = event.archivedAt
    ? "Archived"
    : invitationDraft
      ? "Unpublished changes"
      : event.isPublished
        ? rsvpClosed
          ? "RSVP closed"
          : "Published"
        : "Draft";
  const readyCount = readiness.filter((item) => item.ready).length;
  const journey = [
    {
      label: "Choose invitation",
      ready: Boolean(event.designVersion?.id),
      tab: "invitation" as EventTab,
    },
    {
      label: "Add details",
      ready: readiness.slice(0, 3).every((item) => item.ready),
      tab: "settings" as EventTab,
    },
    {
      label: "Add guests",
      ready: invitees.length > 0,
      tab: "guests" as EventTab,
    },
    {
      label: "Review",
      ready: Boolean(event.checklist?.reviewed),
      tab: "invitation" as EventTab,
    },
    {
      label: "Publish & share",
      ready: event.isPublished,
      tab: "sharing" as EventTab,
    },
    {
      label: "Track RSVPs",
      ready: Boolean(statistics?.invitationOpens),
      tab: "rsvp" as EventTab,
    },
  ];
  const nextStep =
    journey.find((step) => !step.ready) ?? journey[journey.length - 1];
  const inviteUrl =
    typeof window === "undefined"
      ? `/invite/${event.slug}`
      : `${window.location.origin}/invite/${event.slug}`;
  const suggestedShareMessage = `You’re invited to ${event.title}. Open your invitation here: ${inviteUrl}`;
  const mobilePrimaryAction: MobileAction =
    activeTab === "overview"
      ? {
          label: "Continue",
          action: () => setActiveTab(nextStep.tab),
          disabled: false,
        }
      : activeTab === "invitation"
        ? {
            label: showPreview ? "Hide preview" : "Preview invite",
            action: () => {
              setActiveTab("invitation");
              setShowPreview((current) => !current);
            },
            disabled: false,
          }
        : activeTab === "guests"
          ? {
              label: "Add guests",
              action: openGuestAddSheet,
              disabled: false,
            }
          : activeTab === "sharing"
            ? {
                label: "Copy link",
                action: () => void copyShareLink(),
                disabled: !event.isPublished,
              }
            : activeTab === "settings"
              ? {
                  label: isSaving ? "Saving..." : "Save details",
                  action: undefined,
                  disabled: isSaving,
                  submitFormId: "event-settings-form",
                }
              : activeTab === "rsvp"
                ? {
                    label: "Manage guests",
                    action: () => setActiveTab("guests"),
                    disabled: false,
                  }
                : {
                    label: "Open sharing",
                    action: () => setActiveTab("sharing"),
                    disabled: false,
                  };
  const mobileSecondaryAction: MobileAction =
    activeTab === "overview"
      ? {
          label: "Preview",
          action: () => {
            setActiveTab("invitation");
            setShowPreview(true);
          },
          disabled: false,
        }
      : activeTab === "invitation"
        ? {
            label: event.isPublished && !invitationDraft ? "Share" : "Publish",
            action: () =>
              event.isPublished && !invitationDraft
                ? void nativeShareEvent()
                : void publishEvent(),
            disabled:
              isSaving ||
              (!event.isPublished &&
                (!event.eventDate || !event.venue || !event.designVersion?.id)),
          }
        : activeTab === "guests"
          ? {
              label: "Copy all",
              action: () => void copyAllInviteeLinks(),
              disabled: !invitees.length,
            }
          : activeTab === "sharing"
            ? {
                label: "Preview",
                action: () => {
                  setActiveTab("invitation");
                  setShowPreview(true);
                },
                disabled: false,
              }
            : activeTab === "settings"
              ? {
                  label:
                    event.isPublished && !invitationDraft
                      ? "Sharing"
                      : "Review invite",
                  action: () =>
                    event.isPublished && !invitationDraft
                      ? setActiveTab("sharing")
                      : setActiveTab("invitation"),
                  disabled: false,
                }
              : activeTab === "rsvp"
                ? {
                    label: "Share",
                    action: () => setActiveTab("sharing"),
                    disabled: false,
                  }
                : {
                    label: "Preview",
                    action: () => {
                      setActiveTab("invitation");
                      setShowPreview(true);
                    },
                    disabled: false,
                  };

  return (
    <div className="event-detail-page">
      {showConfetti ? <CelebrationConfetti /> : null}
      <header className="event-workspace-header">
        <div className="event-detail-title">
          <Link href="/events">← All events</Link>
          <div className="event-title-line">
            <div>
              <p className="user-kicker">{event.type}</p>
              <h1>{event.title}</h1>
            </div>
            <span className={`user-status ${statusClass(status)}`}>
              {status}
            </span>
          </div>
          <p>{event.description || "Manage this invitation and its guests."}</p>
          {invitationDraft ? (
            <p className="event-version-warning">
              Guests are still seeing the previous published version.
            </p>
          ) : null}
        </div>
        <div className="event-workspace-actions">
          <span className="event-save-state">
            {isSaving
              ? "Saving…"
              : invitationDraft
                ? "Draft changes saved"
                : status}
          </span>
          <button
            className="user-secondary-button"
            onClick={() => {
              setActiveTab("invitation");
              setShowPreview((current) => !current);
            }}
            type="button"
          >
            {showPreview ? "Close preview" : "Preview as guest"}
          </button>
          <button
            className="user-primary-button event-action-desktop"
            disabled={isSaving || Boolean(event.archivedAt)}
            onClick={() => void publishEvent()}
            type="button"
          >
            {event.isPublished && !invitationDraft ? "Published" : "Publish"}
          </button>
          <button
            className="user-secondary-button event-action-desktop"
            disabled={isSaving}
            onClick={() => void duplicateEvent()}
            type="button"
          >
            Duplicate
          </button>
          <button
            className="user-secondary-button"
            disabled={!event.isPublished}
            onClick={() => {
              setActiveTab("sharing");
              void nativeShareEvent();
            }}
            type="button"
          >
            Share
          </button>
          <div className="event-action-menu">
            <button
              aria-expanded={showEventMenu}
              aria-label="More event actions"
              className="user-secondary-button event-menu-trigger"
              onClick={() => setShowEventMenu((current) => !current)}
              type="button"
            >
              •••
            </button>
            {showEventMenu ? (
              <div className="event-menu-popover">
                <button
                  disabled={isSaving || Boolean(event.archivedAt)}
                  onClick={() => void publishEvent()}
                  type="button"
                >
                  {event.isPublished && !invitationDraft
                    ? "Republish invitation"
                    : "Publish invitation"}
                </button>
                <button
                  disabled={isSaving}
                  onClick={() => void duplicateEvent()}
                  type="button"
                >
                  Duplicate event
                </button>
                <button onClick={() => void toggleArchive()} type="button">
                  {event.archivedAt ? "Restore event" : "Archive event"}
                </button>
                <button
                  className="danger"
                  onClick={() => void deleteEvent()}
                  type="button"
                >
                  Delete event
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <nav className="event-tabs" aria-label="Event workspace">
        {eventTabs.map((tab) => (
          <button
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <label className="event-tab-select">
        <span className="sr-only">Event section</span>
        <select
          value={activeTab}
          onChange={(change) => setActiveTab(change.target.value as EventTab)}
        >
          {eventTabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </label>

      <div className="event-mobile-progress" aria-label="Event progress">
        <span>
          {readyCount}/{readiness.length} ready
        </span>
        <strong>{nextStep.label}</strong>
      </div>

      {activeTab === "overview" ? (
        <div className="event-tab-content">
          <section
            className="event-meta-grid event-primary-stats"
            aria-label="Event performance"
          >
            <article>
              <span>Invited</span>
              <strong>{statistics?.totalInvitees ?? invitees.length}</strong>
            </article>
            <article>
              <span>Opened</span>
              <strong>{statistics?.openedInvitees ?? 0}</strong>
            </article>
            <article>
              <span>Attending</span>
              <strong>{statistics?.attending ?? 0}</strong>
            </article>
            <article>
              <span>Pending</span>
              <strong>{statistics?.pending ?? 0}</strong>
            </article>
          </section>
          <section className="user-panel event-next-action">
            <div>
              <p className="user-kicker">Next best action</p>
              <h2>{nextStep.label}</h2>
              <p>
                {readyCount}/{readiness.length} basics are ready. You can save
                changes anytime; guests only see the published invitation.
              </p>
            </div>
            <button
              className="user-primary-button"
              onClick={() => setActiveTab(nextStep.tab)}
              type="button"
            >
              Continue
            </button>
          </section>
          <section className="user-panel">
            <div className="event-section-heading">
              <div>
                <p className="user-kicker">Event journey</p>
                <h2>From invitation to RSVP</h2>
              </div>
            </div>
            <div className="event-journey">
              {journey.map((step, index) => (
                <button
                  className={step.ready ? "complete" : ""}
                  key={step.label}
                  onClick={() => setActiveTab(step.tab)}
                  type="button"
                >
                  <span>{step.ready ? "✓" : index + 1}</span>
                  <strong>{step.label}</strong>
                </button>
              ))}
            </div>
          </section>
          <section className="user-panel event-setup-checklist">
            <div>
              <p className="user-kicker">Setup checklist</p>
              <h2>Before you send the link</h2>
              <p>
                A quick safety check so the invite does not go out missing a
                date, venue, guest name, or preview review.
              </p>
            </div>
            <div>
              {readiness.map((item) => (
                <button
                  className={item.ready ? "ready" : ""}
                  key={item.label}
                  onClick={() =>
                    setActiveTab(
                      item.label === "Guests"
                        ? "guests"
                        : item.label === "Invitation design"
                          ? "invitation"
                          : "settings",
                    )
                  }
                  type="button"
                >
                  <span>{item.ready ? "✓" : "○"}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </section>
          <section className="event-refinement-grid">
            <article className="user-panel">
              <p className="user-kicker">Event details</p>
              <h2>{formatEventDate(event.eventDate)}</h2>
              <p>{event.venue || "Venue not set"}</p>
              <button
                className="user-text-button"
                onClick={() => setActiveTab("settings")}
                type="button"
              >
                Review details →
              </button>
            </article>
            <article className="user-panel event-readiness-card">
              <p className="user-kicker">Readiness</p>
              <h2>
                {readyCount}/{readiness.length} ready
              </h2>
              {readiness.map((item) => (
                <p className={item.ready ? "ready" : ""} key={item.label}>
                  {item.ready ? "✓" : "○"} {item.label}
                </p>
              ))}
            </article>
            <article className="user-panel">
              <p className="user-kicker">Private notes</p>
              <h2>Organizer notes</h2>
              <p>{event.organizerNotes || "No private notes yet."}</p>
              <button
                className="user-text-button"
                onClick={() => setActiveTab("settings")}
                type="button"
              >
                Add notes →
              </button>
            </article>
          </section>
        </div>
      ) : null}

      {activeTab === "invitation" ? (
        <div
          className={
            showPreview
              ? "event-invitation-workspace preview-open"
              : "event-invitation-workspace"
          }
        >
          <EventDesignEditor
            authHeaders={authHeaders}
            designs={designs}
            event={event}
            onEvent={setEvent}
            onRevisions={setRevisions}
            revisions={revisions}
            showToast={showToast}
          />
          {showPreview ? (
            <aside className="user-panel event-preview-drawer">
              <div>
                <p className="user-kicker">Guest preview</p>
                <h2>{event.title}</h2>
                <p>
                  This is the public invitation guests see after you share the
                  link.
                </p>
              </div>
              <div className="event-preview-actions">
                {event.isPublished ? (
                  <Link
                    className="user-secondary-button"
                    href={`/invite/${event.slug}`}
                    target="_blank"
                  >
                    Open full
                  </Link>
                ) : null}
                <button
                  className="user-secondary-button"
                  onClick={() => setShowPreview(false)}
                  type="button"
                >
                  Collapse
                </button>
              </div>
              {event.isPublished ? (
                <iframe
                  sandbox="allow-scripts"
                  src={`/invite/${event.slug}`}
                  title={`${event.title} invitation preview`}
                />
              ) : (
                <div className="event-preview-empty">
                  <h3>Publish to create a public preview</h3>
                  <p>Your editable draft remains private until then.</p>
                </div>
              )}
            </aside>
          ) : null}
        </div>
      ) : null}

      {activeTab === "guests" ? (
        <InviteeManager
          draftInvitees={draftInvitees}
          inviteeInput={inviteeInput}
          inviteePaste={inviteePaste}
          inviteeSearch={inviteeSearch}
          invitees={invitees}
          isLoading={isInviteeLoading}
          isSaving={isSaving}
          onCopyAll={() => void copyAllInviteeLinks()}
          onCopyOne={(invitee) => void copyInviteeLink(invitee)}
          onDelete={(invitee) => void deleteInvitee(invitee)}
          onDownload={downloadInviteeCsv}
          onEdit={(invitee, values) => void updateInvitee(invitee, values)}
          onGenerate={() => void generateInviteeLinks()}
          onInput={setInviteeInput}
          onPaste={setInviteePaste}
          onReadCsv={(file) => void readInviteeCsv(file)}
          onRegenerate={(invitee) => void regenerateInvitee(invitee)}
          onShare={(invitee, channel) => void logInviteeShare(invitee, channel)}
          onSearch={setInviteeSearch}
          onToggleLink={(invitee) => void toggleInviteeLink(invitee)}
        />
      ) : null}

      {activeTab === "rsvp" ? (
        <div className="event-tab-content">
          <section className="rsvp-workspace">
            <header className="rsvp-workspace-header">
              <div>
                <p className="user-kicker">RSVP</p>
                <h2>Collect guest responses</h2>
                <p>Build the form, review replies, and follow up from one place.</p>
              </div>
              <div className="rsvp-stat-strip">
                <span><b>{rsvpResponseRows.length}</b> replies</span>
                <span><b>{statistics?.expectedGuests ?? 0}</b> guests</span>
                <span><b>{rsvpClosed ? "Closed" : "Open"}</b> status</span>
              </div>
            </header>

            <div className="rsvp-workspace-tabs" role="tablist">
              {([
                ["form", "Form"],
                ["responses", `Responses (${rsvpResponseRows.length})`],
                ["follow-up", "Follow-up"],
              ] as const).map(([tab, label]) => (
                <button
                  aria-selected={rsvpWorkspaceTab === tab}
                  className={rsvpWorkspaceTab === tab ? "active" : ""}
                  key={tab}
                  onClick={() => setRsvpWorkspaceTab(tab)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            {rsvpWorkspaceTab === "form" ? (
              <form className="rsvp-form-workspace" onSubmit={saveRsvpSetup}>
                <header className="rsvp-workspace-section-heading">
                  <div>
                    <h3>Guest questions</h3>
                    <p>Only enabled questions appear on the invitation.</p>
                  </div>
                  <button className="user-primary-button" disabled={isSaving} type="submit">
                    {isSaving ? "Saving..." : "Save changes"}
                  </button>
                </header>
                <div className="rsvp-question-list">
                  {rsvpConfig.fields.filter((field) => field.enabled).map((field) => (
                    <article className="rsvp-question-row" key={field.id}>
                      <div className="rsvp-question-main">
                        <input
                          aria-label="Question"
                          onChange={(changeEvent) =>
                            updateRsvpField(field.id, { label: changeEvent.target.value })
                          }
                          value={field.label}
                        />
                        {field.builtIn ? <span>Standard</span> : null}
                      </div>
                      <div className="rsvp-question-controls">
                        <select
                          aria-label="Answer format"
                          disabled={field.builtIn}
                          onChange={(changeEvent) =>
                            updateRsvpField(field.id, {
                              type: changeEvent.target.value as RsvpFieldConfig["type"],
                              options: changeEvent.target.value === "single_choice"
                                ? field.options?.length ? field.options : ["Option 1"]
                                : [],
                            })
                          }
                          value={field.type}
                        >
                          <option value="text">Short text</option>
                          <option value="textarea">Long text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="single_choice">Choice</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                        </select>
                        <label className="event-inline-toggle">
                          <input checked={field.enabled} onChange={(changeEvent) => updateRsvpField(field.id, { enabled: changeEvent.target.checked })} type="checkbox" />
                          Show
                        </label>
                        <label className="event-inline-toggle">
                          <input checked={field.required} onChange={(changeEvent) => updateRsvpField(field.id, { required: changeEvent.target.checked })} type="checkbox" />
                          Required
                        </label>
                        {!field.builtIn ? (
                          <button className="user-text-button" onClick={() => removeRsvpField(field.id)} type="button">Remove</button>
                        ) : null}
                      </div>
                      {field.type === "single_choice" ? (
                        <input
                          aria-label="Choices, separated by commas"
                          className="rsvp-question-options"
                          onChange={(changeEvent) => updateRsvpField(field.id, {
                            options: changeEvent.target.value.split(",").map((option) => option.trim()).filter(Boolean),
                          })}
                          placeholder="Choices, separated by commas"
                          value={(field.options ?? []).join(", ")}
                        />
                      ) : null}
                    </article>
                  ))}
                </div>
                {rsvpConfig.fields.some((field) => !field.enabled) ? (
                  <div className="rsvp-question-additions">
                    <span>Add a common question</span>
                    {rsvpConfig.fields.filter((field) => !field.enabled).map((field) => (
                      <button
                        key={field.id}
                        onClick={() => updateRsvpField(field.id, { enabled: true })}
                        type="button"
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button className="user-secondary-button" onClick={addCustomRsvpField} type="button">
                  Add custom question
                </button>

                <section className="rsvp-optional-settings">
                  <label className="event-inline-toggle">
                    <input checked={isRsvpNoteEnabled} onChange={(changeEvent) => setIsRsvpNoteEnabled(changeEvent.target.checked)} type="checkbox" />
                    Add a note for guests
                  </label>
                  {isRsvpNoteEnabled ? (
                    <textarea
                      aria-label="Note for guests"
                      name="rsvpNote"
                      onChange={(changeEvent) => setRsvpDraft((current) => ({ ...current, note: changeEvent.target.value }))}
                      placeholder="For example: Please reply before the deadline so we can plan the celebration."
                      rows={3}
                      value={rsvpConfig.note}
                    />
                  ) : null}
                </section>
                <section className="rsvp-optional-settings">
                  <label className="event-inline-toggle">
                    <input checked={isRsvpDeadlineEnabled} onChange={(changeEvent) => setIsRsvpDeadlineEnabled(changeEvent.target.checked)} type="checkbox" />
                    Set an RSVP deadline
                  </label>
                  {isRsvpDeadlineEnabled ? (
                    <div className="rsvp-deadline-settings">
                      <input defaultValue={event.rsvpDeadline?.slice(0, 16) ?? ""} name="rsvpDeadline" type="datetime-local" />
                      <textarea
                        aria-label="Message after RSVP closes"
                        name="rsvpClosedMessage"
                        onChange={(changeEvent) => setRsvpDraft((current) => ({ ...current, closedMessage: changeEvent.target.value }))}
                        placeholder="Message guests see after the deadline"
                        rows={2}
                        value={rsvpConfig.closedMessage}
                      />
                    </div>
                  ) : null}
                </section>
              </form>
            ) : null}

            {rsvpWorkspaceTab === "responses" ? (
              <section className="rsvp-responses-workspace">
                <header className="rsvp-workspace-section-heading">
                  <div>
                    <h3>Responses</h3>
                    <p>Every reply is ready to export in the same order as your form.</p>
                  </div>
                  <button className="user-secondary-button" onClick={downloadRsvpCsv} type="button">Export CSV</button>
                </header>
                {statistics?.mealTotals.length ? (
                  <div className="rsvp-meal-summary">
                    <span>Meal needs</span>
                    {statistics.mealTotals.map((meal) => <b key={meal.meal}>{meal.count} {meal.meal}</b>)}
                  </div>
                ) : null}
                {rsvpResponseRows.length ? (
                  <div className="event-rsvp-response-list rsvp-response-list-full">
                    {rsvpResponseRows.map((response) => (
                      <div key={response.id}>
                        <div>
                          <strong>{csvResponseValue(response.answers, "full_name") || "Unnamed guest"}</strong>
                          <span>{response.source} · {response.statusLabel}</span>
                        </div>
                        <time>{formatEventDate(response.submittedAt)}</time>
                      </div>
                    ))}
                  </div>
                ) : <div className="user-empty"><h3>No responses yet</h3><p>Responses will appear here once guests submit the form.</p></div>}
              </section>
            ) : null}

            {rsvpWorkspaceTab === "follow-up" ? (
              <section className="rsvp-responses-workspace">
                <header className="rsvp-workspace-section-heading">
                  <div>
                    <h3>Follow up with guests</h3>
                    <p>Only guests who have not replied are shown here.</p>
                  </div>
                </header>
                <div className="event-rsvp-response-list rsvp-response-list-full">
                  {rsvpFollowUpGuests.map((guest) => (
                    <div key={guest.id}>
                      <div><strong>{guest.name}</strong><span>{guest.openCount === 0 ? "Invitation not opened" : "Awaiting RSVP"}</span></div>
                      {guest.phone ? <a href={`https://wa.me/${guest.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Reminder: please view and RSVP to ${event.title}: ${typeof window === "undefined" ? "" : window.location.origin}/invite/${guest.slug}`)}`} onClick={() => void logInviteeShare(guest, "WHATSAPP")} target="_blank">Remind</a> : null}
                    </div>
                  ))}
                </div>
                {!invitees.length ? <div className="user-empty"><h3>No guests yet</h3><p>Add guests to send personalized RSVP reminders.</p></div> : null}
                {invitees.length && !rsvpFollowUpGuests.length ? <div className="user-empty"><h3>Everyone has replied</h3><p>There are no guests waiting for a reminder.</p></div> : null}
              </section>
            ) : null}
          </section>
        </div>
      ) : null}

      {activeTab === "sharing" ? (
        <div className="event-tab-content">
          <section className="share-preparation-card">
            <div className={`share-preparation-preview ${sharePreviewDevice}`}>
              {event.isPublished ? (
                <iframe
                  sandbox="allow-scripts"
                  src={`/invite/${event.slug}`}
                  title={`${event.title} sharing preview`}
                />
              ) : (
                <div>
                  <span>✦</span>
                  <strong>Invitation preview</strong>
                  <p>Publish to activate the public link.</p>
                </div>
              )}
            </div>
            <div className="share-preparation-details">
              <div className="share-review-heading">
                <div>
                  <p className="user-kicker">Final review</p>
                  <h2>{event.title}</h2>
                </div>
                <div className="event-device-switcher">
                  {(["mobile", "desktop"] as const).map((device) => (
                    <button
                      className={sharePreviewDevice === device ? "active" : ""}
                      key={device}
                      onClick={() => setSharePreviewDevice(device)}
                      type="button"
                    >
                      {device}
                    </button>
                  ))}
                </div>
              </div>
              <div className="share-final-review-grid">
                <article>
                  <span>Date</span>
                  <strong>{formatEventDate(event.eventDate)}</strong>
                </article>
                <article>
                  <span>Venue</span>
                  <strong>{event.venue || "Not added"}</strong>
                </article>
                <article>
                  <span>Guests</span>
                  <strong>{invitees.length}</strong>
                </article>
                <article>
                  <span>RSVP deadline</span>
                  <strong>
                    {event.rsvpDeadline
                      ? formatEventDate(event.rsvpDeadline)
                      : "Not set"}
                  </strong>
                </article>
              </div>
              <div className="share-check-list">
                <span className={event.isPublished ? "ready" : ""}>
                  {event.isPublished ? "✓" : "○"} Invitation published
                </span>
                <span className={invitees.length ? "ready" : ""}>
                  {invitees.length ? "✓" : "○"} {invitees.length} guests added
                </span>
                <span className={event.rsvpDeadline ? "ready" : ""}>
                  {event.rsvpDeadline ? "✓" : "○"} RSVP deadline{" "}
                  {event.rsvpDeadline
                    ? formatEventDate(event.rsvpDeadline)
                    : "not set"}
                </span>
              </div>
              <p className="share-suggested-message">
                “{suggestedShareMessage}”
              </p>
              <div className="share-reassurance-grid">
                <span>Only people with the link can open this invite.</span>
                <span>
                  Guest names personalize only when using guest links.
                </span>
                <span>You can still edit details after sharing.</span>
                <span>CSV uploads add guests; they do not notify anyone.</span>
              </div>
            </div>
          </section>
          <section className="user-panel event-share-panel">
            <div>
              <p className="user-kicker">Share invitation</p>
              <h2>Send the main invitation</h2>
              <p>
                Use the event link for general sharing, or personalized guest
                links for RSVP tracking.
              </p>
            </div>
            <div className="event-header-actions">
              <button
                className="user-primary-button"
                disabled={!event.isPublished}
                onClick={() => void copyShareLink()}
                type="button"
              >
                Copy event link
              </button>
              <Link
                aria-disabled={!event.isPublished}
                className={
                  event.isPublished
                    ? "user-secondary-button"
                    : "user-secondary-button disabled"
                }
                href={event.isPublished ? `/invite/${event.slug}` : "#"}
                target={event.isPublished ? "_blank" : undefined}
              >
                Open as guest
              </Link>
              <button
                className="user-secondary-button"
                disabled={!event.isPublished}
                onClick={() => void nativeShareEvent()}
                type="button"
              >
                Share from device
              </button>
              <button
                className="user-secondary-button"
                disabled={!event.isPublished}
                onClick={() => shareEvent("whatsapp")}
                type="button"
              >
                WhatsApp
              </button>
              <button
                className="user-secondary-button"
                disabled={!event.isPublished}
                onClick={() => shareEvent("email")}
                type="button"
              >
                Email
              </button>
              {event.isPublished ? (
                <InvitationQrCode
                  label={event.title}
                  url={`${typeof window === "undefined" ? "" : window.location.origin}/invite/${event.slug}`}
                />
              ) : null}
            </div>
          </section>
          {!event.isPublished ? (
            <div className="user-empty">
              <h2>Publish before sharing</h2>
              <p>
                Review the invitation, then publish it to activate links and QR
                codes.
              </p>
              <button
                className="user-primary-button mt-4"
                onClick={() => setActiveTab("invitation")}
                type="button"
              >
                Review invitation
              </button>
            </div>
          ) : null}
          <section className="user-panel event-message-templates">
            <p className="user-kicker">Message templates</p>
            <h2>Ready-to-copy messages</h2>
            {[
              suggestedShareMessage,
              `Friendly reminder to RSVP for ${event.title}${event.rsvpDeadline ? ` by ${formatEventDate(event.rsvpDeadline)}` : ""}.`,
              `Thank you for responding to ${event.title}. We look forward to celebrating together.`,
            ].map((message) => (
              <button
                key={message}
                onClick={() => {
                  void navigator.clipboard.writeText(message);
                  showToast("Message template copied.");
                }}
                type="button"
              >
                {message}
              </button>
            ))}
          </section>
        </div>
      ) : null}

      {activeTab === "activity" ? (
        <section className="user-panel event-activity-panel">
          <p className="user-kicker">Activity</p>
          <h2>Invitation timeline</h2>
          {activity.map((item) => (
            <div key={item.id}>
              <strong>{item.summary}</strong>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {!activity.length ? (
            <div className="user-empty">
              <h3>No activity yet</h3>
              <p>Guest opens, shares, and RSVP responses will appear here.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "settings" ? (
        <form
          id="event-settings-form"
          className="user-panel event-edit-form"
          onSubmit={saveEventDetails}
        >
          <label className="user-field">
            <span>Event title</span>
            <input
              defaultValue={event.title}
              minLength={2}
              name="title"
              required
            />
          </label>
          <label className="user-field">
            <span>Event type</span>
            <select defaultValue={event.type} name="type">
              <option value="WEDDING">Wedding</option>
              <option value="BIRTHDAY">Birthday</option>
              <option value="CORPORATE">Corporate</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="user-field">
            <span>Date and time</span>
            <input
              defaultValue={event.eventDate?.slice(0, 16) ?? ""}
              name="eventDate"
              type="datetime-local"
            />
          </label>
          <label className="user-field">
            <span>Venue</span>
            <input defaultValue={event.venue ?? ""} name="venue" />
          </label>
          <label className="user-field event-edit-description">
            <span>Description</span>
            <textarea
              defaultValue={event.description ?? ""}
              name="description"
              rows={3}
            />
          </label>
          <label className="user-field">
            <span>RSVP deadline</span>
            <input
              defaultValue={event.rsvpDeadline?.slice(0, 16) ?? ""}
              name="rsvpDeadline"
              type="datetime-local"
            />
          </label>
          <label className="user-field event-edit-description">
            <span>Private organizer notes</span>
            <textarea
              defaultValue={event.organizerNotes ?? ""}
              name="organizerNotes"
              rows={3}
            />
          </label>
          <div className="event-checklist-edit">
            <strong>Event checklist</strong>
            <label>
              <input
                defaultChecked={event.checklist?.details}
                name="checklistDetails"
                type="checkbox"
              />{" "}
              Event details reviewed
            </label>
            <label>
              <input
                defaultChecked={event.checklist?.guests}
                name="checklistGuests"
                type="checkbox"
              />{" "}
              Guest list prepared
            </label>
            <label>
              <input
                defaultChecked={event.checklist?.reviewed}
                name="checklistReviewed"
                type="checkbox"
              />{" "}
              Invitation preview reviewed
            </label>
            <label>
              <input
                defaultChecked={event.checklist?.shared}
                name="checklistShared"
                type="checkbox"
              />{" "}
              Invitations shared
            </label>
          </div>
          <label className="event-publish-toggle">
            <input
              defaultChecked={event.isPublished}
              name="isPublished"
              type="checkbox"
            />
            Published and shareable
          </label>
          <button
            className="user-primary-button"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </form>
      ) : null}

      {deletedInvitee ? (
        <div className="event-undo-banner">
          <span>{deletedInvitee.name} will be deleted in a few seconds.</span>
          <button onClick={undoDeleteInvitee} type="button">
            Undo
          </button>
        </div>
      ) : null}

      {showCreatedSuccess ? (
        <div className="invitation-success-backdrop">
          <section className="invitation-success-card">
            <div className="invitation-success-mark">✓</div>
            <p className="user-kicker">Invitation created</p>
            <h2>Your draft is ready to make personal</h2>
            <p>
              {event.title} is safely saved. Add guests, review the invitation,
              then publish when it feels right.
            </p>
            <div className="invitation-success-actions">
              <button
                className="user-primary-button"
                onClick={() => {
                  setShowCreatedSuccess(false);
                  setActiveTab("guests");
                  router.replace(`/events/${event.id}`);
                }}
                type="button"
              >
                Add guests
              </button>
              <button
                className="user-secondary-button"
                onClick={() => {
                  setShowCreatedSuccess(false);
                  setActiveTab("invitation");
                  setShowPreview(true);
                  router.replace(`/events/${event.id}`);
                }}
                type="button"
              >
                Preview invitation
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {csvImport ? (
        <CsvMappingDialog
          existingInvitees={invitees}
          state={csvImport}
          onCancel={() => setCsvImport(null)}
          onChange={setCsvImport}
          onImport={() => void importMappedCsv()}
        />
      ) : null}

      <div className="event-mobile-action-bar">
        <button
          className="user-primary-button"
          disabled={mobilePrimaryAction.disabled}
          form={mobilePrimaryAction.submitFormId}
          onClick={
            mobilePrimaryAction.submitFormId
              ? undefined
              : mobilePrimaryAction.action
          }
          type={mobilePrimaryAction.submitFormId ? "submit" : "button"}
        >
          {mobilePrimaryAction.label}
        </button>
        {mobileSecondaryAction ? (
          <button
            className="user-secondary-button"
            disabled={mobileSecondaryAction.disabled}
            onClick={mobileSecondaryAction.action}
            type="button"
          >
            {mobileSecondaryAction.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function markEventsChanged() {
  localStorage.setItem("nimto_events_changed", String(Date.now()));
}

function hasInvitationDraft(event: UserEvent) {
  if (!event.draftDesignVersionId && !event.draftDesignFieldValues)
    return false;
  if (
    event.draftDesignVersionId &&
    event.draftDesignVersionId !== event.designVersion?.id
  ) {
    return true;
  }
  return (
    JSON.stringify(event.draftDesignFieldValues ?? {}) !==
    JSON.stringify(event.designFieldValues ?? {})
  );
}

function statusClass(status: string) {
  if (status === "Published") return "published";
  if (status === "Archived") return "archived";
  if (status === "Unpublished changes") return "changes";
  if (status === "RSVP closed") return "closed";
  return "";
}

function CelebrationConfetti() {
  const pieces = Array.from({ length: 34 }, (_, index) => ({
    left: `${(index * 37) % 100}%`,
    delay: `${(index % 7) * 0.08}s`,
    color: ["#a85675", "#b99758", "#4f7665", "#665f8f", "#9d6850"][index % 5],
    rotate: `${(index * 47) % 180}deg`,
  }));
  return (
    <div className="celebration-confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
        <i
          key={index}
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            backgroundColor: piece.color,
            rotate: piece.rotate,
          }}
        />
      ))}
    </div>
  );
}

function CsvMappingDialog({
  existingInvitees,
  onCancel,
  onChange,
  onImport,
  state,
}: {
  existingInvitees: InvitationInvitee[];
  onCancel: () => void;
  onChange: (state: CsvImportState) => void;
  onImport: () => void;
  state: NonNullable<CsvImportState>;
}) {
  const fields = [
    ["name", "Guest name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["groupName", "Group / family"],
    ["mealPreference", "Meal preference"],
  ] as const;
  const review = useMemo(
    () => reviewCsvImport(state, existingInvitees),
    [existingInvitees, state],
  );
  return (
    <div className="invitee-drawer-backdrop">
      <section className="csv-mapping-dialog">
        <div className="event-section-heading">
          <div>
            <p className="user-kicker">CSV import</p>
            <h2>Map columns and review</h2>
          </div>
          <button
            className="user-secondary-button"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
        <div className="csv-mapping-grid">
          {fields.map(([key, label]) => (
            <label className="user-field" key={key}>
              <span>{label}</span>
              <select
                onChange={(changeEvent) =>
                  onChange({
                    ...state,
                    mapping: {
                      ...state.mapping,
                      [key]: Number(changeEvent.target.value),
                    },
                  })
                }
                value={state.mapping[key]}
              >
                <option value={-1}>Do not import</option>
                {state.headers.map((header, index) => (
                  <option key={`${header}-${index}`} value={index}>
                    {header || `Column ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="csv-review-summary">
          <article className="ready">
            <span>Will import</span>
            <strong>{review.valid.length}</strong>
          </article>
          <article className={review.duplicates.length ? "warning" : "ready"}>
            <span>Duplicates</span>
            <strong>{review.duplicates.length}</strong>
          </article>
          <article className={review.missingNames.length ? "warning" : "ready"}>
            <span>Missing names</span>
            <strong>{review.missingNames.length}</strong>
          </article>
        </div>
        <div className="overflow-x-auto">
          <table className="user-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Guest name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              {review.preview.map((item, rowIndex) => (
                <tr key={`${item.guest.name}-${rowIndex}`}>
                  <td>
                    <span
                      className={
                        item.status === "Ready"
                          ? "invitee-ready"
                          : "invitee-warning"
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>{item.guest.name || "—"}</td>
                  <td>{item.guest.email || "—"}</td>
                  <td>{item.guest.phone || "—"}</td>
                  <td>{item.guest.groupName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {state.rows.length} rows detected. Duplicates and rows without names
          are skipped before import, so existing guests stay safe.
        </p>
        <button
          className="user-primary-button"
          disabled={state.mapping.name < 0 || !review.valid.length}
          onClick={onImport}
          type="button"
        >
          Import {review.valid.length} guests
        </button>
      </section>
    </div>
  );
}

function mappedCsvGuest(
  row: string[],
  mapping: NonNullable<CsvImportState>["mapping"],
) {
  return {
    name: row[mapping.name]?.trim() ?? "",
    email:
      mapping.email >= 0 ? row[mapping.email]?.trim() || undefined : undefined,
    phone:
      mapping.phone >= 0 ? row[mapping.phone]?.trim() || undefined : undefined,
    groupName:
      mapping.groupName >= 0
        ? row[mapping.groupName]?.trim() || undefined
        : undefined,
    mealPreference:
      mapping.mealPreference >= 0
        ? row[mapping.mealPreference]?.trim() || undefined
        : undefined,
  };
}

function defaultRsvpConfig(): RsvpConfig {
  return {
    note: "",
    closedMessage: "Sorry, RSVP is closed for this event.",
    fields: [
      {
        id: "attendance_status",
        key: "attendance_status",
        label: "Will you attend?",
        type: "single_choice",
        required: true,
        enabled: true,
        builtIn: true,
        options: ["Attending", "Cannot attend"],
      },
      {
        id: "full_name",
        key: "full_name",
        label: "Full name",
        type: "text",
        required: true,
        enabled: true,
        builtIn: true,
      },
      {
        id: "phone_number",
        key: "phone_number",
        label: "Phone number",
        type: "phone",
        required: false,
        enabled: true,
        builtIn: true,
      },
      {
        id: "email_address",
        key: "email_address",
        label: "Email address",
        type: "email",
        required: false,
        enabled: true,
        builtIn: true,
      },
      {
        id: "number_of_guests",
        key: "number_of_guests",
        label: "How many people are coming?",
        type: "number",
        required: false,
        enabled: true,
        builtIn: true,
      },
      {
        id: "meal_preference",
        key: "meal_preference",
        label: "Meal preference",
        type: "text",
        required: false,
        enabled: false,
        builtIn: true,
      },
      {
        id: "message",
        key: "message",
        label: "Message",
        type: "textarea",
        required: false,
        enabled: false,
        builtIn: true,
      },
    ],
  };
}

function normalizeRsvpConfig(
  config?: Record<string, unknown> | null,
): RsvpConfig {
  const defaults = defaultRsvpConfig();
  const providedFields = Array.isArray(config?.fields)
    ? (config.fields as Partial<RsvpFieldConfig>[])
    : [];
  const mergedDefaults = defaults.fields.map((field) => {
    const provided = providedFields.find((item) => item?.key === field.key);
    return {
      ...field,
      label: provided?.label || field.label,
      type: provided?.type || field.type,
      required:
        typeof provided?.required === "boolean"
          ? provided.required
          : field.required,
      enabled:
        typeof provided?.enabled === "boolean"
          ? provided.enabled
          : field.enabled,
      options:
        field.type === "single_choice"
          ? Array.isArray(provided?.options) && provided.options.length
            ? provided.options
            : field.options
          : undefined,
    };
  });
  const customFields = providedFields.flatMap((field, index) => {
    if (!field?.key || defaults.fields.some((item) => item.key === field.key)) {
      return [];
    }
    return [
      {
        id: field.id || `custom_${index + 1}_${field.key}`,
        key: field.key,
        label: field.label || field.key,
        type: field.type || "text",
        required: Boolean(field.required),
        enabled: field.enabled !== false,
        builtIn: false,
        options: Array.isArray(field.options) ? field.options : [],
        placeholder:
          typeof field.placeholder === "string" ? field.placeholder : "",
      } satisfies RsvpFieldConfig,
    ];
  });
  return {
    note: String(config?.note ?? defaults.note),
    closedMessage: String(config?.closedMessage ?? defaults.closedMessage),
    fields: [...mergedDefaults, ...customFields],
  };
}

function buildRsvpResponseRows(
  invitees: InvitationInvitee[],
  responses: EventRsvpResponse[],
  fields: RsvpFieldConfig[],
) {
  const enabledKeys = new Set(
    fields.filter((field) => field.enabled).map((field) => field.key),
  );
  const inviteeRows = invitees
    .filter((invitee) => invitee.rsvpStatus !== "PENDING")
    .map((invitee) => {
      const answers = {
        attendance_status:
          invitee.rsvpStatus === "ATTENDING" ? "Attending" : "Cannot attend",
        full_name: invitee.name,
        phone_number: invitee.phone ?? "",
        email_address: invitee.email ?? "",
        number_of_guests: invitee.partySize ?? "",
        meal_preference: invitee.mealPreference ?? "",
        message: invitee.rsvpMessage ?? "",
        ...(invitee.rsvpAnswers ?? {}),
      };
      return {
        id: invitee.id,
        source: "Guest link",
        submittedAt: invitee.respondedAt ?? invitee.updatedAt,
        statusLabel:
          invitee.rsvpStatus === "ATTENDING" ? "Attending" : "Declined",
        answers: Object.fromEntries(
          Object.entries(answers).filter(([key]) => enabledKeys.has(key)),
        ),
      };
    });
  const publicRows = responses.map((response) => ({
    id: response.id,
    source: "Public link",
    submittedAt: response.submittedAt,
    statusLabel: response.status === "ATTENDING" ? "Attending" : "Declined",
    answers: Object.fromEntries(
      Object.entries(response.answers ?? {}).filter(([key]) =>
        enabledKeys.has(key),
      ),
    ),
  }));
  return [...inviteeRows, ...publicRows].sort((left, right) =>
    right.submittedAt.localeCompare(left.submittedAt),
  );
}

function csvResponseValue(answers: Record<string, unknown>, key: string) {
  const value = answers[key];
  return value === undefined || value === null ? "" : String(value);
}

function reviewCsvImport(
  state: NonNullable<CsvImportState>,
  existingInvitees: InvitationInvitee[],
) {
  const existingNames = new Set(
    existingInvitees.map((invitee) => invitee.name.trim().toLowerCase()),
  );
  const seenNames = new Set<string>();
  const valid: ReturnType<typeof mappedCsvGuest>[] = [];
  const duplicates: ReturnType<typeof mappedCsvGuest>[] = [];
  const missingNames: ReturnType<typeof mappedCsvGuest>[] = [];
  const preview = state.rows.slice(0, 8).map((row) => {
    const guest = mappedCsvGuest(row, state.mapping);
    const normalizedName = guest.name.trim().toLowerCase();
    let status = "Ready";
    if (!normalizedName) {
      status = "Missing name";
      missingNames.push(guest);
    } else if (
      existingNames.has(normalizedName) ||
      seenNames.has(normalizedName)
    ) {
      status = "Duplicate";
      duplicates.push(guest);
    } else {
      seenNames.add(normalizedName);
      valid.push(guest);
    }
    return { guest, status };
  });

  state.rows.slice(8).forEach((row) => {
    const guest = mappedCsvGuest(row, state.mapping);
    const normalizedName = guest.name.trim().toLowerCase();
    if (!normalizedName) {
      missingNames.push(guest);
    } else if (
      existingNames.has(normalizedName) ||
      seenNames.has(normalizedName)
    ) {
      duplicates.push(guest);
    } else {
      seenNames.add(normalizedName);
      valid.push(guest);
    }
  });

  return { duplicates, missingNames, preview, valid };
}
