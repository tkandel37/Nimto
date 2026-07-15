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
  | "links"
  | "music"
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
  { id: "links", label: "Field links" },
  { id: "music", label: "Music" },
  { id: "guests", label: "Guests" },
  { id: "rsvp", label: "RSVP" },
  { id: "sharing", label: "Sharing" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];

const rsvpFieldTypes: {
  value: RsvpFieldConfig["type"];
  label: string;
  description: string;
}[] = [
  {
    value: "text",
    label: "Short text",
    description: "A single line for short answers such as a name or preference.",
  },
  {
    value: "textarea",
    label: "Long text",
    description: "A larger text box for messages or detailed answers.",
  },
  {
    value: "number",
    label: "Number",
    description: "Accepts numbers only, useful for guest counts or quantities.",
  },
  {
    value: "date",
    label: "Date",
    description: "Lets guests choose a date from a calendar.",
  },
  {
    value: "single_choice",
    label: "Single choice",
    description: "Guests select one answer using radio buttons.",
  },
  {
    value: "multiple_choice",
    label: "Multiple choice",
    description: "Guests can select more than one answer using checkboxes.",
  },
  {
    value: "email",
    label: "Email",
    description: "Checks that the answer is a valid email address.",
  },
  {
    value: "phone",
    label: "Phone",
    description: "A phone-friendly field for contact numbers.",
  },
];

