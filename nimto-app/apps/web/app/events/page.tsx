"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Icon, UserWorkspace } from "../user-workspace";

type UserEvent = {
  id: string;
  title: string;
  type: string;
  eventDate?: string | null;
  venue?: string | null;
  slug: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  designVersion?: {
    id: string;
    versionNumber: number;
    design?: { id: string; name: string; slug: string; status: string } | null;
  } | null;
  _count?: { invitees: number };
};

type InvitationInvitee = {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

type InviteeDraft = {
  name: string;
  status: "Ready" | "Duplicate" | "Empty name" | "Invalid character" | "Too long";
};

let eventCache: { expiresAt: number; items: UserEvent[] } | null = null;
let eventCacheToken = "";

export default function EventsPage() {
  return (
    <UserWorkspace activePage="events">
      {({ authHeaders, showToast }) => (
        <EventsContent authHeaders={authHeaders} showToast={showToast} />
      )}
    </UserWorkspace>
  );
}

function EventsContent({
  authHeaders,
  showToast,
}: {
  authHeaders: Record<string, string>;
  showToast: (message: string, tone?: "success" | "error") => void;
}) {
  const [events, setEvents] = useState<UserEvent[]>(eventCache?.items ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!eventCache);
  const [invitees, setInvitees] = useState<InvitationInvitee[]>([]);
  const [inviteeInput, setInviteeInput] = useState("");
  const [inviteePaste, setInviteePaste] = useState("");
  const [inviteeSearch, setInviteeSearch] = useState("");
  const [isInviteeLoading, setIsInviteeLoading] = useState(false);

  useEffect(() => {
    let isActive = true;
    const latestCacheToken = localStorage.getItem("nimto_events_changed") ?? "";
    if (
      eventCache &&
      eventCache.expiresAt > Date.now() &&
      eventCacheToken === latestCacheToken
    ) {
      setEvents(eventCache.items);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    apiRequest<UserEvent[]>("/events", { headers: authHeaders })
      .then((items) => {
        if (!isActive) return;
        eventCacheToken = latestCacheToken;
        eventCache = { expiresAt: Date.now() + 30_000, items };
        setEvents(items);
      })
      .catch((error) => {
        if (!isActive) return;
        showToast(
          error instanceof Error ? error.message : "Could not load events.",
          "error",
        );
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [authHeaders, showToast]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedId) ?? events[0] ?? null,
    [events, selectedId],
  );

  useEffect(() => {
    if (!selectedEvent) {
      setInvitees([]);
      return;
    }
    let isActive = true;
    setIsInviteeLoading(true);
    apiRequest<InvitationInvitee[]>(`/events/${selectedEvent.id}/invitees`, {
      headers: authHeaders,
    })
      .then((items) => {
        if (isActive) setInvitees(items);
      })
      .catch((error) => {
        if (!isActive) return;
        showToast(
          error instanceof Error ? error.message : "Could not load invitees.",
          "error",
        );
      })
      .finally(() => {
        if (isActive) setIsInviteeLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [authHeaders, selectedEvent, showToast]);

  async function copyShareLink(event: UserEvent) {
    const url = `${window.location.origin}/invite/${event.slug}`;
    await navigator.clipboard.writeText(url);
    showToast("Share link copied.");
  }

  const draftInvitees = useMemo(
    () =>
      validateInviteeDrafts(
        [...inviteeInput.split(/\n/), ...inviteePaste.split(/\n/)],
        invitees,
      ),
    [inviteeInput, inviteePaste, invitees],
  );

  async function generateInviteeLinks() {
    if (!selectedEvent) return;
    const names = draftInvitees
      .filter((draft) => draft.status === "Ready")
      .map((draft) => draft.name);
    if (!names.length) {
      showToast("Add at least one valid invitee name.", "error");
      return;
    }

    const response = await apiRequest<{
      created: InvitationInvitee[];
      skipped: { name: string; reason: string }[];
    }>(`/events/${selectedEvent.id}/invitees`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ names }),
    });
    setInvitees((current) => [...current, ...response.created]);
    setInviteeInput("");
    setInviteePaste("");
    localStorage.setItem("nimto_events_changed", String(Date.now()));
    showToast(
      response.skipped.length
        ? `Created ${response.created.length} links. Skipped ${response.skipped.length} duplicates.`
        : `Created ${response.created.length} invitee links.`,
    );
  }

  async function deleteInvitee(invitee: InvitationInvitee) {
    if (!selectedEvent) return;
    await apiRequest(`/events/${selectedEvent.id}/invitees/${invitee.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    setInvitees((current) => current.filter((item) => item.id !== invitee.id));
    localStorage.setItem("nimto_events_changed", String(Date.now()));
    showToast("Invitee deleted.");
  }

  async function regenerateInvitee(invitee: InvitationInvitee) {
    if (!selectedEvent) return;
    const updated = await apiRequest<InvitationInvitee>(
      `/events/${selectedEvent.id}/invitees/${invitee.id}/regenerate`,
      { method: "POST", headers: authHeaders },
    );
    setInvitees((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    showToast("Invitee link regenerated.");
  }

  async function copyInviteeLink(invitee: InvitationInvitee) {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${invitee.slug}`);
    showToast("Invitee link copied.");
  }

  async function copyAllInviteeLinks() {
    const rows = invitees.map(
      (invitee) => `${invitee.name},${window.location.origin}/invite/${invitee.slug}`,
    );
    await navigator.clipboard.writeText(["Invitee Name,Link", ...rows].join("\n"));
    showToast("All invitee links copied.");
  }

  function downloadInviteeCsv() {
    const rows = invitees.map((invitee) =>
      [invitee.name, `${window.location.origin}/invite/${invitee.slug}`]
        .map(csvCell)
        .join(","),
    );
    const csv = [["Invitee Name", "Link"].join(","), ...rows].join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedEvent?.slug ?? "invitees"}-links.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function readInviteeCsv(file?: File) {
    if (!file) return;
    const text = await file.text();
    const names = text
      .split(/\r?\n/)
      .map((line) => line.split(",")[0]?.trim() ?? "")
      .filter((name) => name && name.toLowerCase() !== "invitee name");
    setInviteePaste((current) => [current, ...names].filter(Boolean).join("\n"));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="user-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="user-kicker">Events</p>
            <h1 className="mt-2 text-3xl font-black text-ink">
              Your invitations
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Every event you create from a design is available here with a
              public share link.
            </p>
          </div>
          <Link className="user-primary-button" href="/designs">
            Choose a design
          </Link>
        </div>

        <div className="mt-7 overflow-x-auto">
          <table className="user-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Design</th>
                <th>Date</th>
                <th>Status</th>
                <th>Updated</th>
                <th className="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  className={selectedEvent?.id === event.id ? "selected" : ""}
                  key={event.id}
                  onClick={() => setSelectedId(event.id)}
                >
                  <td>
                    <strong>{event.title}</strong>
                    <span>{event.venue || event.type}</span>
                  </td>
                  <td>{event.designVersion?.design?.name ?? "Custom"}</td>
                  <td>{formatDate(event.eventDate)}</td>
                  <td>
                    <span
                      className={
                        event.isPublished
                          ? "user-status published"
                          : "user-status"
                      }
                    >
                      {event.isPublished ? "Shareable" : "Draft"}
                    </span>
                  </td>
                  <td>{formatDate(event.updatedAt)}</td>
                  <td className="text-right">
                    <button
                      aria-label={`Copy share link for ${event.title}`}
                      className="user-icon-button"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        void copyShareLink(event);
                      }}
                      type="button"
                    >
                      <Icon>
                        <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
                        <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
                      </Icon>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLoading ? <p className="user-empty">Loading events...</p> : null}
          {!isLoading && !events.length ? (
            <div className="user-empty">
              <h2>No events yet</h2>
              <p>Select a published design and create your first invitation.</p>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="user-panel user-preview-panel">
        {selectedEvent ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="user-kicker">Preview</p>
                <h2 className="mt-2 text-xl font-black text-ink">
                  {selectedEvent.title}
                </h2>
              </div>
              <button
                className="user-secondary-button"
                onClick={() => void copyShareLink(selectedEvent)}
                type="button"
              >
                Copy link
              </button>
            </div>
            <iframe
              className="mt-5 h-[560px] w-full rounded-lg border border-ink/10 bg-white"
              sandbox="allow-scripts"
              src={`/invite/${selectedEvent.slug}`}
              title={`${selectedEvent.title} invitation preview`}
            />
            <InviteeManager
              draftInvitees={draftInvitees}
              inviteeInput={inviteeInput}
              inviteePaste={inviteePaste}
              inviteeSearch={inviteeSearch}
              invitees={invitees}
              isLoading={isInviteeLoading}
              onCopyAll={copyAllInviteeLinks}
              onCopyOne={copyInviteeLink}
              onDelete={deleteInvitee}
              onDownload={downloadInviteeCsv}
              onGenerate={generateInviteeLinks}
              onInput={setInviteeInput}
              onPaste={setInviteePaste}
              onReadCsv={readInviteeCsv}
              onRegenerate={regenerateInvitee}
              onSearch={setInviteeSearch}
            />
          </>
        ) : (
          <div className="user-empty">
            <h2>Select an event</h2>
            <p>Your invitation preview will appear here.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function InviteeManager({
  draftInvitees,
  inviteeInput,
  inviteePaste,
  inviteeSearch,
  invitees,
  isLoading,
  onCopyAll,
  onCopyOne,
  onDelete,
  onDownload,
  onGenerate,
  onInput,
  onPaste,
  onReadCsv,
  onRegenerate,
  onSearch,
}: {
  draftInvitees: InviteeDraft[];
  inviteeInput: string;
  inviteePaste: string;
  inviteeSearch: string;
  invitees: InvitationInvitee[];
  isLoading: boolean;
  onCopyAll: () => void;
  onCopyOne: (invitee: InvitationInvitee) => void;
  onDelete: (invitee: InvitationInvitee) => void;
  onDownload: () => void;
  onGenerate: () => void;
  onInput: (value: string) => void;
  onPaste: (value: string) => void;
  onReadCsv: (file?: File) => void;
  onRegenerate: (invitee: InvitationInvitee) => void;
  onSearch: (value: string) => void;
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const readyCount = draftInvitees.filter((draft) => draft.status === "Ready").length;
  const filteredInvitees = invitees.filter((invitee) =>
    invitee.name.toLowerCase().includes(inviteeSearch.trim().toLowerCase()),
  );

  return (
    <section className="mt-5 rounded-xl border border-ink/10 bg-paper/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="user-kicker">Invitee links</p>
          <h3 className="mt-1 text-lg font-black text-ink">
            Add names and generate links
          </h3>
          <p className="mt-1 text-sm leading-6 text-ink/55">
            Manual entry, pasted lists, and CSV uploads all create personalized
            share links for the same invitation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="user-secondary-button"
            disabled={!invitees.length}
            onClick={onCopyAll}
            type="button"
          >
            Copy all
          </button>
          <button
            className="user-secondary-button"
            disabled={!invitees.length}
            onClick={onDownload}
            type="button"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="user-field">
          <span>
            <span>Add manually</span>
            <em>1-10 names</em>
          </span>
          <input
            onChange={(event) => onInput(event.target.value)}
            placeholder="Trilochan Kandel"
            value={inviteeInput}
          />
        </label>
        <label className="user-field">
          <span>
            <span>Paste list</span>
            <em>One name per line</em>
          </span>
          <textarea
            onChange={(event) => onPaste(event.target.value)}
            placeholder={"Nishwet Adhikari\nJoon Shakya"}
            rows={4}
            value={inviteePaste}
          />
        </label>
        <label className="user-field">
          <span>
            <span>Upload CSV</span>
            <em>First column is used</em>
          </span>
          <input
            accept=".csv,text/csv"
            onChange={(event) => onReadCsv(event.target.files?.[0])}
            type="file"
          />
        </label>
      </div>

      {draftInvitees.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-ink/10 bg-white">
          <table className="user-table">
            <thead>
              <tr>
                <th>S.N.</th>
                <th>Invitee Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {draftInvitees.map((draft, index) => (
                <tr key={`${draft.name}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{draft.name || "Empty"}</td>
                  <td>{draft.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="user-primary-button m-3 w-[calc(100%-1.5rem)]"
            disabled={!readyCount}
            onClick={onGenerate}
            type="button"
          >
            Generate {readyCount} links
          </button>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <h4 className="font-black text-ink">
          Generated links {isLoading ? "(loading...)" : `(${invitees.length})`}
        </h4>
        <input
          className="max-w-[180px] rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search invitee"
          value={inviteeSearch}
        />
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-ink/10 bg-white">
        <table className="user-table">
          <thead>
            <tr>
              <th>S.N.</th>
              <th>Invitee Name</th>
              <th>Preview URL</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvitees.map((invitee, index) => (
              <tr key={invitee.id}>
                <td>{index + 1}</td>
                <td>{invitee.name}</td>
                <td>{origin}/invite/{invitee.slug}</td>
                <td>Ready</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button className="user-secondary-button" onClick={() => onCopyOne(invitee)} type="button">
                      Copy
                    </button>
                    <button className="user-secondary-button" onClick={() => onRegenerate(invitee)} type="button">
                      Regenerate
                    </button>
                    <button className="user-secondary-button" onClick={() => onDelete(invitee)} type="button">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredInvitees.length ? (
          <p className="p-4 text-sm text-ink/55">
            No invitee links yet. Add names above to generate personalized URLs.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function validateInviteeDrafts(
  names: string[],
  existingInvitees: InvitationInvitee[],
): InviteeDraft[] {
  const existing = new Set(
    existingInvitees.map((invitee) => invitee.name.toLowerCase()),
  );
  const seen = new Set<string>();
  return names
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter((name, index, all) => name || all.length > 1)
    .map((name) => {
      const key = name.toLowerCase();
      let status: InviteeDraft["status"] = "Ready";
      if (!name) status = "Empty name";
      else if (name.length > 120) status = "Too long";
      else if (!/^[\p{L}\p{M}\d .,'&-]+$/u.test(name)) status = "Invalid character";
      else if (existing.has(key) || seen.has(key)) status = "Duplicate";
      seen.add(key);
      return { name, status };
    });
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
