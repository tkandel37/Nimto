"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { UserWorkspace } from "../user-workspace";
import { formatEventDate, UserEvent } from "./event-types";

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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
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

  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesStatus =
        status === "all" ||
        (status === "published" && event.isPublished) ||
        (status === "draft" && !event.isPublished);
      const matchesQuery =
        !normalizedQuery ||
        [event.title, event.type, event.venue, event.designVersion?.design?.name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      return matchesStatus && matchesQuery;
    });
  }, [events, query, status]);

  const inviteeCount = events.reduce(
    (total, event) => total + (event._count?.invitees ?? 0),
    0,
  );

  return (
    <div className="grid gap-5">
      <section className="user-panel event-overview-hero">
        <div>
          <p className="user-kicker">Events</p>
          <h1 className="mt-2 text-3xl font-black text-ink">
            Your invitations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
            Open an event to manage guest names, personalized links, and its
            invitation preview in one focused workspace.
          </p>
        </div>
        <Link className="user-primary-button" href="/designs">
          Create from a design
        </Link>
      </section>

      <section className="event-summary-grid" aria-label="Event summary">
        <article>
          <span>Events</span>
          <strong>{events.length}</strong>
        </article>
        <article>
          <span>Shareable</span>
          <strong>{events.filter((event) => event.isPublished).length}</strong>
        </article>
        <article>
          <span>Personalized links</span>
          <strong>{inviteeCount}</strong>
        </article>
      </section>

      <section className="user-panel">
        <div className="event-filter-row">
          <label className="event-search">
            <span className="sr-only">Search events</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search event, venue, or design"
              value={query}
            />
          </label>
          <div className="event-status-filter" aria-label="Filter events">
            {(["all", "published", "draft"] as const).map((option) => (
              <button
                aria-pressed={status === option}
                className={status === option ? "active" : ""}
                key={option}
                onClick={() => setStatus(option)}
                type="button"
              >
                {option === "all"
                  ? "All"
                  : option === "published"
                    ? "Shareable"
                    : "Drafts"}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? <p className="user-empty">Loading events...</p> : null}

        {!isLoading && visibleEvents.length ? (
          <div className="event-card-grid">
            {visibleEvents.map((event) => (
              <Link
                className="event-card"
                href={`/events/${event.id}`}
                key={event.id}
              >
                <div className="event-card-topline">
                  <span
                    className={
                      event.isPublished
                        ? "user-status published"
                        : "user-status"
                    }
                  >
                    {event.isPublished ? "Shareable" : "Draft"}
                  </span>
                  <span>{formatEventDate(event.updatedAt, "Updated")}</span>
                </div>
                <h2>{event.title}</h2>
                <p>{event.venue || event.type}</p>
                <dl>
                  <div>
                    <dt>Date</dt>
                    <dd>{formatEventDate(event.eventDate)}</dd>
                  </div>
                  <div>
                    <dt>Design</dt>
                    <dd>{event.designVersion?.design?.name ?? "Custom"}</dd>
                  </div>
                  <div>
                    <dt>Invitees</dt>
                    <dd>{event._count?.invitees ?? 0}</dd>
                  </div>
                </dl>
                <span className="event-card-open">
                  Manage event <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        ) : null}

        {!isLoading && !events.length ? (
          <div className="user-empty">
            <h2>No events yet</h2>
            <p>Select a design and create your first invitation.</p>
            <Link className="user-primary-button mt-4" href="/designs">
              Browse designs
            </Link>
          </div>
        ) : null}

        {!isLoading && events.length && !visibleEvents.length ? (
          <div className="user-empty">
            <h2>No matching events</h2>
            <p>Try another search or status filter.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
