"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { UserWorkspace } from "../user-workspace";
import { formatEventDate, UserEvent } from "./event-types";
import styles from "./events-page.module.css";

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
      return;
    }

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
  const eventCounts = {
    all: events.filter((event) => !event.archivedAt).length,
    published: events.filter(
      (event) => event.isPublished && !event.archivedAt,
    ).length,
    draft: events.filter((event) => !event.isPublished && !event.archivedAt)
      .length,
    archived: events.filter((event) => Boolean(event.archivedAt)).length,
  };

  function clearEventFilters() {
    setQuery("");
    setStatus("all");
    setSort("updated");
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroHeading}>
          <div>
            <p className={styles.eyebrow}>Event management</p>
            <h1>Events</h1>
            <p className={styles.heroCopy}>
              Create invitations, manage guests, and keep every celebration in
              one place.
            </p>
          </div>
          <Link className={`user-primary-button ${styles.createButton}`} href="/designs">
            <span aria-hidden="true">＋</span>
            Create event
          </Link>
        </div>

        <div className={styles.summary} aria-label="Event summary">
          <article>
            <span className={`${styles.summaryIcon} ${styles.calendarIcon}`} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
              </svg>
            </span>
            <div>
              <strong>{eventCounts.all}</strong>
              <span>Active events</span>
            </div>
          </article>
          <article>
            <span className={`${styles.summaryIcon} ${styles.liveIcon}`} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m7 12 3 3 7-7" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </span>
            <div>
              <strong>{eventCounts.published}</strong>
              <span>Published</span>
            </div>
          </article>
          <article>
            <span className={`${styles.summaryIcon} ${styles.guestIcon}`} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="9" cy="8" r="3" />
                <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 11a3 3 0 0 1 0 6M17 7a3 3 0 0 1 0 6" />
              </svg>
            </span>
            <div>
              <strong>{inviteeCount}</strong>
              <span>Guest links</span>
            </div>
          </article>
        </div>
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

      <section className={styles.workspace}>
        <div className={styles.workspaceHeading}>
          <div>
            <h2>Your events</h2>
            <p>
              {isLoading
                ? "Loading your invitations…"
                : `${eventCounts.all} active ${eventCounts.all === 1 ? "event" : "events"}`}
            </p>
          </div>
        </div>

        <div className={styles.controls}>
          <label className={styles.search}>
            <span className="sr-only">Search events</span>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" />
            </svg>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by event, venue, or design…"
              value={query}
            />
          </label>
          <div className={styles.statusFilter} aria-label="Filter events">
            {(["all", "published", "draft", "archived"] as const).map(
              (option) => (
                <button
                  aria-pressed={status === option}
                  className={status === option ? styles.active : ""}
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
                  <span>{eventCounts[option]}</span>
                </button>
              ),
            )}
          </div>
          <label className={styles.sort}>
            <span>Sort by</span>
            <select
              onChange={(event) => setSort(event.target.value as typeof sort)}
              value={sort}
            >
              <option value="updated">Recently updated</option>
              <option value="date">Event date</option>
              <option value="title">Event name</option>
            </select>
          </label>
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
            <div className={styles.desktopList}>
              <table className={styles.eventTable}>
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
                      <td className={styles.eventIdentity}>
                        <span className={styles.eventMonogram} aria-hidden="true">
                          {event.title.trim().charAt(0).toUpperCase() || "E"}
                        </span>
                        <span>
                          <strong>{event.title}</strong>
                          <small>{event.venue || event.type}</small>
                        </span>
                      </td>
                      <td className={styles.mutedCell}>
                        {event.designVersion?.design?.name ?? "Custom"}
                      </td>
                      <td className={styles.dateCell}>{formatEventDate(event.eventDate)}</td>
                      <td className={styles.guestCell}>
                        <strong>{event._count?.invitees ?? 0}</strong>
                        <span>guests</span>
                      </td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${
                            event.archivedAt
                              ? styles.archived
                              : event.isPublished
                                ? styles.published
                                : styles.draft
                          }`}
                        >
                          {event.archivedAt
                            ? "Archived"
                            : event.isPublished
                              ? "Published"
                              : "Draft"}
                        </span>
                      </td>
                      <td className={styles.updatedCell}>
                        {formatEventDate(event.updatedAt)}
                      </td>
                      <td className={styles.openCell} aria-hidden="true">
                        →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.mobileList}>
              {visibleEvents.map((event) => (
                <button
                  className={styles.mobileCard}
                  key={event.id}
                  onClick={() => router.push(`/events/${event.id}`)}
                  type="button"
                >
                  <div className={styles.mobileCardTop}>
                    <span
                      className={`${styles.statusPill} ${
                        event.archivedAt
                          ? styles.archived
                          : event.isPublished
                            ? styles.published
                            : styles.draft
                      }`}
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
                  <div className={styles.mobileCardMeta}>
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
          <div className={`user-empty user-first-invitation ${styles.emptyState}`}>
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
          <div className={`user-empty ${styles.emptyState}`}>
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
