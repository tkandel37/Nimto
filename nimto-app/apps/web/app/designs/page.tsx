"use client";

import Link from "next/link";
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

let catalogCache:
  | {
      version: number;
      expiresAt: number;
      categories: PublicCategory[];
      designs: PublicDesign[];
    }
  | null = null;

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
  const [categories, setCategories] = useState<PublicCategory[]>(
    catalogCache?.categories ?? [],
  );
  const [designs, setDesigns] = useState<PublicDesign[]>(catalogCache?.designs ?? []);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [selectedDesign, setSelectedDesign] = useState<PublicDesign | null>(null);
  const [isLoading, setIsLoading] = useState(!catalogCache);

  useEffect(() => {
    let isActive = true;
    if (
      catalogCache &&
      catalogCache.version === CATALOG_CACHE_VERSION &&
      catalogCache.expiresAt > Date.now()
    ) {
      setCategories(catalogCache.categories);
      setDesigns(catalogCache.designs);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    Promise.all([
      apiRequest<PublicCategory[]>("/template-design/public/categories"),
      apiRequest<PublicDesign[]>("/template-design/public/designs"),
    ])
      .then(([nextCategories, nextDesigns]) => {
        if (!isActive) return;
        catalogCache = {
          version: CATALOG_CACHE_VERSION,
          expiresAt: Date.now() + 60_000,
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
  }, [showToast]);

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

  if (selectedDesign) {
    return (
      <DesignEditor
        authHeaders={authHeaders}
        design={selectedDesign}
        onBack={() => setSelectedDesign(null)}
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
                  onClick={() => setSelectedDesign(design)}
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
  const [values, setValues] = useState<Record<string, string>>({});
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const previewHtml = useMemo(
    () => installPreviewFieldSync(current?.rawHtml ?? "", fields),
    [current?.rawHtml, fields],
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    updatePreviewFrame(previewRef.current, values, activeFieldKey);
  }, [activeFieldKey, values]);

  useEffect(() => {
    if (activeFieldKey || !fields[0]) return;
    setActiveFieldKey(fields[0].key);
  }, [activeFieldKey, fields]);

  useEffect(() => {
    function receivePreviewMessage(event: MessageEvent) {
      if (event.data?.source !== "nimto-user-preview") return;
      if (event.data.type === "selectField" && event.data.fieldKey) {
        selectField(event.data.fieldKey);
      }
      if (event.data.type === "fieldValue" && event.data.fieldKey) {
        setValues((currentValues) => ({
          ...currentValues,
          [event.data.fieldKey]: String(event.data.value ?? ""),
        }));
      }
    }

    window.addEventListener("message", receivePreviewMessage);
    return () => window.removeEventListener("message", receivePreviewMessage);
  }, []);

  function updateValue(key: string, value: string) {
    setValues((currentValues) => ({ ...currentValues, [key]: value }));
  }

  function selectField(key: string) {
    setActiveFieldKey(key);
  }

  function moveField(offset: number) {
    if (!fields.length) return;
    const currentIndex = Math.max(
      0,
      fields.findIndex((field) => field.key === activeFieldKey),
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
          venue: fieldValue(values, ["venue", "location", "place"]),
          description: fieldValue(values, ["message", "description", "note"]),
          isPublished: true,
          designVersionId: current.id,
          designFieldValues: values,
        }),
      });
      setCreatedEvent(response);
      localStorage.setItem("nimto_events_changed", String(Date.now()));
      showToast("Event created and ready to share.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not create event.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function copyShareLink() {
    if (!createdEvent || !origin) return;
    await navigator.clipboard.writeText(`${origin}/invite/${createdEvent.slug}`);
    showToast("Share link copied.");
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
        </div>
      </div>

      <div className="user-editor-grid">
        <div className="user-live-preview">
          <iframe
            ref={previewRef}
            sandbox="allow-scripts"
            srcDoc={previewHtml}
            title={`${design.name} live preview`}
            onLoad={() => {
              updatePreviewFrame(previewRef.current, values, activeFieldKey);
              window.setTimeout(
                () =>
                  updatePreviewFrame(previewRef.current, values, activeFieldKey),
                80,
              );
            }}
          />
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
                    fields.findIndex((field) => field.key === activeFieldKey) + 1,
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
          {createdEvent ? (
            <div className="user-share-box">
              <strong>{createdEvent.title}</strong>
              <p>{`${origin}/invite/${createdEvent.slug}`}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="user-secondary-button"
                  onClick={copyShareLink}
                  type="button"
                >
                  Copy link
                </button>
                <Link
                  className="user-secondary-button"
                  href={`/invite/${createdEvent.slug}`}
                  target="_blank"
                >
                  Open preview
                </Link>
              </div>
            </div>
          ) : null}
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
                    onSelect(field.key);
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
                    onSelect(field.key);
                    onChange(field.key, event.target.value);
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
  const textareaTypes = new Set(["textarea", "message", "longtext", "content"]);
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
) {
  const message = {
    source: "nimto-user-editor",
    type: "sync",
    values,
    selectedFieldKey,
  };
  iframe?.contentWindow?.postMessage(message, "*");
  window.setTimeout(() => iframe?.contentWindow?.postMessage(message, "*"), 40);
}

function installPreviewFieldSync(rawHtml: string, fields: NormalizedField[]) {
  const editableKeys = JSON.stringify(fields.map((field) => field.key)).replace(
    /<\/script/gi,
    "<\\/script",
  );
  const script = `<script>
(() => {
  const editableKeys = new Set(${editableKeys});
  const escapeSelector = (value) => {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(value);
    return String(value).replace(/"/g, "\\\\\"");
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
  };
  const selectField = (key, notify = true, shouldScroll = true) => {
    document.querySelectorAll("[data-nimto-field]").forEach((element) => {
      element.removeAttribute("data-nimto-preview-selected");
    });
    const element = document.querySelector('[data-nimto-field="' + escapeSelector(key) + '"]');
    if (element) {
      element.setAttribute("data-nimto-preview-selected", "true");
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
  const applyValues = (values) => {
    Object.entries(values || {}).forEach(([key, value]) => {
      document
        .querySelectorAll('[data-nimto-field="' + escapeSelector(key) + '"]')
        .forEach((element) => writeElementValue(element, value));
    });
  };
  const prepareEditableFields = () => {
    document.querySelectorAll("[data-nimto-field]").forEach((element) => {
      const key = element.getAttribute("data-nimto-field");
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
        event.preventDefault();
        selectField(key, true, false);
      });
      element.addEventListener("input", () => {
        window.parent.postMessage({
          source: "nimto-user-preview",
          type: "fieldValue",
          fieldKey: key,
          value: readElementValue(element)
        }, "*");
      });
    });
  };
  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.source !== "nimto-user-editor" || data.type !== "sync") return;
    applyValues(data.values);
    if (data.selectedFieldKey) selectField(data.selectedFieldKey, false, true);
  });
  const style = document.createElement("style");
  style.textContent = '[data-nimto-user-editable="true"]{cursor:text;outline-offset:3px}[data-nimto-field][data-nimto-preview-selected="true"]{outline:2px solid #16745e!important;background:rgba(22,116,94,.12)!important;box-shadow:0 0 0 6px rgba(22,116,94,.08)!important}';
  document.head.appendChild(style);
  prepareEditableFields();
})();
</script>`;

  if (/<\/body>/i.test(rawHtml)) {
    return rawHtml.replace(/<\/body>/i, `${script}</body>`);
  }
  return `${rawHtml}${script}`;
}
