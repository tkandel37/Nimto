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
    thumbnailHtml?: string | null;
  };
};

type CatalogueDesignThumbnail = {
  id: string;
  slug: string;
  versions: { thumbnailHtml?: string | null }[];
};

let designHistoryCache: {
  expiresAt: number;
  changeToken: string;
  items: DesignHistoryItem[];
} | null = null;

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
  const [items, setItems] = useState<DesignHistoryItem[]>(
    designHistoryCache?.items ?? [],
  );
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(!designHistoryCache);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      setHiddenIds(
        JSON.parse(localStorage.getItem("nimto_hidden_history") ?? "[]"),
      );
    } catch {
      setHiddenIds([]);
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    const changeToken = localStorage.getItem("nimto_events_changed") ?? "";
    if (
      designHistoryCache &&
      designHistoryCache.changeToken === changeToken &&
      designHistoryCache.expiresAt > Date.now()
    ) {
      setItems(designHistoryCache.items);
      setIsLoading(false);
      return;
    }

    if (!designHistoryCache) setIsLoading(true);
    Promise.all([
      apiRequest<DesignHistoryItem[]>("/events/design-history", {
        headers: authHeaders,
      }),
      apiRequest<CatalogueDesignThumbnail[]>(
        "/template-design/public/designs",
      ),
    ])
      .then(([history, catalogue]) => {
        if (!isActive) return;
        const thumbnails = new Map(
          catalogue.map((design) => [
            design.id,
            design.versions[0]?.thumbnailHtml ?? null,
          ]),
        );
        const historyWithThumbnails = history.map((item) => ({
          ...item,
          lastUsedVersion: {
            ...item.lastUsedVersion,
            thumbnailHtml:
              thumbnails.get(item.design.id) ??
              item.lastUsedVersion.thumbnailHtml ??
              null,
          },
        }));
        designHistoryCache = {
          changeToken,
          expiresAt: Date.now() + 5 * 60_000,
          items: historyWithThumbnails,
        };
        setItems(historyWithThumbnails);
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
    const available = items.filter((item) => !hiddenIds.includes(item.id));
    if (!query) return available;
    return available.filter((item) =>
      [
        item.design.name,
        item.design.category?.name,
        item.design.subcategory?.name,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [hiddenIds, items, search]);

  const totalUses = items.reduce((sum, item) => sum + item.usageCount, 0);
  const reusableCount = items.filter(isReusable).length;

  return (
    <section className="grid gap-5">
      <div className="user-panel">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="user-kicker">Invitation history</p>
            <h1 className="mt-2 text-3xl font-black text-ink">
              Designs I have used
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
              The designs you actually used stay here. If one worked well for a
              family event or office invite, you can pick it up again without
              digging through the full catalogue.
            </p>
          </div>
          <Link className="user-primary-button" href="/designs">
            Find another design
          </Link>
        </div>

        {items.length ? (
          <div className="user-history-summary">
            <HistoryStat
              label="Saved invitations"
              value={filteredItems.length}
            />
            <HistoryStat label="Total uses" value={totalUses} />
            <HistoryStat label="Can reuse" value={reusableCount} />
          </div>
        ) : null}
      </div>

      {items.length ? (
        <div className="user-history-filter">
          <label>
            <span>Find an invitation</span>
            <input
              aria-label="Search your design history"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by invitation or category"
              value={search}
            />
          </label>
          <p>Most recent first · hidden cards stay hidden on this browser</p>
        </div>
      ) : null}

      <div className="user-design-grid user-history-grid">
        {filteredItems.map((item) => {
          const reusable = isReusable(item);
          const currentVersion = item.design.versions[0];
          return (
            <article className="user-design-card" key={item.id}>
              <button
                className="user-design-preview"
                disabled={!reusable}
                onClick={() => {
                  window.location.href = `/designs?template=${encodeURIComponent(item.design.slug)}`;
                }}
                type="button"
              >
                <div className="design-card-stage">
                  <iframe
                    loading="lazy"
                    sandbox=""
                    srcDoc={designCardPreviewHtml(
                      item.lastUsedVersion.thumbnailHtml ??
                        item.lastUsedVersion.rawHtml,
                    )}
                    title={`${item.design.name} history preview`}
                  />
                </div>
              </button>
              <div className="design-card-details">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-ink">
                      {item.design.name}
                    </h2>
                    <p className="design-category-chip">
                      {[
                        item.design.category?.name,
                        item.design.subcategory?.name,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "Uncategorized"}
                    </p>
                  </div>
                  <span className="user-version-pill">
                    v{item.lastUsedVersion.versionNumber}
                  </span>
                </div>

                <p className="user-history-card-meta">
                  Used {item.usageCount} {item.usageCount === 1 ? "time" : "times"}
                  <span aria-hidden="true">·</span>
                  Last used {formatDate(item.lastUsedAt)}
                </p>

                <div className="design-card-actions">
                  {item.design.activeEventCount ? (
                    <Link className="user-secondary-button" href="/events">
                      View events
                    </Link>
                  ) : (
                    <button
                      className="user-secondary-button"
                      onClick={() => {
                        const next = [...hiddenIds, item.id];
                        setHiddenIds(next);
                        localStorage.setItem(
                          "nimto_hidden_history",
                          JSON.stringify(next),
                        );
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  )}
                  {reusable ? (
                    <Link
                      className="user-primary-button"
                      href={`/designs?template=${encodeURIComponent(item.design.slug)}`}
                    >
                      Reuse
                    </Link>
                  ) : (
                    <button
                      className="user-primary-button"
                      disabled
                      title="This design is no longer active in the catalogue."
                      type="button"
                    >
                      Unavailable
                    </button>
                  )}
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

      {isLoading && !items.length ? (
        <div className="invitation-card-skeletons" aria-label="Loading saved invitations">
          {[1, 2, 3].map((item) => (
            <div key={item}><span /><i /><b /></div>
          ))}
        </div>
      ) : null}
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

function designCardPreviewHtml(rawHtml: string) {
  if (!rawHtml) return "";
  const previewCss =
    '<meta name="viewport" content="width=device-width, initial-scale=1"><style id="nimto-card-preview-style">html,body{width:100%!important;max-width:100%!important;overflow:hidden!important;scroll-behavior:auto!important}*,*::before,*::after{transition:none!important;animation-duration:.001s!important;animation-iteration-count:1!important}</style>';
  if (/<\/head>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/head>/i, `${previewCss}</head>`);
  }
  return `${previewCss}${rawHtml}`;
}
