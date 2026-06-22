"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { EventDesignRevision, UserEvent } from "./event-types";

type PublicDesign = {
  id: string;
  name: string;
  versions: {
    id: string;
    rawHtml: string;
    scanResult?: UserEvent["designVersion"] extends infer T
      ? T extends { scanResult?: infer S }
        ? S
        : never
      : never;
  }[];
};

export function EventDesignEditor({
  authHeaders,
  designs,
  event,
  onEvent,
  onRevisions,
  revisions,
  showToast,
}: {
  authHeaders: Record<string, string>;
  designs: PublicDesign[];
  event: UserEvent;
  onEvent: (event: UserEvent) => void;
  onRevisions: (revisions: EventDesignRevision[]) => void;
  revisions: EventDesignRevision[];
  showToast: (message: string, tone?: "success" | "error") => void;
}) {
  const initialVersion =
    event.draftDesignVersion ?? event.designVersion ?? designs[0]?.versions[0];
  const [versionId, setVersionId] = useState(initialVersion?.id ?? "");
  const version =
    designs
      .flatMap((design) => design.versions)
      .find((item) => item.id === versionId) ?? initialVersion;
  const fields = useMemo(
    () =>
      (version?.scanResult?.fields ?? []).filter(
        (field) => !field.locked && !field.paid,
      ),
    [version],
  );
  const requiredFields = fields.filter((field) => field.required);
  const optionalFields = fields.filter((field) => !field.required);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(
        event.draftDesignFieldValues ?? event.designFieldValues ?? {},
      ).map(([key, value]) => [key, String(value ?? "")]),
    ),
  );
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">(
    "desktop",
  );
  const [saving, setSaving] = useState(false);
  const [connectionState, setConnectionState] = useState("Online");
  const previewHtml = useMemo(
    () => applyValues(version?.rawHtml ?? "", values),
    [values, version?.rawHtml],
  );
  const accessibilityWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!/<html/i.test(version?.rawHtml ?? ""))
      warnings.push("HTML document wrapper is missing.");
    if (/<img\b(?![^>]*\balt=)/i.test(version?.rawHtml ?? ""))
      warnings.push("One or more images are missing alternative text.");
    if (/font-size\s*:\s*(?:[0-9]|1[01])px/i.test(version?.rawHtml ?? ""))
      warnings.push("Very small text may be difficult to read.");
    if (!/viewport/i.test(version?.rawHtml ?? ""))
      warnings.push("A mobile viewport declaration was not detected.");
    return warnings;
  }, [version?.rawHtml]);

  useEffect(() => {
    const key = `nimto_event_design_draft_${event.id}`;
    const frame = window.requestAnimationFrame(() => {
      const saved = localStorage.getItem(key);
      setConnectionState(
        navigator.onLine ? "Online" : "Offline — draft is safe here",
      );
      if (saved) {
        try {
          const draft = JSON.parse(saved) as {
            versionId: string;
            values: Record<string, string>;
          };
          setVersionId(draft.versionId);
          setValues(draft.values);
        } catch {
          localStorage.removeItem(key);
        }
      }
    });
    const online = () => setConnectionState("Online");
    const offline = () => setConnectionState("Offline — draft is safe here");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [event.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(
        `nimto_event_design_draft_${event.id}`,
        JSON.stringify({ versionId, values }),
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [event.id, values, versionId]);

  async function saveDraft() {
    if (!version) return;
    setSaving(true);
    try {
      const updated = await apiRequest<UserEvent>(
        `/events/${event.id}/design-draft`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            designVersionId: version.id,
            designFieldValues: values,
          }),
        },
      );
      onEvent({ ...event, ...updated });
      localStorage.removeItem(`nimto_event_design_draft_${event.id}`);
      showToast("Design draft saved. Guests still see the published version.");
    } finally {
      setSaving(false);
    }
  }

  async function restore(revision: EventDesignRevision) {
    const updated = await apiRequest<UserEvent>(
      `/events/${event.id}/design-revisions/${revision.id}/restore`,
      { method: "POST", headers: authHeaders },
    );
    setVersionId(revision.designVersion.id);
    setValues(
      Object.fromEntries(
        Object.entries(revision.fieldValues).map(([key, value]) => [
          key,
          String(value ?? ""),
        ]),
      ),
    );
    onEvent({ ...event, ...updated });
    showToast("Older design restored as an unpublished draft.");
  }

  return (
    <section className="user-panel event-design-editor">
      <div className="event-section-heading">
        <div>
          <p className="user-kicker">Invitation</p>
          <h2>Edit safely, then review</h2>
          <p>
            Draft changes are private. Use the main Publish button when the
            preview is ready.
          </p>
          <p className="design-draft-status">{connectionState}</p>
        </div>
        <div className="event-header-actions">
          <button
            className="user-secondary-button"
            disabled={saving}
            onClick={() => void saveDraft()}
            type="button"
          >
            Save draft
          </button>
        </div>
      </div>

      <div className="event-design-layout">
        <div className="event-design-controls">
          <label className="user-field">
            <span>Design</span>
            <select
              onChange={(changeEvent) => setVersionId(changeEvent.target.value)}
              value={versionId}
            >
              {designs.map((design) => (
                <option key={design.id} value={design.versions[0]?.id}>
                  {design.name}
                </option>
              ))}
            </select>
          </label>
          {requiredFields.map((field) => (
            <label className="user-field" key={field.key}>
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <input
                onChange={(changeEvent) =>
                  setValues((current) => ({
                    ...current,
                    [field.key]: changeEvent.target.value,
                  }))
                }
                type={field.type === "date" ? "date" : "text"}
                value={values[field.key] ?? ""}
              />
            </label>
          ))}
          {optionalFields.length ? (
            <details className="event-optional-fields">
              <summary>Optional fields ({optionalFields.length})</summary>
              <div>
                {optionalFields.map((field) => (
                  <label className="user-field" key={field.key}>
                    <span>{field.label}</span>
                    <input
                      onChange={(changeEvent) =>
                        setValues((current) => ({
                          ...current,
                          [field.key]: changeEvent.target.value,
                        }))
                      }
                      type={field.type === "date" ? "date" : "text"}
                      value={values[field.key] ?? ""}
                    />
                  </label>
                ))}
              </div>
            </details>
          ) : null}
          <div className="event-accessibility-check">
            <strong>Readiness and accessibility</strong>
            {accessibilityWarnings.length ? (
              accessibilityWarnings.map((warning) => (
                <p key={warning}>⚠ {warning}</p>
              ))
            ) : (
              <p>✓ No obvious invitation accessibility problems detected.</p>
            )}
          </div>
          <div className="event-revision-list">
            <strong>Published history</strong>
            {revisions.map((revision) => (
              <div key={revision.id}>
                <span>
                  {revision.label ??
                    `Version ${revision.designVersion.versionNumber}`}
                </span>
                <button onClick={() => void restore(revision)} type="button">
                  Restore as draft
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="event-device-switcher">
            {(["mobile", "tablet", "desktop"] as const).map((option) => (
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
          <div className={`event-device-preview ${device}`}>
            <iframe
              sandbox="allow-scripts"
              srcDoc={previewHtml}
              title="Invitation design draft preview"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function applyValues(html: string, values: Record<string, string>) {
  return Object.entries(values).reduce((result, [key, value]) => {
    const pattern = new RegExp(
      `(<[^>]*data-nimto-field=(["'])${escapeRegExp(key)}\\2[^>]*>)(.*?)(<\\/[^>]+>)`,
      "gis",
    );
    return result.replace(pattern, `$1${escapeHtml(value)}$4`);
  }, html);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
