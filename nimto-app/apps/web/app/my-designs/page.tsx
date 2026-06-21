"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { UserWorkspace } from "../user-workspace";

type DesignHistoryItem = {
  id: string;
  usageCount: number;
  firstUsedAt: string;
  lastUsedAt: string;
  design: {
    id: string;
    name: string;
    slug: string;
    status: string;
    category?: { id: string; name: string; slug: string } | null;
    subcategory?: { id: string; name: string; slug: string } | null;
    versions: { id: string; versionNumber: number }[];
    activeEventCount: number;
  };
  lastUsedVersion: {
    id: string;
    versionNumber: number;
    name: string;
    rawHtml: string;
  };
};

export default function MyDesignsPage() {
  return (
    <UserWorkspace activePage="myDesigns">
      {({ authHeaders, showToast }) => (
        <MyDesignsContent authHeaders={authHeaders} showToast={showToast} />
      )}
    </UserWorkspace>
  );
}

function MyDesignsContent({
  authHeaders,
  showToast,
}: {
  authHeaders: Record<string, string>;
  showToast: (message: string, tone?: "success" | "error") => void;
}) {
  const [items, setItems] = useState<DesignHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    apiRequest<DesignHistoryItem[]>("/events/design-history", {
      headers: authHeaders,
    })
      .then((history) => {
        if (isActive) setItems(history);
      })
      .catch((error) => {
        if (!isActive) return;
        showToast(
          error instanceof Error
            ? error.message
            : "Could not load your design history.",
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

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [
        item.design.name,
        item.design.category?.name,
        item.design.subcategory?.name,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [items, search]);

  const totalUses = items.reduce((sum, item) => sum + item.usageCount, 0);
  const reusableCount = items.filter(isReusable).length;

  return (
    <section className="grid gap-5">
      <div className="user-panel">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="user-kicker">Design history</p>
            <h1 className="mt-2 text-3xl font-black text-ink">My Designs</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
              Designs you have used stay here as a personal history. Reuse an
              available design for another event without searching the full
              catalogue again.
            </p>
          </div>
          <Link className="user-primary-button" href="/designs">
            Browse new designs
          </Link>
        </div>

        {items.length ? (
          <div className="user-history-summary">
            <HistoryStat label="Saved designs" value={items.length} />
            <HistoryStat label="Total uses" value={totalUses} />
            <HistoryStat label="Ready to reuse" value={reusableCount} />
          </div>
        ) : null}
      </div>

      {items.length ? (
        <div className="user-history-filter">
          <label>
            <span>Find a design</span>
            <input
              aria-label="Search your design history"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by design or category"
              value={search}
            />
          </label>
          <p>
            Most recently used first · one card per design
          </p>
        </div>
      ) : null}

      <div className="user-design-grid">
        {filteredItems.map((item) => {
          const reusable = isReusable(item);
          const currentVersion = item.design.versions[0];
          return (
            <article className="user-design-card user-history-card" key={item.id}>
              <div className="user-design-preview">
                <iframe
                  sandbox="allow-scripts"
                  srcDoc={item.lastUsedVersion.rawHtml}
                  title={`${item.design.name} history preview`}
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-ink">
                      {item.design.name}
                    </h2>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-ink/45">
                      {[item.design.category?.name, item.design.subcategory?.name]
                        .filter(Boolean)
                        .join(" / ") || "Uncategorized"}
                    </p>
                  </div>
                  <span
                    className={
                      reusable
                        ? "user-history-availability available"
                        : "user-history-availability"
                    }
                  >
                    {reusable ? "Available" : "History only"}
                  </span>
                </div>

                <dl className="user-history-details">
                  <div>
                    <dt>Used</dt>
                    <dd>
                      {item.usageCount} {item.usageCount === 1 ? "time" : "times"}
                    </dd>
                  </div>
                  <div>
                    <dt>Active events</dt>
                    <dd>{item.design.activeEventCount}</dd>
                  </div>
                  <div>
                    <dt>Last used</dt>
                    <dd>{formatDate(item.lastUsedAt)}</dd>
                  </div>
                  <div>
                    <dt>Version used</dt>
                    <dd>v{item.lastUsedVersion.versionNumber}</dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  {reusable ? (
                    <Link
                      className="user-primary-button flex-1"
                      href={`/designs?template=${encodeURIComponent(item.design.slug)}`}
                    >
                      Reuse design
                      {currentVersion?.versionNumber !==
                      item.lastUsedVersion.versionNumber
                        ? ` · v${currentVersion?.versionNumber}`
                        : ""}
                    </Link>
                  ) : (
                    <button
                      className="user-primary-button flex-1"
                      disabled
                      title="This design is no longer active in the catalogue."
                      type="button"
                    >
                      Not available to reuse
                    </button>
                  )}
                  {item.design.activeEventCount ? (
                    <Link className="user-secondary-button" href="/events">
                      View events
                    </Link>
                  ) : null}
                </div>

                {!reusable ? (
                  <p className="user-history-note">
                    Kept for your records. The design was unpublished or
                    replaced and cannot create a new event right now.
                  </p>
                ) : currentVersion?.versionNumber !==
                  item.lastUsedVersion.versionNumber ? (
                  <p className="user-history-note">
                    A newer version is available. Reuse starts with the current
                    version while your older invitations stay unchanged.
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {isLoading ? <p className="user-empty">Loading your design history...</p> : null}
      {!isLoading && !items.length ? (
        <div className="user-empty user-history-empty">
          <h2>No design history yet</h2>
          <p>
            After you create an event from a design, it will appear here
            automatically and remain in your history.
          </p>
          <Link className="user-primary-button mt-4" href="/designs">
            Choose your first design
          </Link>
        </div>
      ) : null}
      {!isLoading && items.length > 0 && !filteredItems.length ? (
        <div className="user-empty">
          <h2>No matching saved designs</h2>
          <p>Try a different design or category name.</p>
        </div>
      ) : null}
    </section>
  );
}

function HistoryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function isReusable(item: DesignHistoryItem) {
  return item.design.status === "ACTIVE" && item.design.versions.length > 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}