function rsvpFieldTypeInfo(type: RsvpFieldConfig["type"]) {
  return rsvpFieldTypes.find((item) => item.value === type) ?? rsvpFieldTypes[0];
}

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
  const [activeTab, setActiveTab] = useState<EventTab>("overview");
  const [showEventMenu, setShowEventMenu] = useState(false);
  const [showFeatureMenu, setShowFeatureMenu] = useState(false);
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
    setShowFeatureMenu(false);
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
    () => {
      const items = [
        { label: "Event title", ready: (event?.title.trim().length ?? 0) >= 2 },
        { label: "Date", ready: Boolean(event?.eventDate) },
        { label: "Venue", ready: Boolean(event?.venue) },
        {
          label: "Invitation design",
          ready: Boolean(event?.designVersion?.id),
        },
        { label: "Guests", ready: invitees.length > 0 },
      ];
      return eventFeatureAvailability(event).rsvp
        ? [
            ...items,
            { label: "RSVP deadline", ready: Boolean(event?.rsvpDeadline) },
          ]
        : items;
    },
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
      fields: current.fields.flatMap((field) => {
        if (field.id !== fieldId) return [field];
        return field.builtIn ? [{ ...field, enabled: false }] : [];
      }),
    }));
  }

  function addCustomRsvpField() {
    const suffix =
      rsvpDraft.fields.filter((field) => !field.builtIn).length + 1;
    const fieldId = `custom_${Date.now()}_${suffix}`;
    setRsvpDraft((current) => ({
      ...current,
      fields: [
        ...current.fields,
        {
          id: fieldId,
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
    window.requestAnimationFrame(() => {
      const question = document.getElementById(
        `rsvp-question-${fieldId}`,
      ) as HTMLDetailsElement | null;
      question?.setAttribute("open", "");
      question?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function reorderRsvpField(sourceId: string, targetId: string) {
    if (!sourceId || sourceId === targetId) return;
    setRsvpDraft((current) => {
      const fields = [...current.fields];
      const sourceIndex = fields.findIndex((field) => field.id === sourceId);
      if (sourceIndex < 0) return current;
      const [moved] = fields.splice(sourceIndex, 1);
      const targetIndex = fields.findIndex((field) => field.id === targetId);
      if (targetIndex < 0) return current;
      fields.splice(targetIndex, 0, moved);
      return { ...current, fields };
    });
  }

  function nudgeRsvpField(fieldId: string, direction: -1 | 1) {
    setRsvpDraft((current) => {
      const visible = current.fields.filter((field) => field.enabled);
      const visibleIndex = visible.findIndex((field) => field.id === fieldId);
      const target = visible[visibleIndex + direction];
      if (!target) return current;
      const fields = [...current.fields];
      const sourceIndex = fields.findIndex((field) => field.id === fieldId);
      const targetIndex = fields.findIndex((field) => field.id === target.id);
      [fields[sourceIndex], fields[targetIndex]] = [
        fields[targetIndex],
        fields[sourceIndex],
      ];
      return { ...current, fields };
    });
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
  const featureAvailability = eventFeatureAvailability(event);
  const availableEventTabs = eventTabs.filter((tab) => {
    if (tab.id === "links" || tab.id === "music" || tab.id === "rsvp") {
      return featureAvailability[tab.id];
    }
    return true;
  });
  const primaryEventTabs = availableEventTabs.filter(
    (tab) => tab.id !== "settings",
  );
  const unavailableFeatureTabs = eventTabs.filter(
    (tab) =>
      (tab.id === "links" || tab.id === "music" || tab.id === "rsvp") &&
      !featureAvailability[tab.id],
  );
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
    ...(featureAvailability.rsvp
      ? [
          {
            label: "Track RSVPs",
            ready: Boolean(statistics?.invitationOpens),
            tab: "rsvp" as EventTab,
          },
        ]
      : []),
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
        : activeTab === "links"
          ? {
              label: featureAvailability.links
                ? "Save field links"
                : "Open invitation",
              action: featureAvailability.links
                ? undefined
                : () => setActiveTab("invitation"),
              disabled: false,
              submitFormId: featureAvailability.links
                ? "event-field-links-form"
                : undefined,
            }
          : activeTab === "music"
            ? {
                label: featureAvailability.music
                  ? "Save music"
                  : "Open invitation",
                action: featureAvailability.music
                  ? undefined
                  : () => setActiveTab("invitation"),
                disabled: false,
                submitFormId: featureAvailability.music
                  ? "event-music-form"
                  : undefined,
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
                  label: isSaving ? "Saving..." : "Save settings",
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
        : activeTab === "links"
          ? {
              label: "Edit invitation",
              action: () => setActiveTab("invitation"),
              disabled: false,
            }
          : activeTab === "music"
            ? {
                label: "Edit invitation",
                action: () => setActiveTab("invitation"),
                disabled: false,
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
        {primaryEventTabs.map((tab) => (
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
        <div className="event-tab-actions">
          {unavailableFeatureTabs.length ? (
            <div className="event-tab-overflow">
              <button
                aria-expanded={showFeatureMenu}
                aria-label="More features"
                className={showFeatureMenu ? "active" : ""}
                onClick={() => setShowFeatureMenu((current) => !current)}
                title="More features"
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="7" cy="7" r="2" />
                  <circle cx="17" cy="7" r="2" />
                  <circle cx="7" cy="17" r="2" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
              </button>
              {showFeatureMenu ? (
                <div className="event-tab-overflow-menu">
                  {unavailableFeatureTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      type="button"
                    >
                      {tab.label}
                      <small>Unavailable</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            aria-current={activeTab === "settings" ? "page" : undefined}
            aria-label="Settings"
            className={`event-tab-settings ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
            title="Event settings"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M9.7 3.3h4.6l.6 2.1c.5.2 1 .5 1.4.8l2.1-.6 2.3 4-1.5 1.5a7 7 0 0 1 0 1.8l1.5 1.5-2.3 4-2.1-.6c-.4.3-.9.6-1.4.8l-.6 2.1H9.7l-.6-2.1c-.5-.2-1-.5-1.4-.8l-2.1.6-2.3-4 1.5-1.5a7 7 0 0 1 0-1.8L3.3 9.6l2.3-4 2.1.6c.4-.3.9-.6 1.4-.8l.6-2.1Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </nav>
      <label className="event-tab-select">
        <span className="sr-only">Event section</span>
        <select
          value={activeTab}
          onChange={(change) => setActiveTab(change.target.value as EventTab)}
        >
          <optgroup label="Event sections">
            {availableEventTabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </optgroup>
          {unavailableFeatureTabs.length ? (
            <optgroup label="Unavailable features">
              {unavailableFeatureTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label} — unavailable
                </option>
              ))}
            </optgroup>
          ) : null}
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

      {activeTab === "links" ? (
        <EventDesignEditor
          authHeaders={authHeaders}
          designs={designs}
          event={event}
          onEvent={setEvent}
          onRevisions={setRevisions}
          revisions={revisions}
          showToast={showToast}
          view="links"
        />
      ) : null}

      {activeTab === "music" && !featureAvailability.music ? (
        <section className="user-panel event-feature-unavailable">
          <h2>Music is not available for this template.</h2>
        </section>
      ) : null}

      {activeTab === "music" && featureAvailability.music ? (
        <EventDesignEditor
          authHeaders={authHeaders}
          designs={designs}
          event={event}
          onEvent={setEvent}
          onRevisions={setRevisions}
          revisions={revisions}
          showToast={showToast}
          view="music"
        />
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

      {activeTab === "rsvp" && !featureAvailability.rsvp ? (
        <section className="user-panel event-feature-unavailable">
          <h2>RSVP is not available for this template.</h2>
        </section>
      ) : null}

      {activeTab === "rsvp" && featureAvailability.rsvp ? (
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
                    <p>Choose what guests see and how each answer should be collected.</p>
                  </div>
                </header>
                <div className="rsvp-builder-toolbar">
                  <span>
                    <b>{rsvpConfig.fields.filter((field) => field.enabled).length}</b> questions in this form
                  </span>
                </div>
                <div className="rsvp-question-list">
                  {rsvpConfig.fields.filter((field) => field.enabled).map((field, fieldIndex) => {
                    const typeInfo = rsvpFieldTypeInfo(field.type);
                    const choiceOptions = field.options?.length ? field.options : ["Option 1"];
                    return (
                      <details
                        className="rsvp-question-row"
                        id={`rsvp-question-${field.id}`}
                        key={field.id}
                        name="rsvp-question-editor"
                        onDragOver={(dragEvent) => dragEvent.preventDefault()}
                        onDrop={(dropEvent) => {
                          dropEvent.preventDefault();
                          reorderRsvpField(
                            dropEvent.dataTransfer.getData("text/plain"),
                            field.id,
                          );
                        }}
                      >
                        <summary className="rsvp-question-summary">
                          <span
                            aria-label={`Drag ${field.label} to reorder. Use arrow keys for precise movement.`}
                            className="rsvp-drag-handle"
                            draggable
                            onDragStart={(dragEvent) => {
                              dragEvent.dataTransfer.effectAllowed = "move";
                              dragEvent.dataTransfer.setData("text/plain", field.id);
                            }}
                            onKeyDown={(keyEvent) => {
                              if (keyEvent.key === "ArrowUp") {
                                keyEvent.preventDefault();
                                nudgeRsvpField(field.id, -1);
                              }
                              if (keyEvent.key === "ArrowDown") {
                                keyEvent.preventDefault();
                                nudgeRsvpField(field.id, 1);
                              }
                            }}
                            onClick={(clickEvent) => clickEvent.preventDefault()}
                            role="button"
                            tabIndex={0}
                            title="Drag to reorder"
                          >
                            <svg aria-hidden="true" viewBox="0 0 16 20"><path d="M5 4h.01M11 4h.01M5 10h.01M11 10h.01M5 16h.01M11 16h.01" /></svg>
                          </span>
                          <span className="rsvp-question-number" aria-hidden="true">{fieldIndex + 1}</span>
                          <div className="rsvp-question-summary-copy">
                            <strong>{field.label}</strong>
                            <span>{typeInfo.label}</span>
                          </div>
                          <div className="rsvp-question-actions">
                            <label className="event-inline-toggle" onClick={(clickEvent) => clickEvent.stopPropagation()} title="Guests must answer this before submitting their RSVP.">
                              <input checked={field.required} onChange={(changeEvent) => updateRsvpField(field.id, { required: changeEvent.target.checked })} type="checkbox" />
                              Required
                            </label>
                            <button
                              aria-label={`Delete ${field.label}`}
                              className="rsvp-remove-question"
                              onClick={(clickEvent) => {
                                clickEvent.preventDefault();
                                clickEvent.stopPropagation();
                                removeRsvpField(field.id);
                              }}
                              title="Delete question"
                              type="button"
                            >
                              <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M3.5 5.5h13M8 3.5h4M6 5.5l.7 11h6.6l.7-11M8.5 8.5v5M11.5 8.5v5" /></svg>
                            </button>
                          </div>
                          <svg className="rsvp-question-chevron" aria-hidden="true" viewBox="0 0 20 20"><path d="m6 8 4 4 4-4" /></svg>
                        </summary>

                        <div className="rsvp-question-body">
                          <div className="rsvp-order-actions">
                            <span>Question position</span>
                            <button disabled={fieldIndex === 0} onClick={() => nudgeRsvpField(field.id, -1)} type="button">Move up</button>
                            <button
                              disabled={fieldIndex === rsvpConfig.fields.filter((item) => item.enabled).length - 1}
                              onClick={() => nudgeRsvpField(field.id, 1)}
                              type="button"
                            >
                              Move down
                            </button>
                          </div>
                          <label className="rsvp-question-title-field">
                            <span>Question</span>
                            <input
                              aria-label={`Question ${fieldIndex + 1}`}
                              onChange={(changeEvent) =>
                                updateRsvpField(field.id, { label: changeEvent.target.value })
                              }
                              value={field.label}
                            />
                          </label>
                          <div className="rsvp-answer-type-field">
                            <span>Answer type</span>
                            <details className="rsvp-type-picker">
                              <summary aria-label={`Answer type for ${field.label}`}>
                                <span>
                                  <strong>{typeInfo.label}</strong>
                                  <small>{typeInfo.description}</small>
                                </span>
                                <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m6 8 4 4 4-4" /></svg>
                              </summary>
                              <div className="rsvp-type-menu">
                                {rsvpFieldTypes.map((type) => (
                                  <button
                                    aria-selected={field.type === type.value}
                                    className={field.type === type.value ? "active" : ""}
                                    key={type.value}
                                    onClick={(clickEvent) => {
                                      updateRsvpField(field.id, {
                                        type: type.value,
                                        options: type.value === "single_choice" || type.value === "multiple_choice"
                                          ? choiceOptions
                                          : [],
                                      });
                                      clickEvent.currentTarget.closest("details")?.removeAttribute("open");
                                    }}
                                    title={type.description}
                                    type="button"
                                  >
                                    <strong>{type.label}</strong>
                                    <span>{type.description}</span>
                                  </button>
                                ))}
                              </div>
                            </details>
                          </div>

                          {field.type === "single_choice" || field.type === "multiple_choice" ? (
                            <div className="rsvp-choice-editor">
                              <header>
                                <div>
                                  <strong>Answer choices</strong>
                                  <span>
                                    {field.type === "multiple_choice"
                                      ? "Add each choice separately. Guests can select more than one."
                                      : "Add each choice separately. Guests can select one."}
                                  </span>
                                </div>
                                <button
                                  onClick={() => updateRsvpField(field.id, {
                                    options: [...choiceOptions, `Option ${choiceOptions.length + 1}`],
                                  })}
                                  type="button"
                                >
                                  + Add option
                                </button>
                              </header>
                              <div className="rsvp-choice-list">
                                {choiceOptions.map((option, optionIndex) => (
                                  <div className="rsvp-choice-row" key={`${field.id}-${optionIndex}`}>
                                    <span aria-hidden="true">{optionIndex + 1}</span>
                                    <input
                                      aria-label={`Option ${optionIndex + 1} for ${field.label}`}
                                      onChange={(changeEvent) => updateRsvpField(field.id, {
                                        options: choiceOptions.map((current, currentIndex) =>
                                          currentIndex === optionIndex ? changeEvent.target.value : current,
                                        ),
                                      })}
                                      placeholder={`Option ${optionIndex + 1}`}
                                      value={option}
                                    />
                                    <button
                                      aria-label={`Remove option ${optionIndex + 1}`}
                                      disabled={choiceOptions.length === 1}
                                      onClick={() => updateRsvpField(field.id, {
                                        options: choiceOptions.filter((_, currentIndex) => currentIndex !== optionIndex),
                                      })}
                                      title={choiceOptions.length === 1 ? "At least one option is required." : "Remove this option"}
                                      type="button"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    );
                  })}
                </div>

                <button className="user-secondary-button rsvp-add-question-button" onClick={addCustomRsvpField} type="button">
                  + Add question
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
                      <label>
                        <span>RSVP closes on</span>
                        <small>Guests can respond until this date and time.</small>
                        <input defaultValue={event.rsvpDeadline?.slice(0, 16) ?? ""} name="rsvpDeadline" type="datetime-local" />
                      </label>
                      <label>
                        <span>Message shown after the deadline</span>
                        <small>This replaces the form once RSVPs are closed.</small>
                        <textarea
                          name="rsvpClosedMessage"
                          onChange={(changeEvent) => setRsvpDraft((current) => ({ ...current, closedMessage: changeEvent.target.value }))}
                          placeholder="For example: RSVP is now closed. Please contact the host if your plans changed."
                          rows={3}
                          value={rsvpConfig.closedMessage}
                        />
                      </label>
                    </div>
                  ) : null}
                </section>
                <footer className="rsvp-builder-actions">
                  <button className="user-primary-button" disabled={isSaving} type="submit">
                    {isSaving ? "Saving..." : "Save RSVP form"}
                  </button>
                </footer>
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
            <div className="share-review-heading">
              <div>
                <p className="user-kicker">Share readiness</p>
                <h2>{event.title}</h2>
                <p className="share-review-intro">
                  Confirm the essentials, then send the invitation using the
                  option that suits your guests.
                </p>
              </div>
              <span
                className={`share-publish-state ${event.isPublished ? "ready" : "pending"}`}
              >
                {event.isPublished ? "Ready to share" : "Publish required"}
              </span>
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
              <span className={event.isPublished ? "ready" : "pending"}>
                {event.isPublished ? "✓" : "○"} Published
              </span>
              <span className={invitees.length ? "ready" : "pending"}>
                {invitees.length ? "✓" : "○"} {invitees.length} guests
              </span>
              <span className={event.rsvpDeadline ? "ready" : "pending"}>
                {event.rsvpDeadline ? "✓" : "○"} RSVP deadline
              </span>
            </div>
          </section>
          <section className="user-panel event-share-panel">
            <div className="share-panel-heading">
              <p className="user-kicker">Share invitation</p>
              <h2>Send the main invitation</h2>
              <p>
                Use the event link for general sharing, or personalized guest
                links for RSVP tracking.
              </p>
            </div>
            <div className="share-action-groups">
              <div className="share-primary-actions">
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
                  Open invitation
                </Link>
              </div>
              <div className="share-channel-actions">
                <button
                  className="user-secondary-button"
                  disabled={!event.isPublished}
                  onClick={() => void nativeShareEvent()}
                  type="button"
                >
                  Device share
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
                <span>{message}</span>
                <strong>Copy</strong>
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
          className="user-panel event-settings-form"
          onSubmit={saveEventDetails}
        >
          <header className="event-settings-header">
            <div>
              <p className="user-kicker">Event settings</p>
              <h2>Details and publishing</h2>
              <p>Keep the information guests see accurate and up to date.</p>
            </div>
            <p className="event-required-legend">
              <span aria-hidden="true">*</span> Required field
            </p>
          </header>

          <section className="event-settings-section">
            <div className="event-settings-section-heading">
              <span className="event-settings-section-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
                </svg>
              </span>
              <div>
                <h3>Event details</h3>
                <p>These details appear on your invitation and event pages.</p>
              </div>
            </div>
            <div className="event-settings-grid">
              <label className="user-field event-settings-title-field">
                <span>
                  Event title{" "}
                  <b className="event-required-mark" aria-hidden="true">
                    *
                  </b>
                </span>
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
              <label className="user-field event-settings-wide-field">
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
            </div>
          </section>

          <section className="event-settings-section">
            <div className="event-settings-section-heading">
              <span className="event-settings-section-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 5h14v12H9l-4 3V5zM8 9h8M8 13h5" />
                </svg>
              </span>
              <div>
                <h3>Organizer notes</h3>
                <p>Private planning notes. Guests will never see these.</p>
              </div>
            </div>
            <label className="user-field">
              <span>Private notes</span>
              <textarea
                defaultValue={event.organizerNotes ?? ""}
                name="organizerNotes"
                placeholder="Add reminders, vendor details, or anything your team needs to know."
                rows={4}
              />
            </label>
          </section>

          <div className="event-settings-secondary-grid">
            <section className="event-settings-section event-settings-compact-section">
              <div className="event-settings-section-heading">
                <span
                  className="event-settings-section-icon"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="m5 7 2 2 4-4M13 7h6M5 13l2 2 4-4M13 13h6M5 19l2 2 4-4M13 19h6" />
                  </svg>
                </span>
                <div>
                  <h3>Planning checklist</h3>
                  <p>Track what is ready before you share.</p>
                </div>
              </div>
              <div className="event-checklist-edit">
                <label>
                  <input
                    defaultChecked={event.checklist?.details}
                    name="checklistDetails"
                    type="checkbox"
                  />
                  <span>Event details reviewed</span>
                </label>
                <label>
                  <input
                    defaultChecked={event.checklist?.guests}
                    name="checklistGuests"
                    type="checkbox"
                  />
                  <span>Guest list prepared</span>
                </label>
                <label>
                  <input
                    defaultChecked={event.checklist?.reviewed}
                    name="checklistReviewed"
                    type="checkbox"
                  />
                  <span>Invitation preview reviewed</span>
                </label>
                <label>
                  <input
                    defaultChecked={event.checklist?.shared}
                    name="checklistShared"
                    type="checkbox"
                  />
                  <span>Invitations shared</span>
                </label>
              </div>
            </section>

            <section className="event-settings-section event-settings-compact-section">
              <div className="event-settings-section-heading">
                <span
                  className="event-settings-section-icon"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3 5 6v5c0 4.7 2.8 8.1 7 10 4.2-1.9 7-5.3 7-10V6l-7-3zM9 12l2 2 4-4" />
                  </svg>
                </span>
                <div>
                  <h3>Publishing</h3>
                  <p>Control whether guests can open this event.</p>
                </div>
              </div>
              <label className="event-publish-toggle">
                <span>
                  <strong>Published and shareable</strong>
                  <small>Public links work while this is turned on.</small>
                </span>
                <input
                  defaultChecked={event.isPublished}
                  name="isPublished"
                  type="checkbox"
                />
                <i aria-hidden="true" />
              </label>
              <p className="event-publish-note">
                Publishing requires a date, venue, and invitation design.
              </p>
            </section>
          </div>

          <footer className="event-settings-actions">
            <p>Your changes only apply to this event.</p>
            <button
              className="user-primary-button event-settings-save-button"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Saving..." : "Save settings"}
            </button>
          </footer>
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

function eventFeatureAvailability(event?: UserEvent | null) {
  const design = event?.draftDesignVersion ?? event?.designVersion;
  const config = (design?.featureConfig ?? {}) as Record<
    string,
    { available?: boolean } | undefined
  >;
  return {
    links: config.links?.available === true,
    music: config.music?.available === true,
    rsvp: config.rsvp?.available === true,
  };
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
    const type = provided?.type || field.type;
    return {
      ...field,
      label: provided?.label || field.label,
      type,
      required:
        typeof provided?.required === "boolean"
          ? provided.required
          : field.required,
      enabled:
        typeof provided?.enabled === "boolean"
          ? provided.enabled
          : field.enabled,
      options:
        type === "single_choice" || type === "multiple_choice"
          ? Array.isArray(provided?.options) && provided.options.length
            ? provided.options
            : field.options?.length
              ? field.options
              : ["Option 1"]
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
  const fields = [...mergedDefaults, ...customFields];
  const providedOrder = new Map(
    providedFields.map((field, index) => [field.key, index]),
  );
  const fallbackOrder = new Map(
    fields.map((field, index) => [field.key, providedFields.length + index]),
  );
  fields.sort(
    (left, right) =>
      (providedOrder.get(left.key) ?? fallbackOrder.get(left.key) ?? 0) -
      (providedOrder.get(right.key) ?? fallbackOrder.get(right.key) ?? 0),
  );
  return {
    note: String(config?.note ?? defaults.note),
    closedMessage: String(config?.closedMessage ?? defaults.closedMessage),
    fields,
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
