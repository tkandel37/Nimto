"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { apiRequest } from "@/lib/api";
import { UserWorkspace } from "../user-workspace";

type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  subcategories?: { id: string; name: string; slug: string }[];
};

type TemplateField = {
  key: string;
  label: string;
  type: string;
  sectionKey?: string;
  required: boolean;
  paid: boolean;
  locked: boolean;
};

type NormalizedField = TemplateField & {
  inputType: string;
  control: "input" | "textarea";
};

type PublicDesign = {
  id: string;
  name: string;
  slug: string;
  category?: Pick<PublicCategory, "id" | "name" | "slug"> | null;
  subcategory?: { id: string; name: string; slug: string } | null;
  versions: {
    id: string;
    versionNumber: number;
    rawHtml: string;
    thumbnailHtml?: string | null;
    htmlSize: number;
    scanResult?: { fields?: TemplateField[] } | null;
  }[];
};

type CreatedEvent = {
  id: string;
  title: string;
  slug: string;
};

const CATALOG_CACHE_VERSION = 4;
const DESIGN_CATALOG_CHANGED_KEY = "nimto_design_catalog_changed";
const FAVOURITE_DESIGNS_KEY = "nimto_favourite_designs";
const RECENTLY_VIEWED_DESIGNS_KEY = "nimto_recently_viewed_designs";
const designCollections = [
  {
    key: "nepal",
    label: "Nepal events",
    terms: [
      "dashain",
      "tihar",
      "bratabandha",
      "pasni",
      "teej",
      "puja",
      "nepali",
      "mandap",
    ],
  },
  {
    key: "wedding",
    label: "Wedding",
    terms: ["wedding", "mehendi", "sangeet", "mandap"],
  },
  {
    key: "family",
    label: "Family",
    terms: ["family", "baby", "pasni", "birthday", "gathering"],
  },
  {
    key: "business",
    label: "Business",
    terms: ["business", "corporate", "opening"],
  },
  {
    key: "party",
    label: "Party",
    terms: ["party", "birthday", "house", "reunion"],
  },
] as const;

let catalogCache: {
  version: number;
  cachedAt: number;
  expiresAt: number;
  categories: PublicCategory[];
  designs: PublicDesign[];
} | null = null;

function readCatalogChangedAt() {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(DESIGN_CATALOG_CHANGED_KEY) ?? 0) || 0;
}

