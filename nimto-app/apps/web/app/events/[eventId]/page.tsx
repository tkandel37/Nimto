"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { UserWorkspace } from "../../user-workspace";
import {
  formatEventDate,
  InvitationInvitee,
  EventStatistics,
  EventActivity,
  EventDesignRevision,
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

const eventTabs: { id: EventTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "invitation", label: "Invitation" },
  { id: "guests", label: "Guests" },
  { id: "rsvp", label: "RSVP & meals" },
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
  const [isLoading, setIsLoading] = useState(!cachedWorkspace);
  const [isInviteeLoading, setIsInviteeLoading] = useState(!cachedWorkspace);
  const [isSaving, setIsSaving] = useState(false);
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [activity, setActivity] = useState<EventActivity[]>([]);
  const [revisions, setRevisions] = useState<EventDesignRevision[]>([]);
  const [designs, setDesigns] = useState<PublicDesign[]>([]);
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
    const [nextStatistics, nextActivity] = await Promise.all([
      apiRequest<EventStatistics>(`/events/${eventId}/statistics`, {
        headers: authHeaders,
      }),
      apiRequest<EventActivity[]>(`/events/${eventId}/activity`, {
        headers: authHeaders,
      }),
    ]);
    setStatistics(nextStatistics);
    setActivity(nextActivity);
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
    const guests = csvImport.rows
      .map((row) => ({
        name: row[csvImport.mapping.name]?.trim() ?? "",
        email:
          csvImport.mapping.email >= 0
            ? row[csvImport.mapping.email]?.trim() || undefined
            : undefined,
        phone:
          csvImport.mapping.phone >= 0
            ? row[csvImport.mapping.phone]?.trim() || undefined
            : undefined,
        groupName:
          csvImport.mapping.groupName >= 0
            ? row[csvImport.mapping.groupName]?.trim() || undefined
            : undefined,
        mealPreference:
          csvImport.mapping.mealPreference >= 0
            ? row[csvImport.mapping.mealPreference]?.trim() || undefined
            : undefined,
      }))
      .filter((guest) => guest.name);
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
          title: String(form.get("title") || ""),
          type: String(form.get("type") || event.type),
          eventDate: form.get("eventDate") || undefined,
          venue: String(form.get("venue") || ""),
          description: String(form.get("description") || ""),
          rsvpDeadline: form.get("rsvpDeadline") || null,
          organizerNotes: String(form.get("organizerNotes") || ""),
          checklist: {
            details: form.get("checklistDetails") === "on",
            guests: form.get("checklistGuests") === "on",
            reviewed: form.get("checklistReviewed") === "on",
            shared: form.get("checklistShared") === "on",
          },
          isPublished: wantsPublished,
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

  return (
    <div className="event-detail-page">
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
            {showPreview ? "Close preview" : "Preview"}
          </button>
          <button
            className="user-primary-button"
            disabled={isSaving || Boolean(event.archivedAt)}
            onClick={() => void publishEvent()}
            type="button"
          >
            {event.isPublished && !invitationDraft ? "Published" : "Publish"}
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
                {readyCount}/{readiness.length} event essentials are ready.
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
                <p className="user-kicker">Published preview</p>
                <h2>{event.title}</h2>
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
          <section className="event-meta-grid">
            <article>
              <span>Response rate</span>
              <strong>{statistics?.responseRate ?? 0}%</strong>
            </article>
            <article>
              <span>Expected guests</span>
              <strong>{statistics?.expectedGuests ?? 0}</strong>
            </article>
            <article>
              <span>Declined</span>
              <strong>{statistics?.declined ?? 0}</strong>
            </article>
            <article>
              <span>Unopened</span>
              <strong>{statistics?.unopenedInvitees ?? 0}</strong>
            </article>
          </section>
          <section className="event-refinement-grid">
            <article className="user-panel">
              <p className="user-kicker">Meal summary</p>
              <h2>Expected meal requirements</h2>
              {statistics?.mealTotals.length ? (
                statistics.mealTotals.map((meal) => (
                  <p key={meal.meal}>
                    <strong>{meal.count}</strong> {meal.meal}
                  </p>
                ))
              ) : (
                <p>No attending meal choices yet.</p>
              )}
            </article>
            <article className="user-panel event-reminder-panel">
              <p className="user-kicker">Follow-up list</p>
              <h2>Guests needing a reminder</h2>
              {invitees
                .filter(
                  (guest) =>
                    guest.rsvpStatus === "PENDING" || guest.openCount === 0,
                )
                .slice(0, 8)
                .map((guest) => (
                  <div key={guest.id}>
                    <span>
                      <strong>{guest.name}</strong>
                      {guest.openCount === 0
                        ? " · unopened"
                        : " · awaiting RSVP"}
                    </span>
                    <a
                      href={`https://wa.me/${guest.phone?.replace(/\D/g, "") ?? ""}?text=${encodeURIComponent(`Reminder: please view and RSVP to ${event.title}: ${typeof window === "undefined" ? "" : window.location.origin}/invite/${guest.slug}`)}`}
                      onClick={() => void logInviteeShare(guest, "WHATSAPP")}
                      target="_blank"
                    >
                      Remind
                    </a>
                  </div>
                ))}
              {!invitees.length ? (
                <p>Add guests first to track responses.</p>
              ) : null}
            </article>
            <article className="user-panel">
              <p className="user-kicker">RSVP deadline</p>
              <h2>{formatEventDate(event.rsvpDeadline)}</h2>
              <p>
                {rsvpClosed
                  ? "RSVP collection is closed."
                  : "Responses are open."}
              </p>
              <button
                className="user-text-button"
                onClick={() => setActiveTab("settings")}
                type="button"
              >
                Change deadline →
              </button>
            </article>
          </section>
        </div>
      ) : null}

      {activeTab === "sharing" ? (
        <div className="event-tab-content">
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
              `You are invited to ${event.title}. Please open your personal invitation and RSVP.`,
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

      {csvImport ? (
        <CsvMappingDialog
          state={csvImport}
          onCancel={() => setCsvImport(null)}
          onChange={setCsvImport}
          onImport={() => void importMappedCsv()}
        />
      ) : null}
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

function CsvMappingDialog({
  onCancel,
  onChange,
  onImport,
  state,
}: {
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
        <div className="overflow-x-auto">
          <table className="user-table">
            <thead>
              <tr>
                {state.headers.map((header, index) => (
                  <th key={`${header}-${index}`}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.rows.slice(0, 5).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {state.headers.map((_, index) => (
                    <td key={index}>{row[index] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {state.rows.length} rows detected. Rows without a guest name will be
          skipped.
        </p>
        <button
          className="user-primary-button"
          disabled={state.mapping.name < 0}
          onClick={onImport}
          type="button"
        >
          Import guests
        </button>
      </section>
    </div>
  );
}
