"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [events, setEvents] = useState<UserEvent[]>(eventCache?.items ?? []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "all" | "published" | "draft" | "archived"
  >("all");
  const [isLoading, setIsLoading] = useState(!eventCache);
  const [sort, setSort] = useState<"updated" | "date" | "title">("updated");

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
        eventCache = { expiresAt: Date.now() + 5 * 60_000, items };
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
    return events
      .filter((event) => {
        const matchesStatus =
          (status === "all" && !event.archivedAt) ||
          (status === "published" && event.isPublished && !event.archivedAt) ||
          (status === "draft" && !event.isPublished && !event.archivedAt) ||
          (status === "archived" && Boolean(event.archivedAt));
        const matchesQuery =
          !normalizedQuery ||
          [
            event.title,
            event.type,
            event.venue,
            event.designVersion?.design?.name,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedQuery));
        return matchesStatus && matchesQuery;
      })
      .sort((left, right) => {
        if (sort === "title") return left.title.localeCompare(right.title);
        if (sort === "date")
          return (
            +new Date(left.eventDate ?? 8640000000000000) -
            +new Date(right.eventDate ?? 8640000000000000)
          );
        return +new Date(right.updatedAt) - +new Date(left.updatedAt);
      });
  }, [events, query, sort, status]);

  const inviteeCount = events.reduce(
    (total, event) => total + (event._count?.invitees ?? 0),
    0,
  );

  function clearEventFilters() {
    setQuery("");
    setStatus("all");
    setSort("updated");
  }

  return (
    <div className="grid gap-5">
      <section className="user-panel event-overview-hero">
        <div>
          <p className="user-kicker">Event management</p>
          <h1 className="mt-2 text-3xl font-black text-ink">
            Events
          </h1>
        </div>
        <Link className="user-primary-button" href="/designs">
          Create event
        </Link>
      </section>

      <section className="event-summary-grid" aria-label="Event summary">
        <article>
          <span>Events</span>
          <strong>{events.filter((event) => !event.archivedAt).length}</strong>
        </article>
        <article>
          <span>Published</span>
          <strong>{events.filter((event) => event.isPublished).length}</strong>
        </article>
        <article>
          <span>Personalized links</span>
          <strong>{inviteeCount}</strong>
        </article>
      </section>

      {!isLoading && !events.length ? (
        <section className="user-panel user-onboarding-path">
          <div>
            <p className="user-kicker">Simple path</p>
            <h2>Create your first invitation without guessing</h2>
            <p>
              Follow these five steps once. After that, every new event will
              feel familiar.
            </p>
          </div>
          <div className="onboarding-steps">
            {[
              "Choose event type",
              "Pick design",
              "Add event details",
              "Add guests",
              "Preview and share",
            ].map((step, index) => (
              <span key={step}>
                <b>{index + 1}</b>
                {step}
              </span>
            ))}
          </div>
        </section>
      ) : null}

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
            {(["all", "published", "draft", "archived"] as const).map(
              (option) => (
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
                      ? "Published"
                      : option === "draft"
                        ? "Drafts"
                        : "Archived"}
                </button>
              ),
            )}
          </div>
          <select
            className="event-sort-select"
            onChange={(event) => setSort(event.target.value as typeof sort)}
            value={sort}
          >
            <option value="updated">Recently updated</option>
            <option value="date">Event date</option>
            <option value="title">Event name</option>
          </select>
        </div>

        {isLoading && !events.length ? (
          <div className="user-skeleton-list" aria-label="Loading events">
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {visibleEvents.length ? (
          <>
            <div className="event-table-wrap event-desktop-list">
              <table className="user-table event-overview-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Design</th>
                    <th>Date</th>
                    <th>Invitees</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th aria-label="Open event" />
                  </tr>
                </thead>
                <tbody>
                  {visibleEvents.map((event) => (
                    <tr
                      key={event.id}
                      onClick={() => router.push(`/events/${event.id}`)}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                          keyEvent.preventDefault();
                          router.push(`/events/${event.id}`);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td>
                        <strong>{event.title}</strong>
                        <span>{event.venue || event.type}</span>
                      </td>
                      <td>{event.designVersion?.design?.name ?? "Custom"}</td>
                      <td>{formatEventDate(event.eventDate)}</td>
                      <td>{event._count?.invitees ?? 0}</td>
                      <td>
                        <span
                          className={
                            event.isPublished && !event.archivedAt
                              ? "user-status published"
                              : "user-status"
                          }
                        >
                          {event.archivedAt
                            ? "Archived"
                            : event.isPublished
                              ? "Published"
                              : "Draft"}
                        </span>
                      </td>
                      <td>{formatEventDate(event.updatedAt)}</td>
                      <td className="event-table-open" aria-hidden="true">
                        →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="event-mobile-list">
              {visibleEvents.map((event) => (
                <button
                  className="event-mobile-card"
                  key={event.id}
                  onClick={() => router.push(`/events/${event.id}`)}
                  type="button"
                >
                  <div className="event-mobile-card-top">
                    <span
                      className={`user-status ${event.isPublished ? "published" : ""}`}
                    >
                      {event.archivedAt
                        ? "Archived"
                        : event.isPublished
                          ? "Published"
                          : "Draft"}
                    </span>
                    <span>Open →</span>
                  </div>
                  <h2>{event.title}</h2>
                  <p>
                    {formatEventDate(event.eventDate)} ·{" "}
                    {event.venue || event.type}
                  </p>
                  <div className="event-mobile-card-meta">
                    <span>
                      <strong>{event._count?.invitees ?? 0}</strong> guests
                    </span>
                    <span>
                      {event.designVersion?.design?.name ?? "Custom invitation"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {!isLoading && !events.length ? (
          <div className="user-empty user-first-invitation">
            <div className="first-invitation-art" aria-hidden="true">
              ✦
            </div>
            <p className="user-kicker">Nothing sent yet</p>
            <h2>Start with one event you already have in mind</h2>
            <p>
              Pick a design, write the date and place, then preview it like a
              guest before you share the link.
            </p>
            <div className="first-invitation-steps">
              <span>
                <b>1</b> Choose event type
              </span>
              <span>
                <b>2</b> Pick a design
              </span>
              <span>
                <b>3</b> Preview as guest
              </span>
            </div>
            <p className="first-invitation-note">
              Guests will not be notified by myNimto automatically. You stay in
              control and share the link only when you are ready.
            </p>
            <Link className="user-primary-button mt-4" href="/designs">
              Browse designs
            </Link>
          </div>
        ) : null}

        {!isLoading && events.length && !visibleEvents.length ? (
          <div className="user-empty">
            <h2>No matching events</h2>
            <p>
              Nothing matches this search or status. Your events are still safe;
              this is only a filtered view.
            </p>
            <button
              className="user-secondary-button mt-4"
              onClick={clearEventFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
