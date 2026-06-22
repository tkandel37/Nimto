"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
    htmlSize: number;
    scanResult?: { fields?: TemplateField[] } | null;
  }[];
};

type CreatedEvent = {
  id: string;
  title: string;
  slug: string;
};

const CATALOG_CACHE_VERSION = 2;
const DESIGN_CATALOG_CHANGED_KEY = "nimto_design_catalog_changed";

let catalogCache:
  | {
      version: number;
      cachedAt: number;
      expiresAt: number;
      categories: PublicCategory[];
      designs: PublicDesign[];
    }
  | null = null;

function readCatalogChangedAt() {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(DESIGN_CATALOG_CHANGED_KEY) ?? 0) || 0;
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
  const [designs, setDesigns] = useState<PublicDesign[]>(catalogCache?.designs ?? []);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [isLoading, setIsLoading] = useState(!catalogCache);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);

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

  const subcategories = useMemo(
    () =>
      categories.find((category) => category.id === categoryId)?.subcategories ??
      [],
    [categories, categoryId],
  );

  const filteredDesigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return designs.filter((design) => {
      if (categoryId && design.category?.id !== categoryId) return false;
      if (subcategoryId && design.subcategory?.id !== subcategoryId) return false;
      if (!query) return true;
      return (
        design.name.toLowerCase().includes(query) ||
        design.slug.toLowerCase().includes(query)
      );
    });
  }, [categoryId, designs, search, subcategoryId]);

  const selectedDesign = useMemo(
    () =>
      selectedTemplateSlug
        ? designs.find(
            (design) =>
              design.slug === selectedTemplateSlug || design.id === selectedTemplateSlug,
          ) ?? null
        : null,
    [designs, selectedTemplateSlug],
  );

  function openDesignEditor(design: PublicDesign) {
    router.push(`/designs?template=${encodeURIComponent(design.slug)}`);
  }

  function closeDesignEditor() {
    router.push("/designs");
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
    <section className="grid gap-5">
      <div className="user-panel">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="user-kicker">Designs</p>
            <h1 className="mt-2 text-3xl font-black text-ink">
              Pick an invitation design
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/60">
              Browse published designs, preview the actual HTML, and create a
              private event copy from the one you select.
            </p>
          </div>
          <div className="user-filter-row">
            <input
              aria-label="Search designs"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search designs"
              value={search}
            />
            <select
              aria-label="Filter category"
              onChange={(event) => {
                setCategoryId(event.target.value);
                setSubcategoryId("");
              }}
              value={categoryId}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter subcategory"
              disabled={!categoryId}
              onChange={(event) => setSubcategoryId(event.target.value)}
              value={subcategoryId}
            >
              <option value="">All subcategories</option>
              {subcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="user-design-grid">
        {filteredDesigns.map((design) => {
          const current = design.versions[0];
          return (
            <article className="user-design-card" key={design.id}>
              <div className="user-design-preview">
                <iframe
                  loading="lazy"
                  sandbox="allow-scripts"
                  srcDoc={current?.rawHtml ?? ""}
                  title={`${design.name} preview`}
                />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-ink">
                      {design.name}
                    </h2>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-ink/45">
                      {[design.category?.name, design.subcategory?.name]
                        .filter(Boolean)
                        .join(" / ") || "Uncategorized"}
                    </p>
                  </div>
                  <span className="user-version-pill">
                    v{current?.versionNumber ?? 1}
                  </span>
                </div>
                <button
                  className="user-primary-button mt-5 w-full"
                  disabled={!current}
                  onClick={() => openDesignEditor(design)}
                  type="button"
                >
                  Use this design
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {isLoading ? <p className="user-empty">Loading designs...</p> : null}
      {!isLoading && !filteredDesigns.length ? (
        <div className="user-empty">
          <h2>No designs found</h2>
          <p>Try another category, subcategory, or search term.</p>
        </div>
      ) : null}
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
  const [previewEditFieldKey, setPreviewEditFieldKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const valuesRef = useRef(values);
  const activeFieldKeyRef = useRef(selectedFieldKey);
  const fieldsRef = useRef(fields);
  const lastSyncedActiveFieldKeyRef = useRef(selectedFieldKey);
  const previewEditorInputRef = useRef<HTMLInputElement | null>(null);
  const previewEditField = fields.find((field) => field.key === previewEditFieldKey);
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
    updatePreviewFrame(previewRef.current, nextValues, fieldKey, fieldsRef.current, {
      shouldScroll: false,
    });
    bindPreviewFrameEditing(
      previewRef.current,
      fieldsRef.current,
      applyPreviewFieldValue,
      selectField,
      openPreviewValueEditor,
    );
  }

  function openPreviewValueEditor(fieldKey: string) {
    setPreviewEditFieldKey(fieldKey);
    const frameDocument = previewRef.current?.contentDocument;
    const field = fieldsRef.current.find((candidate) => candidate.key === fieldKey);
    if (!frameDocument || !field) return;

    const element = previewFieldElements(frameDocument, field)[0];
    if (!element) return;
    const initialValue = readPreviewElementValue(element).trim();
    if (!Object.prototype.hasOwnProperty.call(valuesRef.current, fieldKey)) {
      applyPreviewFieldValue(fieldKey, initialValue);
    }
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
    bindPreviewFrameEditing(
      previewRef.current,
      fields,
      applyPreviewFieldValue,
      selectField,
      openPreviewValueEditor,
    );
  }, [fields, selectedFieldKey, values]);

  useEffect(() => {
    if (!previewEditFieldKey) return;
    previewEditorInputRef.current?.focus();
    previewEditorInputRef.current?.select();
  }, [previewEditFieldKey]);

  useEffect(() => {
    function receivePreviewMessage(event: MessageEvent) {
      if (event.data?.source !== "nimto-user-preview") return;
      if (event.data.type === "selectField" && event.data.fieldKey) {
        const fieldKey = String(event.data.fieldKey);
        selectField(fieldKey);
        window.setTimeout(() => openPreviewValueEditor(fieldKey), 0);
      }
      if (event.data.type === "ready") {
        updatePreviewFrame(
          previewRef.current,
          valuesRef.current,
          activeFieldKeyRef.current,
          fieldsRef.current,
          { shouldScroll: true },
        );
      }
      if (event.data.type === "fieldValue" && event.data.fieldKey) {
        const fieldKey = String(event.data.fieldKey);
        const incomingValue = String(event.data.value ?? "");
        const field = fieldsRef.current.find((item) => item.key === fieldKey);
        if (!incomingValue && (valuesRef.current[fieldKey] || field?.type === "date"))
          return;
        applyPreviewFieldValue(fieldKey, incomingValue);
      }
    }

    window.addEventListener("message", receivePreviewMessage);
    return () => {
      window.removeEventListener("message", receivePreviewMessage);
    };
  }, []);

  function updateValue(key: string, value: string) {
    setValues((currentValues) => {
      const nextValues = { ...currentValues, [key]: value };
      valuesRef.current = nextValues;
      activeFieldKeyRef.current = key;
      lastSyncedActiveFieldKeyRef.current = key;
      updatePreviewFrame(previewRef.current, nextValues, key, fieldsRef.current, {
        shouldScroll: false,
      });
      return nextValues;
    });
  }

  function selectField(key: string) {
    activeFieldKeyRef.current = key;
    lastSyncedActiveFieldKeyRef.current = key;
    setActiveFieldKey(key);
    updatePreviewFrame(previewRef.current, valuesRef.current, key, fieldsRef.current, {
      shouldScroll: true,
    });
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingField = inputFields.find((field) => !values[field.key]?.trim());
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
          type: "WEDDING",
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
          isPublished: true,
          designVersionId: current.id,
          designFieldValues: values,
        }),
      });
      localStorage.setItem("nimto_events_changed", String(Date.now()));
      localStorage.removeItem(draftKey);
      showToast("Event created and ready to share.");
      router.replace(`/events/${response.id}`);
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
      <div className="user-editor-toolbar">
        <button className="user-secondary-button" onClick={onBack} type="button">
          Back
        </button>
        <div>
          <p className="user-kicker">Create event</p>
          <h1 className="text-2xl font-black text-ink">{design.name}</h1>
          <p className="design-draft-status">{draftStatus}</p>
        </div>
      </div>

      <div className="user-editor-grid">
        <div className="user-live-preview">
          <iframe
            ref={previewRef}
            sandbox="allow-scripts allow-same-origin"
            srcDoc={previewHtml}
            title={`${design.name} live preview`}
            onLoad={() => {
              updatePreviewFrame(previewRef.current, values, selectedFieldKey, fields, {
                shouldScroll: true,
              });
              bindPreviewFrameEditing(
                previewRef.current,
                fields,
                applyPreviewFieldValue,
                selectField,
                openPreviewValueEditor,
              );
              window.setTimeout(
                () => {
                  updatePreviewFrame(
                    previewRef.current,
                    valuesRef.current,
                    activeFieldKeyRef.current,
                    fieldsRef.current,
                    { shouldScroll: true },
                  );
                  bindPreviewFrameEditing(
                    previewRef.current,
                    fieldsRef.current,
                    applyPreviewFieldValue,
                    selectField,
                    openPreviewValueEditor,
                  );
                },
                80,
              );
            }}
          />
          {previewEditField ? (
            <div className="user-preview-inline-editor">
              <label>
                <span>{previewEditField.label}</span>
                <input
                  ref={previewEditorInputRef}
                  onChange={(event) =>
                    applyPreviewFieldValue(previewEditField.key, event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === "Escape") {
                      event.preventDefault();
                      setPreviewEditFieldKey("");
                    }
                  }}
                  value={values[previewEditField.key] ?? ""}
                />
              </label>
              <button
                aria-label="Close preview editor"
                onClick={() => setPreviewEditFieldKey("")}
                type="button"
              >
                Done
              </button>
            </div>
          ) : null}
        </div>

        <form className="user-fields-panel" onSubmit={submit}>
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
                    fields.findIndex((field) => field.key === selectedFieldKey) + 1,
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
          <FieldSection
            fields={contentFields}
            onChange={updateValue}
            onSelect={selectField}
            title="Content fields"
            values={values}
          />
          <button
            className="user-primary-button w-full"
            disabled={isSaving || !current}
            type="submit"
          >
            {isSaving ? "Creating..." : "Create shareable event"}
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
        <p className="text-sm leading-6 text-ink/55">No editable fields here.</p>
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

function bindPreviewFrameEditing(
  iframe: HTMLIFrameElement | null,
  fields: NormalizedField[],
  onValue: (key: string, value: string) => void,
  onSelect: (key: string) => void,
  onOpenEditor: (key: string) => void,
) {
  const document = iframe?.contentDocument;
  if (!document) return;

  fields.forEach((field) => {
    previewFieldElements(document, field).forEach((element) => {
      element.setAttribute("data-nimto-user-editable", "true");
      if (!isPreviewFormElement(element) && isPreviewHtmlElement(element)) {
        element.setAttribute("contenteditable", "true");
      }
      if (element.getAttribute("data-nimto-user-edit-bound") === "true") return;
      element.setAttribute("data-nimto-user-edit-bound", "true");

      const startSvgEdit = (event: Event) => {
        if (isPreviewFormElement(element) || isPreviewHtmlElement(element)) return;
        event.preventDefault();
        event.stopPropagation();
        onSelect(field.key);
        onOpenEditor(field.key);
      };

      element.addEventListener("pointerdown", startSvgEdit, true);
      element.addEventListener("click", (event) => {
        onSelect(field.key);
        if (isPreviewFormElement(element)) {
          focusPreviewEditableElement(element);
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onOpenEditor(field.key);
      });

      ["input", "blur", "keyup", "compositionend"].forEach((eventName) => {
        element.addEventListener(eventName, () => {
          onValue(field.key, readPreviewElementValue(element));
        });
      });
    });
  });
}

function focusPreviewEditableElement(element: Element) {
  if (isPreviewFormElement(element)) {
    element.focus();
    if ("select" in element && typeof element.select === "function") {
      element.select();
    }
    return;
  }
  if (!isPreviewHtmlElement(element)) return;
  element.focus();
  const document = element.ownerDocument;
  const selection = document.defaultView?.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
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
  element.style.setProperty("outline", "2px solid #3f8f5f", "important");
  element.style.setProperty("outline-offset", "3px", "important");
  element.style.setProperty("background-color", "rgba(63,143,95,.10)", "important");
}

function previewFieldElements(document: Document, field: NormalizedField) {
  const selectors = [`[data-nimto-field="${cssEscape(field.key)}"]`];
  if (field.label) {
    selectors.push(`[data-nimto-label="${cssEscape(field.label)}"]`);
  }

  const elements = new Set<Element>();
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => elements.add(element));
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
      (view?.HTMLTextAreaElement && element instanceof view.HTMLTextAreaElement) ||
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
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
    return String(value).replace(/"/g, "\\\\\"");
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
    input.style.border = "2px solid #3f8f5f";
    input.style.borderRadius = "6px";
    input.style.background = "rgba(255,255,255,.96)";
    input.style.color = computed.color || "#172033";
    input.style.font = computed.font || "16px sans-serif";
    input.style.padding = "4px 8px";
    input.style.boxShadow = "0 10px 24px rgba(23,32,51,.18)";
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
    element.style.setProperty("outline", "2px solid #3f8f5f", "important");
    element.style.setProperty("outline-offset", "3px", "important");
    element.style.setProperty("background-color", "rgba(63,143,95,.10)", "important");
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
  style.textContent = '[data-nimto-user-editable="true"]{cursor:text;outline-offset:3px}[data-nimto-preview-selected="true"]{outline:2px solid #3f8f5f!important;outline-offset:3px!important;background:rgba(63,143,95,.10)!important}';
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
