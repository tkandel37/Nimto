"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { UserWorkspace } from "../../user-workspace";
import {
  formatEventDate,
  InvitationInvitee,
  EventStatistics,
  UserEvent,
} from "../event-types";
import {
  csvCell,
  InviteeManager,
  validateInviteeDrafts,
} from "../invitee-manager";
import { InvitationQrCode } from "../qr-code";

type EventWorkspaceCache = {
  event: UserEvent;
  invitees: InvitationInvitee[];
  expiresAt: number;
};

const eventWorkspaceCache = new Map<string, EventWorkspaceCache>();

export default function EventDetailPage() {
  return (
    <UserWorkspace activePage="events">
      {({ authHeaders, showToast }) => (
        <EventDetailContent
          authHeaders={authHeaders}
          showToast={showToast}
        />
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
  const [isLoading, setIsLoading] = useState(!cachedWorkspace);
  const [isInviteeLoading, setIsInviteeLoading] = useState(!cachedWorkspace);
  const [isSaving, setIsSaving] = useState(false);
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [isEditing, setIsEditing] = useState(false);

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
      apiRequest<InvitationInvitee[]>(
          `/events/${eventId}/invitees`,
          { headers: authHeaders },
      ),
      apiRequest<EventStatistics>(`/events/${eventId}/statistics`, {
        headers: authHeaders,
      }),
    ])
      .then(([item, items, eventStatistics]) => {
        if (!isActive) return;
        eventWorkspaceCache.set(cacheKey, {
          event: item,
          invitees: items,
          expiresAt: Date.now() + 5 * 60_000,
        });
        setEvent(item);
        setInvitees(items);
        setStatistics(eventStatistics);
      })
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

  async function copyShareLink() {
    if (!event) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/invite/${event.slug}`,
    );
    showToast("Event link copied.");
  }

  async function generateInviteeLinks() {
    if (!event) return;
    const names = draftInvitees
      .filter((draft) => draft.status === "Ready")
      .map((draft) => draft.name);
    if (!names.length) {
      showToast("Add at least one valid invitee name.", "error");
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
      markEventsChanged();
      showToast(
        response.skipped.length
          ? `Created ${response.created.length} links. Skipped ${response.skipped.length} duplicates.`
          : `Created ${response.created.length} invitee links.`,
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
    try {
      await apiRequest(`/events/${event.id}/invitees/${invitee.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      setInvitees((current) =>
        current.filter((item) => item.id !== invitee.id),
      );
      setEvent((current) =>
        current
          ? {
              ...current,
              _count: {
                invitees: Math.max(
                  0,
                  (current._count?.invitees ?? 0) - 1,
                ),
              },
            }
          : current,
      );
      markEventsChanged();
      showToast("Invitee deleted.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not delete invitee.",
        "error",
      );
    }
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
      showToast("Invitee link regenerated.");
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
    showToast("Invitee link copied.");
  }

  async function copyAllInviteeLinks() {
    const rows = invitees.map(
      (invitee) =>
        `${invitee.name},${window.location.origin}/invite/${invitee.slug}`,
    );
    await navigator.clipboard.writeText(
      ["Invitee Name,Link", ...rows].join("\n"),
    );
    showToast("All invitee links copied.");
  }

  function downloadInviteeCsv() {
    const rows = invitees.map((invitee) =>
      [invitee.name, `${window.location.origin}/invite/${invitee.slug}`]
        .map(csvCell)
        .join(","),
    );
    const csv = [["Invitee Name", "Link"].join(","), ...rows].join("\n");
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
    const rows = text.split(/\r?\n/).map((line) =>
      line
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((cell) => cell.trim().replace(/^"|"$/g, "")),
    );
    const headers = rows[0]?.map((header) => header.toLowerCase()) ?? [];
    const nameColumn = headers.findIndex((header) =>
      ["invitee name", "name", "full name", "guest name"].includes(header),
    );
    const column = nameColumn >= 0 ? nameColumn : 0;
    const names = rows
      .slice(nameColumn >= 0 ? 1 : 0)
      .map((row) => row[column]?.trim() ?? "")
      .filter(Boolean);
    setInviteePaste((current) => [current, ...names].filter(Boolean).join("\n"));
    showToast(`Loaded ${names.length} names from “${headers[column] || "column 1"}”.`);
  }

  async function saveEventDetails(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event) return;
    const form = new FormData(eventForm.currentTarget);
    setIsSaving(true);
    try {
      const updated = await apiRequest<UserEvent>(`/events/${event.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          title: String(form.get("title") || ""),
          eventDate: form.get("eventDate") || undefined,
          venue: String(form.get("venue") || ""),
          description: String(form.get("description") || ""),
          isPublished: form.get("isPublished") === "on",
        }),
      });
      setEvent((current) => (current ? { ...current, ...updated } : updated));
      setIsEditing(false);
      markEventsChanged();
      showToast("Event details saved.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save event.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function duplicateEvent() {
    if (!event) return;
    setIsSaving(true);
    try {
      const duplicate = await apiRequest<UserEvent>(`/events/${event.id}/duplicate`, {
        method: "POST",
        headers: authHeaders,
      });
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
    if (!event.archivedAt && !window.confirm("Archive this event and disable its public links?"))
      return;
    const updated = await apiRequest<UserEvent>(`/events/${event.id}/${action}`, {
      method: "POST",
      headers: authHeaders,
    });
    setEvent((current) => (current ? { ...current, ...updated } : updated));
    markEventsChanged();
    showToast(action === "archive" ? "Event archived." : "Event restored.");
  }

  async function deleteEvent() {
    if (!event || !window.confirm(`Permanently delete “${event.title}” and all guest links?`))
      return;
    await apiRequest(`/events/${event.id}`, { method: "DELETE", headers: authHeaders });
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
  }

  if (isLoading && !event) {
    return <section className="user-panel user-empty">Loading event...</section>;
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

  return (
    <div className="event-detail-page">
      <section className="user-panel event-detail-header">
        <div className="event-detail-title">
          <Link href="/events">← All events</Link>
          <div className="event-title-line">
            <div>
              <p className="user-kicker">{event.type}</p>
              <h1>{event.title}</h1>
            </div>
            <span
              className={
                event.isPublished ? "user-status published" : "user-status"
              }
            >
              {event.isPublished ? "Shareable" : "Draft"}
            </span>
          </div>
          <p>{event.description || "Manage this invitation and its guests."}</p>
        </div>
        <div className="event-header-actions">
          <button className="user-secondary-button" onClick={() => setIsEditing((value) => !value)} type="button">
            {isEditing ? "Close editor" : "Edit event"}
          </button>
          <button className="user-secondary-button" disabled={isSaving} onClick={() => void duplicateEvent()} type="button">
            Duplicate
          </button>
          <button
            className="user-secondary-button"
            disabled={!event.isPublished}
            onClick={() => void copyShareLink()}
            type="button"
          >
            Copy event link
          </button>
          <button
            aria-expanded={showPreview}
            className="user-primary-button"
            disabled={!event.isPublished}
            onClick={() => setShowPreview((current) => !current)}
            type="button"
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </button>
        </div>
      </section>

      {isEditing ? (
        <form className="user-panel event-edit-form" onSubmit={saveEventDetails}>
          <label className="user-field">
            <span>Event title</span>
            <input defaultValue={event.title} minLength={2} name="title" required />
          </label>
          <label className="user-field">
            <span>Date and time</span>
            <input defaultValue={event.eventDate?.slice(0, 16) ?? ""} name="eventDate" type="datetime-local" />
          </label>
          <label className="user-field">
            <span>Venue</span>
            <input defaultValue={event.venue ?? ""} name="venue" />
          </label>
          <label className="user-field event-edit-description">
            <span>Description</span>
            <textarea defaultValue={event.description ?? ""} name="description" rows={3} />
          </label>
          <label className="event-publish-toggle">
            <input defaultChecked={event.isPublished} name="isPublished" type="checkbox" />
            Public and shareable
          </label>
          <button className="user-primary-button" disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </form>
      ) : null}

      {!event.isPublished ? (
        <p className="event-draft-note">
          This event is a draft. Publish it before copying or previewing the
          public invitation.
        </p>
      ) : null}

      <section className="event-meta-grid" aria-label="Event details">
        <article>
          <span>Event date</span>
          <strong>{formatEventDate(event.eventDate)}</strong>
        </article>
        <article>
          <span>Venue</span>
          <strong>{event.venue || "Not set"}</strong>
        </article>
        <article>
          <span>Design</span>
          <strong>{event.designVersion?.design?.name ?? "Custom"}</strong>
        </article>
        <article>
          <span>Invitation opens</span>
          <strong>{statistics?.invitationOpens ?? event.openCount ?? 0}</strong>
        </article>
        <article>
          <span>Attending</span>
          <strong>{statistics?.attending ?? 0}</strong>
        </article>
        <article>
          <span>Declined</span>
          <strong>{statistics?.declined ?? 0}</strong>
        </article>
        <article>
          <span>Expected guests</span>
          <strong>{statistics?.expectedGuests ?? 0}</strong>
        </article>
      </section>

      <section className="user-panel event-share-panel">
        <div>
          <p className="user-kicker">Share and reuse</p>
          <h2>Send the main invitation</h2>
          <p>Use the public event link for general sharing, or personalized links below for RSVP tracking.</p>
        </div>
        <div className="event-header-actions">
          <button className="user-secondary-button" disabled={!event.isPublished} onClick={() => shareEvent("whatsapp")} type="button">WhatsApp</button>
          <button className="user-secondary-button" disabled={!event.isPublished} onClick={() => shareEvent("messenger")} type="button">Messenger</button>
          <button className="user-secondary-button" disabled={!event.isPublished} onClick={() => shareEvent("email")} type="button">Email</button>
          {event.isPublished ? (
            <InvitationQrCode label={event.title} url={`${typeof window === "undefined" ? "" : window.location.origin}/invite/${event.slug}`} />
          ) : null}
          <button className="user-secondary-button" onClick={() => void toggleArchive()} type="button">
            {event.archivedAt ? "Restore event" : "Archive event"}
          </button>
          <button className="user-danger-button" onClick={() => void deleteEvent()} type="button">Delete event</button>
        </div>
      </section>

      <div
        className={
          showPreview
            ? "event-detail-layout preview-open"
            : "event-detail-layout"
        }
      >
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
          onGenerate={() => void generateInviteeLinks()}
          onInput={setInviteeInput}
          onPaste={setInviteePaste}
          onReadCsv={(file) => void readInviteeCsv(file)}
          onRegenerate={(invitee) => void regenerateInvitee(invitee)}
          onSearch={setInviteeSearch}
        />

        {showPreview ? (
          <aside className="user-panel event-preview-drawer">
            <div>
              <p className="user-kicker">Live preview</p>
              <h2>{event.title}</h2>
            </div>
            <div className="event-preview-actions">
              <Link
                className="user-secondary-button"
                href={`/invite/${event.slug}`}
                target="_blank"
              >
                Open full
              </Link>
              <button
                className="user-secondary-button"
                onClick={() => setShowPreview(false)}
                type="button"
              >
                Collapse
              </button>
            </div>
            <iframe
              sandbox="allow-scripts"
              src={`/invite/${event.slug}`}
              title={`${event.title} invitation preview`}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function markEventsChanged() {
  localStorage.setItem("nimto_events_changed", String(Date.now()));
}
