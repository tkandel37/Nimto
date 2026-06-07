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

  async function copyShareLink(event: UserEvent) {
    const url = `${window.location.origin}/invite/${event.slug}`;
    await navigator.clipboard.writeText(url);
    showToast("Share link copied.");
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