function readStoredList(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default function DesignsPage() {
  return (
    <UserWorkspace activePage="designs">
      {({ authHeaders, showToast }) => (
        <DesignsContent authHeaders={authHeaders} showToast={showToast} />
      )}
    </UserWorkspace>
  );
}

function DesignsContent({
  authHeaders,
  showToast,
}: {
  authHeaders: Record<string, string>;
  showToast: (message: string, tone?: "success" | "error") => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTemplateSlug = searchParams.get("template") ?? "";
  const [categories, setCategories] = useState<PublicCategory[]>(
    catalogCache?.categories ?? [],
  );
  const [designs, setDesigns] = useState<PublicDesign[]>(
    catalogCache?.designs ?? [],
  );
  const [search, setSearch] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(!catalogCache);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);
  const [previewDesign, setPreviewDesign] = useState<PublicDesign | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">(
    "desktop",
  );
  const [recentDesignId, setRecentDesignId] = useState("");
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [showFavourites, setShowFavourites] = useState(false);
  const [collectionKeys, setCollectionKeys] = useState<string[]>([]);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    setRecentDesignId(localStorage.getItem("nimto_last_used_design") ?? "");
    setFavouriteIds(readStoredList(FAVOURITE_DESIGNS_KEY));
    setRecentlyViewedIds(readStoredList(RECENTLY_VIEWED_DESIGNS_KEY));
  }, []);

  useEffect(() => {
    if (!previewDesign) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closePreview();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [previewDesign]);

  useEffect(() => {
    function closePreviewOnHistoryChange() {
      setPreviewDesign(null);
    }

    window.addEventListener("popstate", closePreviewOnHistoryChange);
    return () =>
      window.removeEventListener("popstate", closePreviewOnHistoryChange);
  }, []);

  useEffect(() => {
    let isActive = true;
    const catalogChangedAt = readCatalogChangedAt();
    if (
      catalogCache &&
      catalogCache.version === CATALOG_CACHE_VERSION &&
      catalogCache.cachedAt >= catalogChangedAt &&
      catalogCache.expiresAt > Date.now()
    ) {
      queueMicrotask(() => {
        if (!isActive || !catalogCache) return;
        setCategories(catalogCache.categories);
        setDesigns(catalogCache.designs);
        setIsLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      if (isActive) setIsLoading(true);
    });
    Promise.all([
      apiRequest<PublicCategory[]>("/template-design/public/categories"),
      apiRequest<PublicDesign[]>("/template-design/public/designs"),
    ])
      .then(([nextCategories, nextDesigns]) => {
        if (!isActive) return;
        catalogCache = {
          version: CATALOG_CACHE_VERSION,
          cachedAt: Date.now(),
          expiresAt: Date.now() + 5 * 60_000,
          categories: nextCategories,
          designs: nextDesigns,
        };
        setCategories(nextCategories);
        setDesigns(nextDesigns);
      })
      .catch((error) => {
        if (!isActive) return;
        showToast(
          error instanceof Error ? error.message : "Could not load designs.",
          "error",
        );
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [catalogRefreshKey, showToast]);

  useEffect(() => {
    function refreshCatalog(event: StorageEvent) {
      if (event.key === DESIGN_CATALOG_CHANGED_KEY) {
        catalogCache = null;
        setCatalogRefreshKey((key) => key + 1);
      }
    }

    window.addEventListener("storage", refreshCatalog);
    return () => window.removeEventListener("storage", refreshCatalog);
  }, []);

  const filteredDesigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return designs.filter((design) => {
      if (showFavourites && !favouriteIds.includes(design.id)) return false;
      const haystack = [
        design.name,
        design.slug,
        design.category?.name,
        design.category?.slug,
        design.subcategory?.name,
        design.subcategory?.slug,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesCategory = categoryIds.includes(design.category?.id ?? "");
      const matchesCollection = designCollections.some(
        (collection) =>
          collectionKeys.includes(collection.key) &&
          collection.terms.some((term) => haystack.includes(term)),
      );
      if ((categoryIds.length || collectionKeys.length) && !matchesCategory && !matchesCollection) return false;
      if (!query) return true;
      return haystack.includes(query);
    });
  }, [
    categoryIds,
    collectionKeys,
    designs,
    favouriteIds,
    search,
    showFavourites,
  ]);

  const selectedDesign = useMemo(
    () =>
      selectedTemplateSlug
        ? (designs.find(
            (design) =>
              design.slug === selectedTemplateSlug ||
              design.id === selectedTemplateSlug,
          ) ?? null)
        : null,
    [designs, selectedTemplateSlug],
  );
  function openDesignEditor(design: PublicDesign) {
    rememberViewedDesign(design.id);
    clearPreviewUrl();
    setPreviewDesign(null);
    router.push(`/designs?template=${encodeURIComponent(design.slug)}`);
  }

  function previewInvitation(design: PublicDesign) {
    rememberViewedDesign(design.id);
    const url = new URL(window.location.href);
    url.searchParams.set("preview", design.slug);
    window.history.pushState({ nimtoPreview: true }, "", url);
    setPreviewDesign(design);
  }

  function clearPreviewUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("preview")) return;
    url.searchParams.delete("preview");
    window.history.replaceState(window.history.state, "", url);
  }

  function closePreview() {
    if (new URL(window.location.href).searchParams.has("preview")) {
      window.history.back();
      return;
    }
    setPreviewDesign(null);
  }

  function rememberViewedDesign(designId: string) {
    setRecentlyViewedIds((current) => {
      const next = [designId, ...current.filter((id) => id !== designId)].slice(
        0,
        6,
      );
      localStorage.setItem(RECENTLY_VIEWED_DESIGNS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleFavourite(designId: string) {
    setFavouriteIds((current) => {
      const next = current.includes(designId)
        ? current.filter((id) => id !== designId)
        : [designId, ...current];
      localStorage.setItem(FAVOURITE_DESIGNS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function closeDesignEditor() {
    router.push("/designs");
  }

  function clearDesignFilters() {
    setSearch("");
    setCategoryIds([]);
    setCollectionKeys([]);
    setShowFavourites(false);
  }

  if (selectedDesign) {
    return (
      <DesignEditor
        authHeaders={authHeaders}
        design={selectedDesign}
        onBack={closeDesignEditor}
        showToast={showToast}
      />
    );
  }

  return (
    <section className="design-catalogue">
      <div className="user-panel design-catalogue-hero">
        <div className="design-catalogue-heading">
          <div>
            <p className="user-kicker">Invitation gallery</p>
            <h1>Choose your invitation</h1>
            <p>
              Search, filter, preview, and customize a design for your event.
            </p>
          </div>
          <div className="design-filter-toolbar">
            <label className="design-search-field">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search invitations"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search templates"
                value={search}
              />
            </label>
          </div>
        </div>
        <div className="design-discovery-bar">
            <button
              className={
                !categoryIds.length && !collectionKeys.length && !showFavourites ? "active" : ""
              }
              onClick={() => {
                setCategoryIds([]);
                setShowFavourites(false);
                setCollectionKeys([]);
              }}
              type="button"
            >
              All invitations
            </button>
            {designCollections.map((collection) => (
              <button
                className={collectionKeys.includes(collection.key) ? "active" : ""}
                key={collection.key}
                onClick={() => {
                  setCollectionKeys((current) => current.includes(collection.key)
                    ? current.filter((key) => key !== collection.key)
                    : [...current, collection.key]);
                  setShowFavourites(false);
                }}
                type="button"
              >
                {collection.label}
                {collectionKeys.includes(collection.key) ? <span>×</span> : null}
              </button>
            ))}
            {categories.slice(0, 7).map((category) => (
              <button
                className={categoryIds.includes(category.id) ? "active" : ""}
                key={category.id}
                onClick={() => {
                  setCategoryIds((current) => current.includes(category.id)
                    ? current.filter((id) => id !== category.id)
                    : [...current, category.id]);
                  setShowFavourites(false);
                }}
                type="button"
              >
                {category.name}
                {categoryIds.includes(category.id) ? <span>×</span> : null}
              </button>
            ))}
        </div>
      </div>

      <div className="design-results-heading">
        <div>
          <p className="user-kicker">Curated designs</p>
          <h2>{showFavourites ? "Saved favourites" : "Explore invitations"}</h2>
        </div>
        <div className="design-results-meta">
          <button
            aria-label="Show favourite invitations"
            className={showFavourites ? "active" : ""}
            onClick={() => {
              setCollectionKeys([]);
              setCategoryIds([]);
              setShowFavourites((value) => !value);
            }}
            type="button"
          >
            <span aria-hidden="true">♥</span>
            Favourites
            {favouriteIds.length ? <b>{favouriteIds.length}</b> : null}
          </button>
          <span>
            {filteredDesigns.length}{" "}
            {filteredDesigns.length === 1 ? "template" : "templates"}
          </span>
        </div>
      </div>

      {recentlyViewedIds.length && !search && !categoryIds.length && !collectionKeys.length && !showFavourites ? (
        <section className="recently-viewed-strip">
          <div>
            <p className="user-kicker">Recently viewed</p>
            <h2>Continue exploring</h2>
          </div>
          <div>
            {recentlyViewedIds.slice(0, 4).map((id) => {
              const design = designs.find((item) => item.id === id);
              return design ? (
                <button
                  key={id}
                  onClick={() => previewInvitation(design)}
                  type="button"
                >
                  {design.name}
                  <span>Preview again →</span>
                </button>
              ) : null;
            })}
          </div>
        </section>
      ) : null}

      <div className="user-design-grid">
        {filteredDesigns.map((design, index) => {
          const current = design.versions[0];
          const favourite = favouriteIds.includes(design.id);
          return (
            <article className="user-design-card" key={design.id}>
              <button
                className="user-design-preview"
                disabled={!current}
                onClick={() => previewInvitation(design)}
                type="button"
              >
                <div className="design-card-stage">
                  {current?.thumbnailHtml ? (
                    <iframe
                      loading="lazy"
                      sandbox=""
                      srcDoc={designCardPreviewHtml(current.thumbnailHtml)}
                      title={`${design.name} thumbnail`}
                    />
                  ) : (
                    <div
                      className={`design-thumbnail-fallback variant-${index % 4}`}
                      aria-hidden="true"
                    >
                      <span>{design.category?.name ?? "Invitation"}</span>
                      <strong>{design.name}</strong>
                      <i>Preview coming soon</i>
                    </div>
                  )}
                </div>
              </button>
              <button
                aria-label={
                  favourite
                    ? `Remove ${design.name} from favourites`
                    : `Save ${design.name} to favourites`
                }
                className={
                  favourite ? "design-favourite active" : "design-favourite"
                }
                data-tooltip={favourite ? "Remove from favourites" : "Add to favourites"}
                onClick={() => toggleFavourite(design.id)}
                type="button"
              >
                <img aria-hidden="true" src="/brand/mynimto-logo.webp" />
              </button>
              <div className="design-card-details">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-ink">
                      {design.name}
                    </h2>
                    <p className="design-category-chip">
                      {[design.category?.name, design.subcategory?.name]
                        .filter(Boolean)
                        .join(" / ") || "Uncategorized"}
                    </p>
                  </div>
                  {index < 3 ? (
                    <span className="design-popular-pill">Popular</span>
                  ) : (
                    <span className="user-version-pill">
                      v{current?.versionNumber ?? 1}
                    </span>
                  )}
                </div>
                {recentDesignId === design.id ? (
                  <span className="design-recent-pill">Recently used</span>
                ) : null}
                <div className="design-card-actions">
                  <button
                    className="user-secondary-button"
                    disabled={!current}
                    onClick={() => previewInvitation(design)}
                    type="button"
                  >
                    Preview
                  </button>
                  <button
                    className="user-primary-button"
                    disabled={!current}
                    onClick={() => openDesignEditor(design)}
                    type="button"
                  >
                    Customize
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {isLoading && !designs.length ? (
        <div
          className="invitation-card-skeletons"
          aria-label="Loading invitations"
        >
          {[1, 2, 3].map((item) => (
            <div key={item}>
              <span />
              <i />
              <b />
            </div>
          ))}
        </div>
      ) : null}
      {!isLoading && !filteredDesigns.length ? (
        <div className="user-empty">
          <h2>No invitations found</h2>
          <p>
            This collection does not have a matching design yet. Clear the
            filters to see the full catalog, including Nepal, wedding, family,
            business, and party invitations.
          </p>
          <button
            className="user-secondary-button mt-4"
            onClick={clearDesignFilters}
            type="button"
          >
            Show all invitations
          </button>
        </div>
      ) : null}
      {hasMounted && previewDesign
        ? createPortal(
            <div
              aria-modal="true"
              className="design-preview-modal-backdrop"
              onMouseDown={closePreview}
              role="dialog"
            >
              <section
                className="design-preview-modal"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header>
                  <div className="design-preview-heading">
                    <p className="user-kicker">Invitation preview</p>
                    <h2>{previewDesign.name}</h2>
                    <p>
                      {previewDesign.category?.name || "Invitation"} · Preview
                      from the beginning
                    </p>
                  </div>
                  <div className="design-preview-actions">
                    <div className="event-device-switcher">
                      {(["mobile", "desktop"] as const).map((device) => (
                        <button
                          className={previewDevice === device ? "active" : ""}
                          key={device}
                          onClick={() => setPreviewDevice(device)}
                          type="button"
                        >
                          {device}
                        </button>
                      ))}
                    </div>
                    <button
                      className="user-secondary-button"
                      onClick={closePreview}
                      type="button"
                    >
                      Close
                    </button>
                    <button
                      className="user-primary-button"
                      onClick={() => openDesignEditor(previewDesign)}
                      type="button"
                    >
                      Use invitation
                    </button>
                  </div>
                </header>
                <div className="design-preview-canvas">
                  <div className={`design-preview-stage ${previewDevice}`}>
                    <iframe
                      key={`${previewDesign.id}-${previewDevice}`}
                      onLoad={(event) =>
                        event.currentTarget.contentWindow?.scrollTo(0, 0)
                      }
                      sandbox="allow-scripts allow-same-origin"
                      srcDoc={previewDesign.versions[0]?.rawHtml ?? ""}
                      title={`${previewDesign.name} full preview`}
                    />
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

function DesignEditor({
  authHeaders,
  design,
  onBack,
  showToast,
}: {
  authHeaders: Record<string, string>;
  design: PublicDesign;
  onBack: () => void;
  showToast: (message: string, tone?: "success" | "error") => void;
}) {
  const router = useRouter();
  const current = design.versions[0];
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  const fields = useMemo(() => {
    const scannedFields = current?.scanResult?.fields ?? [];
    return scannedFields
      .map(normalizeField)
      .filter((field) => !field.locked && !field.paid);
  }, [current]);
  const inputFields = fields.filter((field) => field.required);
  const contentFields = fields.filter((field) => !field.required);
  const [activeFieldKey, setActiveFieldKey] = useState(fields[0]?.key ?? "");
  const selectedFieldKey = activeFieldKey || fields[0]?.key || "";
  const draftKey = `nimto_design_draft_${design.id}`;
  const [values, setValues] = useState<Record<string, string>>({});
  const [draftStatus, setDraftStatus] = useState("Changes save automatically");
  const [isFieldsPanelOpen, setIsFieldsPanelOpen] = useState(false);
  const [isEditorHelpOpen, setIsEditorHelpOpen] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDragStartRef = useRef<number | null>(null);
  const sheetDragYRef = useRef(0);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");
  const valuesRef = useRef(values);
  const activeFieldKeyRef = useRef(selectedFieldKey);
  const fieldsRef = useRef(fields);
  const lastSyncedActiveFieldKeyRef = useRef(selectedFieldKey);
  const previewHtml = useMemo(
    () => installPreviewFieldSync(current?.rawHtml ?? "", fields),
    [current?.rawHtml, fields],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = localStorage.getItem(draftKey);
      if (!saved) return;
      try {
        const restored = JSON.parse(saved) as Record<string, string>;
        valuesRef.current = restored;
        setValues(restored);
        setDraftStatus("Draft restored");
      } catch {
        localStorage.removeItem(draftKey);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draftKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(values));
      setDraftStatus(
        `Saved ${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftKey, values]);

  function applyPreviewFieldValue(fieldKey: string, value: string) {
    const nextValues = { ...valuesRef.current, [fieldKey]: value };
    valuesRef.current = nextValues;
    activeFieldKeyRef.current = fieldKey;
    lastSyncedActiveFieldKeyRef.current = fieldKey;
    setValues(nextValues);
    setActiveFieldKey(fieldKey);
    updatePreviewFrame(
      previewRef.current,
      nextValues,
      fieldKey,
      fieldsRef.current,
      {
        shouldScroll: false,
      },
    );
  }

  useEffect(() => {
    valuesRef.current = values;
    activeFieldKeyRef.current = selectedFieldKey;
    fieldsRef.current = fields;
    const shouldScroll =
      Boolean(selectedFieldKey) &&
      lastSyncedActiveFieldKeyRef.current !== selectedFieldKey;
    lastSyncedActiveFieldKeyRef.current = selectedFieldKey;
    updatePreviewFrame(previewRef.current, values, selectedFieldKey, fields, {
      shouldScroll,
    });
  }, [fields, selectedFieldKey, values]);

  useEffect(() => {
    function receivePreviewMessage(event: MessageEvent) {
      if (event.data?.source !== "nimto-user-preview") return;
      if (event.data.type === "selectField" && event.data.fieldKey) {
        const fieldKey = String(event.data.fieldKey);
        selectField(fieldKey);
      }
      if (event.data.type === "ready") {
        updatePreviewFrame(
          previewRef.current,
          valuesRef.current,
          activeFieldKeyRef.current,
          fieldsRef.current,
          { shouldScroll: false },
        );
        previewRef.current?.contentWindow?.scrollTo(0, 0);
      }
      if (event.data.type === "fieldValue" && event.data.fieldKey) {
        const fieldKey = String(event.data.fieldKey);
        const incomingValue = String(event.data.value ?? "");
        const field = fieldsRef.current.find((item) => item.key === fieldKey);
        if (
          !incomingValue &&
          (valuesRef.current[fieldKey] || field?.type === "date")
        )
          return;
        applyPreviewFieldValue(fieldKey, incomingValue);
      }
    }

    window.addEventListener("message", receivePreviewMessage);
    return () => {
      window.removeEventListener("message", receivePreviewMessage);
    };
  }, []);

  useEffect(() => {
    previewRef.current?.contentWindow?.scrollTo(0, 0);
  }, [device]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const updateLayout = () => {
      setIsMobileLayout(mobileQuery.matches);
      if (mobileQuery.matches) setDevice("mobile");
    };
    updateLayout();
    mobileQuery.addEventListener("change", updateLayout);
    return () => mobileQuery.removeEventListener("change", updateLayout);
  }, []);

  function updateValue(key: string, value: string) {
    setValues((currentValues) => {
      const nextValues = { ...currentValues, [key]: value };
      valuesRef.current = nextValues;
      activeFieldKeyRef.current = key;
      lastSyncedActiveFieldKeyRef.current = key;
      updatePreviewFrame(
        previewRef.current,
        nextValues,
        key,
        fieldsRef.current,
        {
          shouldScroll: false,
        },
      );
      return nextValues;
    });
  }

  function selectField(key: string) {
    activeFieldKeyRef.current = key;
    lastSyncedActiveFieldKeyRef.current = key;
    setActiveFieldKey(key);
    updatePreviewFrame(
      previewRef.current,
      valuesRef.current,
      key,
      fieldsRef.current,
      {
        shouldScroll: true,
      },
    );
  }

  function moveField(offset: number) {
    if (!fields.length) return;
    const currentIndex = Math.max(
      0,
      fields.findIndex((field) => field.key === selectedFieldKey),
    );
    const nextIndex = (currentIndex + offset + fields.length) % fields.length;
    selectField(fields[nextIndex].key);
  }

  function startSheetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    sheetDragStartRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSheetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (sheetDragStartRef.current === null) return;
    const nextDragY = Math.max(0, event.clientY - sheetDragStartRef.current);
    sheetDragYRef.current = nextDragY;
    setSheetDragY(nextDragY);
  }

  function finishSheetDrag() {
    if (sheetDragYRef.current > 80) setIsFieldsPanelOpen(false);
    sheetDragStartRef.current = null;
    sheetDragYRef.current = 0;
    setSheetDragY(0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingField = inputFields.find(
      (field) => !values[field.key]?.trim(),
    );
    if (missingField) {
      showToast(`${missingField.label} is required.`, "error");
      return;
    }

    setIsSaving(true);
    try {
      if (!current) {
        throw new Error("This design does not have a current version.");
      }

      const response = await apiRequest<CreatedEvent>("/events", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: eventTitle(design.name, values),
          type:
            design.category?.slug === "corporate"
              ? "CORPORATE"
              : design.category?.slug === "birthday"
                ? "BIRTHDAY"
                : "WEDDING",
          eventDate: dateValue(values),
          venue: fieldValue(values, [
            "venue",
            "venue_name",
            "location",
            "place",
          ]),
          description: fieldValue(values, [
            "invitation_message",
            "message",
            "description",
            "note",
          ]),
          isPublished: false,
          designVersionId: current.id,
          designFieldValues: values,
        }),
      });
      localStorage.setItem("nimto_events_changed", String(Date.now()));
      localStorage.setItem("nimto_last_used_design", design.id);
      localStorage.removeItem(draftKey);
      showToast("Your invitation draft is ready.");
      router.replace(`/events/${response.id}?created=1`);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not create event.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="user-editor">
      <div
        className="creation-progress"
        aria-label="Invitation creation progress"
      >
        {["Invitation", "Details", "Guests", "Review", "Publish"].map(
          (step, index) => (
            <div className={index === 0 ? "active" : ""} key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ),
        )}
      </div>
      <div className="user-editor-toolbar">
        <button
          className="user-secondary-button"
          onClick={onBack}
          type="button"
        >
          Back
        </button>
        <div>
          <p className="user-kicker">Create event</p>
          <h1 className="text-2xl font-black text-ink">{design.name}</h1>
          <p className="design-draft-status">{draftStatus}</p>
        </div>
        <div className="event-device-switcher">
          {(["mobile", "desktop"] as const).map((option) => (
            <button
              className={device === option ? "active" : ""}
              key={option}
              onClick={() => setDevice(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="creation-help">
        <button
          aria-expanded={isEditorHelpOpen}
          className="creation-help-toggle"
          onClick={() => setIsEditorHelpOpen((open) => !open)}
          type="button"
        >
          <span>How editing works</span>
          <span aria-hidden="true">{isEditorHelpOpen ? "−" : "+"}</span>
        </button>
        {isEditorHelpOpen ? (
          <div className="creation-confidence-strip">
            <span>Tap text in the preview or open Edit fields.</span>
            <span>Your changes save automatically on this device.</span>
            <span>Nothing is published until you review it.</span>
          </div>
        ) : null}
      </div>

      <div className="user-editor-grid">
        <div className={`user-live-preview ${device}`}>
          <iframe
            ref={previewRef}
            sandbox="allow-scripts allow-same-origin"
            srcDoc={previewHtml}
            title={`${design.name} live preview`}
            onLoad={() => {
              updatePreviewFrame(
                previewRef.current,
                values,
                selectedFieldKey,
                fields,
                {
                  shouldScroll: false,
                },
              );
              previewRef.current?.contentWindow?.scrollTo(0, 0);
              window.setTimeout(() => {
                updatePreviewFrame(
                  previewRef.current,
                  valuesRef.current,
                  activeFieldKeyRef.current,
                  fieldsRef.current,
                  { shouldScroll: false },
                );
                previewRef.current?.contentWindow?.scrollTo(0, 0);
              }, 80);
            }}
          />
        </div>

        <button
          aria-expanded={isFieldsPanelOpen}
          className="user-mobile-fields-toggle"
          onClick={() => setIsFieldsPanelOpen(true)}
          type="button"
        >
          Edit fields
        </button>
        {isFieldsPanelOpen ? (
          <button
            aria-label="Close edit fields"
            className="user-fields-backdrop"
            onClick={() => setIsFieldsPanelOpen(false)}
            type="button"
          />
        ) : null}
        <form
          className={`user-fields-panel${isFieldsPanelOpen ? " is-open" : ""}`}
          hidden={isMobileLayout && !isFieldsPanelOpen}
          onSubmit={submit}
          style={{ "--sheet-drag-y": `${sheetDragY}px` } as CSSProperties}
        >
          <button
            aria-label="Drag down to close edit fields"
            className="user-fields-drag-handle"
            onPointerCancel={finishSheetDrag}
            onPointerDown={startSheetDrag}
            onPointerMove={moveSheetDrag}
            onPointerUp={finishSheetDrag}
            type="button"
          >
            <span />
          </button>
          <div className="user-mobile-fields-header">
            <div>
              <p className="user-kicker">Invitation details</p>
              <strong>Edit fields</strong>
            </div>
            <button
              aria-label="Close edit fields"
              className="user-secondary-button"
              onClick={() => setIsFieldsPanelOpen(false)}
              type="button"
            >
              Done
            </button>
          </div>
          <div className="user-field-nav">
            <button
              className="user-secondary-button"
              disabled={!fields.length}
              onClick={() => moveField(-1)}
              type="button"
            >
              Previous
            </button>
            <span>
              {fields.length
                ? `${Math.max(
                    fields.findIndex(
                      (field) => field.key === selectedFieldKey,
                    ) + 1,
                    1,
                  )} / ${fields.length}`
                : "0 / 0"}
            </span>
            <button
              className="user-secondary-button"
              disabled={!fields.length}
              onClick={() => moveField(1)}
              type="button"
            >
              Next
            </button>
          </div>
          <FieldSection
            fields={inputFields}
            onChange={updateValue}
            onSelect={selectField}
            title="Input fields"
            values={values}
          />
          <details className="user-optional-fields">
            <summary>
              Optional invitation fields ({contentFields.length})
            </summary>
            <FieldSection
              fields={contentFields}
              onChange={updateValue}
              onSelect={selectField}
              title="Optional fields"
              values={values}
            />
          </details>
          <button
            className="user-primary-button w-full"
            disabled={isSaving || !current}
            type="submit"
          >
            {isSaving ? "Creating..." : "Create draft event"}
          </button>
        </form>
      </div>
    </section>
  );
}

function FieldSection({
  fields,
  onChange,
  onSelect,
  title,
  values,
}: {
  fields: NormalizedField[];
  onChange: (key: string, value: string) => void;
  onSelect: (key: string) => void;
  title: string;
  values: Record<string, string>;
}) {
  return (
    <section className="user-field-section">
      <h2>{title}</h2>
      {fields.length ? (
        <div className="grid gap-4">
          {fields.map((field) => (
            <label className="user-field" key={field.key}>
              <span>
                <span>{field.label}</span>
                <em>{field.inputType}</em>
                {field.required ? <b> Required</b> : null}
              </span>
              {field.control === "textarea" ? (
                <textarea
                  onChange={(event) => {
                    onChange(field.key, event.target.value);
                  }}
                  onFocus={() => onSelect(field.key)}
                  required={field.required}
                  rows={4}
                  value={values[field.key] ?? ""}
                />
              ) : (
                <input
                  onChange={(event) => {
                    onChange(field.key, event.target.value);
                  }}
                  onInput={(event) => {
                    onChange(field.key, event.currentTarget.value);
                  }}
                  onFocus={() => onSelect(field.key)}
                  required={field.required}
                  type={field.inputType}
                  value={values[field.key] ?? ""}
                />
              )}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-ink/55">
          No editable fields here.
        </p>
      )}
    </section>
  );
}

function eventTitle(designName: string, values: Record<string, string>) {
  const bride = fieldValue(values, ["bride_name", "bride"]);
  const groom = fieldValue(values, ["groom_name", "groom"]);
  if (bride && groom) return `${bride} & ${groom}`;
  return (
    fieldValue(values, [
      "event_title",
      "title",
      "couple_name",
      "names",
      "bride_groom",
      "groom_name",
      "bride_name",
    ]) || `${designName} Invitation`
  );
}

function dateValue(values: Record<string, string>) {
  const value = fieldValue(values, ["event_date", "date", "wedding_date"]);
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function fieldValue(values: Record<string, string>, keys: string[]) {
  const normalizedKeys = new Set(keys);
  const entry = Object.entries(values).find(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    return normalizedKeys.has(normalizedKey) && value.trim();
  });
  return entry?.[1].trim();
}

function normalizeField(field: TemplateField): NormalizedField {
  const rawType = field.type?.trim().toLowerCase() || "text";
  const textareaTypes = new Set([
    "textarea",
    "message",
    "longtext",
    "long_text",
    "content",
  ]);
  const supportedInputTypes = new Set([
    "date",
    "datetime-local",
    "email",
    "number",
    "tel",
    "text",
    "time",
    "url",
  ]);

  if (textareaTypes.has(rawType)) {
    return { ...field, type: rawType, inputType: "text", control: "textarea" };
  }

  const inputType = supportedInputTypes.has(rawType) ? rawType : "text";
  return { ...field, type: rawType, inputType, control: "input" };
}

function updatePreviewFrame(
  iframe: HTMLIFrameElement | null,
  values: Record<string, string>,
  selectedFieldKey: string,
  fields: NormalizedField[],
  options: { shouldScroll?: boolean } = {},
) {
  updatePreviewFrameDom(iframe, values, selectedFieldKey, fields, options);
  const message = {
    source: "nimto-user-editor",
    type: "sync",
    fields: fields.map((field) => ({ key: field.key, label: field.label })),
    values,
    selectedFieldKey,
    shouldScroll: options.shouldScroll ?? false,
  };
  iframe?.contentWindow?.postMessage(message, "*");
  window.setTimeout(() => iframe?.contentWindow?.postMessage(message, "*"), 40);
}

function updatePreviewFrameDom(
  iframe: HTMLIFrameElement | null,
  values: Record<string, string>,
  selectedFieldKey: string,
  fields: NormalizedField[],
  options: { shouldScroll?: boolean },
) {
  const document = iframe?.contentDocument;
  if (!document) return;

  document
    .querySelectorAll("[data-nimto-field], [data-nimto-label]")
    .forEach((element) => {
      element.removeAttribute("data-nimto-preview-selected");
      removePreviewHighlight(element);
    });

  fields.forEach((field) => {
    const elements = previewFieldElements(document, field);
    if (Object.prototype.hasOwnProperty.call(values, field.key)) {
      elements.forEach((element) =>
        writePreviewElementValue(element, values[field.key] ?? ""),
      );
    }
    if (field.key === selectedFieldKey) {
      const selectedElement = elements[0];
      if (selectedElement) {
        selectedElement.setAttribute("data-nimto-preview-selected", "true");
        applyPreviewHighlight(selectedElement);
      }
      if (selectedElement && options.shouldScroll) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    }
  });
}

function applyPreviewHighlight(element: Element) {
  if (!isPreviewHtmlElement(element)) return;
  stylePreviewHighlightElement(element);
}

function removePreviewHighlight(element: Element) {
  if (!isPreviewHtmlElement(element)) return;
  const highlight = element.querySelector("[data-nimto-active-highlight]");
  if (highlight) {
    element.textContent = highlight.textContent ?? "";
  }
  [
    "outline",
    "outline-offset",
    "border-radius",
    "display",
    "padding",
    "color",
    "background-color",
    "border-bottom",
    "text-shadow",
    "box-shadow",
    "-webkit-box-decoration-break",
    "box-decoration-break",
  ].forEach((property) => element.style.removeProperty(property));
}

function stylePreviewHighlightElement(element: HTMLElement) {
  element.style.setProperty("outline", "2px solid #704363", "important");
  element.style.setProperty("outline-offset", "3px", "important");
  element.style.setProperty(
    "background-color",
    "rgba(112,67,99,.10)",
    "important",
  );
}

function previewFieldElements(document: Document, field: NormalizedField) {
  const selectors = [`[data-nimto-field="${cssEscape(field.key)}"]`];
  if (field.label) {
    selectors.push(`[data-nimto-label="${cssEscape(field.label)}"]`);
  }

  const elements = new Set<Element>();
  selectors.forEach((selector) => {
    document
      .querySelectorAll(selector)
      .forEach((element) => elements.add(element));
  });
  return [...elements];
}

function writePreviewElementValue(element: Element, value: string) {
  if (isPreviewFormElement(element)) {
    element.value = value;
    element.setAttribute("value", value);
    return;
  }
  if (element.textContent !== value) element.textContent = value;
  element.setAttribute("data-nimto-preview-value", value);
}

function readPreviewElementValue(element: Element) {
  if (isPreviewFormElement(element)) {
    return element.value;
  }
  return element.textContent ?? "";
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

function isPreviewHtmlElement(element: Element): element is HTMLElement {
  const view = element.ownerDocument.defaultView;
  return Boolean(view?.HTMLElement && element instanceof view.HTMLElement);
}

function isPreviewFormElement(
  element: Element,
): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const view = element.ownerDocument.defaultView;
  return Boolean(
    (view?.HTMLInputElement && element instanceof view.HTMLInputElement) ||
    (view?.HTMLTextAreaElement &&
      element instanceof view.HTMLTextAreaElement) ||
    (view?.HTMLSelectElement && element instanceof view.HTMLSelectElement),
  );
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function installPreviewFieldSync(rawHtml: string, fields: NormalizedField[]) {
  const editableFields = JSON.stringify(
    fields.map((field) => ({ key: field.key, label: field.label })),
  ).replace(/<\/script/gi, "<\\/script");
  const script = `<script>
(() => {
  const fieldList = ${editableFields};
  const fieldsByKey = new Map(fieldList.map((field) => [field.key, field]));
  const editableKeys = new Set(fieldList.map((field) => field.key));
  const escapeSelector = (value) => {
    return window.CSS.escape(String(value));
  };
  const mergeFields = (nextFields) => {
    (nextFields || []).forEach((field) => {
      if (!field || !field.key) return;
      fieldsByKey.set(field.key, field);
      editableKeys.add(field.key);
    });
  };
  const fieldElements = (key) => {
    const field = fieldsByKey.get(key) || { key };
    const selectors = ['[data-nimto-field="' + escapeSelector(key) + '"]'];
    if (field.label) {
      selectors.push('[data-nimto-label="' + escapeSelector(field.label) + '"]');
    }
    const elements = new Set();
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => elements.add(element));
    });
    return Array.from(elements);
  };
  const fieldKeyForElement = (element) => {
    const key = element.getAttribute("data-nimto-field");
    if (key) return key;
    const label = element.getAttribute("data-nimto-label");
    return fieldList.find((field) => field.label === label)?.key || "";
  };
  const readElementValue = (element) => {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      return element.value || "";
    }
    return element.textContent || "";
  };
  const writeElementValue = (element, value) => {
    const nextValue = value == null ? "" : String(value);
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      element.value = nextValue;
      element.setAttribute("value", nextValue);
      return;
    }
    if (element.textContent !== nextValue) element.textContent = nextValue;
    element.setAttribute("data-nimto-preview-value", nextValue);
  };
  const focusEditableElement = (element) => {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      element.focus();
      if (typeof element.select === "function") element.select();
      return;
    }
    if (!(element instanceof HTMLElement)) return;
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  };
  const notifyFieldValue = (key, element) => {
    window.parent.postMessage({
      source: "nimto-user-preview",
      type: "fieldValue",
      fieldKey: key,
      value: readElementValue(element)
    }, "*");
  };
  let activeOverlay = null;
  const removeActiveOverlay = () => {
    if (!activeOverlay) return;
    activeOverlay.remove();
    activeOverlay = null;
  };
  const startOverlayEdit = (key, element) => {
    removeActiveOverlay();
    const rect = element.getBoundingClientRect();
    const computed = window.getComputedStyle(element);
    const input = document.createElement("input");
    input.type = "text";
    input.value = readElementValue(element);
    input.setAttribute("aria-label", "Edit " + key);
    input.style.position = "fixed";
    input.style.zIndex = "2147483647";
    input.style.left = Math.max(8, rect.left) + "px";
    input.style.top = Math.max(8, rect.top) + "px";
    input.style.width = Math.max(160, rect.width || 0) + "px";
    input.style.minHeight = Math.max(36, rect.height || 0) + "px";
    input.style.border = "2px solid #704363";
    input.style.borderRadius = "6px";
    input.style.background = "rgba(255,255,255,.96)";
    input.style.color = computed.color || "#2b222e";
    input.style.font = computed.font || "16px sans-serif";
    input.style.padding = "4px 8px";
    input.style.boxShadow = "0 10px 24px rgba(59,39,58,.16)";
    input.style.outline = "none";
    input.addEventListener("input", () => {
      writeElementValue(element, input.value);
      notifyFieldValue(key, element);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        notifyFieldValue(key, element);
        removeActiveOverlay();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        removeActiveOverlay();
      }
    });
    input.addEventListener("blur", () => {
      notifyFieldValue(key, element);
      removeActiveOverlay();
    });
    document.body.appendChild(input);
    activeOverlay = input;
    input.focus();
    input.select();
  };
  const stylePreviewHighlightElement = (element) => {
    if (!(element instanceof HTMLElement)) return;
    element.style.setProperty("outline", "2px solid #704363", "important");
    element.style.setProperty("outline-offset", "3px", "important");
    element.style.setProperty("background-color", "rgba(112,67,99,.10)", "important");
  };
  const applyPreviewHighlight = (element) => {
    if (!(element instanceof HTMLElement)) return;
    stylePreviewHighlightElement(element);
  };
  const removePreviewHighlight = (element) => {
    if (!(element instanceof HTMLElement)) return;
    const highlight = element.querySelector("[data-nimto-active-highlight]");
    if (highlight) {
      element.textContent = highlight.textContent || "";
    }
    ["outline","outline-offset","border-radius","display","padding","color","background-color","border-bottom","text-shadow","box-shadow","-webkit-box-decoration-break","box-decoration-break"].forEach((property) => {
      element.style.removeProperty(property);
    });
  };
  const selectField = (key, notify = true, shouldScroll = true) => {
    document
      .querySelectorAll("[data-nimto-field], [data-nimto-label]")
      .forEach((element) => {
      element.removeAttribute("data-nimto-preview-selected");
      removePreviewHighlight(element);
    });
    const element = fieldElements(key)[0];
    if (element) {
      element.setAttribute("data-nimto-preview-selected", "true");
      applyPreviewHighlight(element);
      if (shouldScroll) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }
    if (notify) {
      window.parent.postMessage({
        source: "nimto-user-preview",
        type: "selectField",
        fieldKey: key
      }, "*");
    }
  };
  const applyValues = (values, nextFields) => {
    mergeFields(nextFields);
    Object.entries(values || {}).forEach(([key, value]) => {
      fieldElements(key).forEach((element) => writeElementValue(element, value));
    });
  };
  const prepareEditableFields = () => {
    document.querySelectorAll("[data-nimto-field], [data-nimto-label]").forEach((element) => {
      const key = fieldKeyForElement(element);
      if (!key || !editableKeys.has(key)) return;
      element.setAttribute("data-nimto-user-editable", "true");
      if (
        !(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLTextAreaElement) &&
        !(element instanceof HTMLSelectElement)
      ) {
        element.setAttribute("contenteditable", "true");
      }
      element.addEventListener("click", (event) => {
        selectField(key, true, false);
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLElement
        ) {
          focusEditableElement(element);
          return;
        }
        event.preventDefault();
        startOverlayEdit(key, element);
      });
      element.addEventListener("input", () => notifyFieldValue(key, element));
      element.addEventListener("blur", () => notifyFieldValue(key, element));
      element.addEventListener("keyup", () => notifyFieldValue(key, element));
      element.addEventListener("compositionend", () => notifyFieldValue(key, element));
    });
  };
  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.source !== "nimto-user-editor" || data.type !== "sync") return;
    applyValues(data.values, data.fields);
    if (data.selectedFieldKey) {
      selectField(data.selectedFieldKey, false, data.shouldScroll !== false);
    }
  });
  const style = document.createElement("style");
  style.textContent = '[data-nimto-user-editable="true"]{cursor:text;outline-offset:3px}[data-nimto-preview-selected="true"]{outline:2px solid #704363!important;outline-offset:3px!important;background:rgba(112,67,99,.10)!important}';
  document.head.appendChild(style);
  prepareEditableFields();
  window.parent.postMessage({ source: "nimto-user-preview", type: "ready" }, "*");
})();
</script>`;

  if (/<\/body>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/body>/i, `${script}</body>`);
  }
  return `${rawHtml}${script}`;
}
