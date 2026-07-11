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
    featureConfig?: InvitationFeatureConfig | null;
    scanResult?: UserEvent["designVersion"] extends infer T
      ? T extends { scanResult?: infer S }
        ? S
        : never
      : never;
  }[];
};

type InvitationFeatureConfig = {
  countdown?: FeatureToggle & { position?: "top" | "middle" | "bottom" };
  rsvp?: FeatureToggle;
  music?: FeatureToggle;
  additionalInfo?: FeatureToggle;
  openingAnimation?: FeatureToggle;
  theme?: FeatureToggle;
  sharePreview?: FeatureToggle;
  print?: FeatureToggle;
  links?: FeatureToggle;
};

type FeatureToggle = {
  available?: boolean;
  defaultEnabled?: boolean;
};

type StyleSlot = {
  key: string;
  label?: string;
  type?: string;
  defaultValue?: string;
};

type LinkSetting = {
  fieldKey: string;
  url: string;
};

type EventFeatureSettings = {
  countdown?: { enabled?: boolean };
  rsvp?: { enabled?: boolean };
  music?: { enabled?: boolean; url?: string };
  additionalInfo?: { enabled?: boolean; text?: string };
  openingAnimation?: { enabled?: boolean };
  links?: LinkSetting[];
  theme?: Record<string, string>;
  sharePreview?: {
    title?: string;
    description?: string;
    imageUrl?: string;
  };
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
  const featureConfig = useMemo(
    () => normalizeFeatureConfig(version?.featureConfig),
    [version?.featureConfig],
  );
  const styleSlots = useMemo(
    () => (version?.scanResult?.styleSlots ?? []) as StyleSlot[],
    [version?.scanResult?.styleSlots],
  );
  const linkableFields = useMemo(() => {
    const keys = new Set(version?.scanResult?.linkableFieldKeys ?? []);
    return fields.filter((field) => keys.has(field.key));
  }, [fields, version?.scanResult?.linkableFieldKeys]);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(
        event.draftDesignFieldValues ?? event.designFieldValues ?? {},
      ).map(([key, value]) => [key, String(value ?? "")]),
    ),
  );
  const [featureSettings, setFeatureSettings] = useState<EventFeatureSettings>(
    () =>
      initialFeatureSettings(event.featureSettings, featureConfig, styleSlots),
  );
  const selectedLinkFields = new Set(
    (featureSettings.links ?? []).map((link) => link.fieldKey),
  );
  const [device, setDevice] = useState<"mobile" | "tablet" | "desktop">(
    "desktop",
  );
  const [saving, setSaving] = useState(false);
  const [connectionState, setConnectionState] = useState("Online");
  const [draftStatus, setDraftStatus] = useState("No unsaved changes");
  const previewHtml = useMemo(
    () =>
      applyFeaturePreview(
        applyValues(version?.rawHtml ?? "", values),
        featureSettings,
        featureConfig,
        fields,
      ),
    [featureConfig, featureSettings, fields, values, version?.rawHtml],
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
            featureSettings?: EventFeatureSettings;
          };
          setVersionId(draft.versionId);
          setValues(draft.values);
          if (draft.featureSettings) setFeatureSettings(draft.featureSettings);
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
        JSON.stringify({ versionId, values, featureSettings }),
      );
      setDraftStatus("Saved locally just now");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [event.id, featureSettings, values, versionId]);

  useEffect(() => {
    setFeatureSettings((current) =>
      normalizeFeatureSettings(current, featureConfig, styleSlots),
    );
  }, [featureConfig, styleSlots]);

  function updateFieldValue(fieldKey: string, value: string) {
    setDraftStatus("Unsaved changes");
    setValues((current) => ({
      ...current,
      [fieldKey]: value,
    }));
  }

  function updateFeatureSettings(
    updater: (current: EventFeatureSettings) => EventFeatureSettings,
  ) {
    setDraftStatus("Unsaved changes");
    setFeatureSettings((current) =>
      normalizeFeatureSettings(updater(current), featureConfig, styleSlots),
    );
  }

  function addLinkSetting() {
    const nextField = linkableFields.find(
      (field) => !selectedLinkFields.has(field.key),
    );
    if (!nextField) return;
    updateFeatureSettings((current) => ({
      ...current,
      links: [...(current.links ?? []), { fieldKey: nextField.key, url: "" }],
    }));
  }

  function updateLinkSetting(index: number, patch: Partial<LinkSetting>) {
    updateFeatureSettings((current) => ({
      ...current,
      links: (current.links ?? []).map((link, itemIndex) =>
        itemIndex === index ? { ...link, ...patch } : link,
      ),
    }));
  }

  function removeLinkSetting(index: number) {
    updateFeatureSettings((current) => ({
      ...current,
      links: (current.links ?? []).filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  }

  function testMusic() {
    const url = featureSettings.music?.url?.trim();
    if (!url) {
      showToast("Add a music URL first.", "error");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => {
      showToast("Music opened in a new tab. If it plays, this URL is usable.");
    }, 1200);
  }

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
            featureSettings,
          }),
        },
      );
      onEvent({ ...event, ...updated });
      localStorage.removeItem(`nimto_event_design_draft_${event.id}`);
      setDraftStatus("Saved to event draft");
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
    setDraftStatus("Restored as an unpublished draft");
    setValues(
      Object.fromEntries(
        Object.entries(revision.fieldValues).map(([key, value]) => [
          key,
          String(value ?? ""),
        ]),
      ),
    );
    setFeatureSettings(
      initialFeatureSettings(
        updated.featureSettings,
        featureConfig,
        styleSlots,
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
          <p className="design-draft-status">
            {connectionState} · {draftStatus}
          </p>
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
              onChange={(changeEvent) => {
                setDraftStatus("Unsaved changes");
                setVersionId(changeEvent.target.value);
              }}
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
                  updateFieldValue(field.key, changeEvent.target.value)
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
                        updateFieldValue(field.key, changeEvent.target.value)
                      }
                      type={field.type === "date" ? "date" : "text"}
                      value={values[field.key] ?? ""}
                    />
                  </label>
                ))}
              </div>
            </details>
          ) : null}
          <div className="event-feature-setup">
            <div>
              <strong>Feature setup</strong>
              <p>Only features allowed by this template are shown as usable.</p>
            </div>

            <FeatureToggleRow
              available={featureConfig.countdown.available}
              checked={Boolean(featureSettings.countdown?.enabled)}
              detail={`Position fixed by admin: ${featureConfig.countdown.position}`}
              label="Countdown"
              onChange={(enabled) =>
                updateFeatureSettings((current) => ({
                  ...current,
                  countdown: { enabled },
                }))
              }
            />

            {featureConfig.links.available ? (
              <div className="event-feature-block">
                <div className="event-feature-heading">
                  <span>Field links</span>
                  <button
                    disabled={linkableFields.length <= selectedLinkFields.size}
                    onClick={addLinkSetting}
                    type="button"
                  >
                    Add link
                  </button>
                </div>
                {linkableFields.length ? (
                  (featureSettings.links ?? []).map((link, index) => (
                    <div
                      className="event-link-row"
                      key={`${link.fieldKey}-${index}`}
                    >
                      <select
                        onChange={(changeEvent) =>
                          updateLinkSetting(index, {
                            fieldKey: changeEvent.target.value,
                          })
                        }
                        value={link.fieldKey}
                      >
                        {linkableFields.map((field) => (
                          <option
                            disabled={
                              field.key !== link.fieldKey &&
                              selectedLinkFields.has(field.key)
                            }
                            key={field.key}
                            value={field.key}
                          >
                            {field.label}
                          </option>
                        ))}
                      </select>
                      <input
                        onChange={(changeEvent) =>
                          updateLinkSetting(index, {
                            url: changeEvent.target.value,
                          })
                        }
                        placeholder="https://..."
                        type="url"
                        value={link.url}
                      />
                      <button
                        onClick={() => removeLinkSetting(index)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="event-feature-muted">
                    This template has no scanned linkable text fields.
                  </p>
                )}
              </div>
            ) : null}

            <FeatureToggleRow
              available={featureConfig.rsvp.available}
              checked={Boolean(featureSettings.rsvp?.enabled)}
              detail="Shows an RSVP button on the invitation. Form setup is in RSVP."
              label="RSVP button"
              onChange={(enabled) =>
                updateFeatureSettings((current) => ({
                  ...current,
                  rsvp: { enabled },
                }))
              }
            />

            {featureConfig.music.available ? (
              <div className="event-feature-block">
                <FeatureToggleRow
                  available
                  checked={Boolean(featureSettings.music?.enabled)}
                  detail="Use a public music URL. No upload needed."
                  label="Music"
                  onChange={(enabled) =>
                    updateFeatureSettings((current) => ({
                      ...current,
                      music: { ...(current.music ?? {}), enabled },
                    }))
                  }
                />
                <div className="event-feature-inline">
                  <input
                    disabled={!featureSettings.music?.enabled}
                    onChange={(changeEvent) =>
                      updateFeatureSettings((current) => ({
                        ...current,
                        music: {
                          ...(current.music ?? {}),
                          url: changeEvent.target.value,
                        },
                      }))
                    }
                    placeholder="https://music.example/song.mp3"
                    type="url"
                    value={featureSettings.music?.url ?? ""}
                  />
                  <button
                    disabled={!featureSettings.music?.enabled}
                    onClick={testMusic}
                    type="button"
                  >
                    Test
                  </button>
                </div>
              </div>
            ) : (
              <FeatureToggleRow
                available={false}
                checked={false}
                detail="No music slot was scanned in this template."
                label="Music"
                onChange={() => undefined}
              />
            )}

            {featureConfig.additionalInfo.available ? (
              <div className="event-feature-block">
                <FeatureToggleRow
                  available
                  checked={Boolean(featureSettings.additionalInfo?.enabled)}
                  detail="Adds one footer note at the bottom of the invitation."
                  label="Additional information"
                  onChange={(enabled) =>
                    updateFeatureSettings((current) => ({
                      ...current,
                      additionalInfo: {
                        ...(current.additionalInfo ?? {}),
                        enabled,
                      },
                    }))
                  }
                />
                <textarea
                  disabled={!featureSettings.additionalInfo?.enabled}
                  onChange={(changeEvent) =>
                    updateFeatureSettings((current) => ({
                      ...current,
                      additionalInfo: {
                        ...(current.additionalInfo ?? {}),
                        text: changeEvent.target.value,
                      },
                    }))
                  }
                  placeholder="Contact, parking, dress code, or any extra note."
                  rows={3}
                  value={featureSettings.additionalInfo?.text ?? ""}
                />
              </div>
            ) : null}

            <FeatureToggleRow
              available={featureConfig.openingAnimation.available}
              checked={Boolean(featureSettings.openingAnimation?.enabled)}
              detail="Opening animation is separate from the HTML template."
              label="Opening animation"
              onChange={(enabled) =>
                updateFeatureSettings((current) => ({
                  ...current,
                  openingAnimation: { enabled },
                }))
              }
            />

            {featureConfig.theme.available && styleSlots.length ? (
              <div className="event-feature-block">
                <div className="event-feature-heading">
                  <span>Theme colors and fonts</span>
                </div>
                {styleSlots.map((slot) => (
                  <label className="event-style-slot" key={slot.key}>
                    <span>{slot.label ?? slot.key}</span>
                    <input
                      onChange={(changeEvent) =>
                        updateFeatureSettings((current) => ({
                          ...current,
                          theme: {
                            ...(current.theme ?? {}),
                            [slot.key]: changeEvent.target.value,
                          },
                        }))
                      }
                      type={slot.type === "color" ? "color" : "text"}
                      value={
                        featureSettings.theme?.[slot.key] ??
                        slot.defaultValue ??
                        (slot.type === "color" ? "#2b222e" : "")
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}

            {featureConfig.sharePreview.available ? (
              <div className="event-feature-block">
                <div className="event-feature-heading">
                  <span>Share preview</span>
                </div>
                <input
                  onChange={(changeEvent) =>
                    updateFeatureSettings((current) => ({
                      ...current,
                      sharePreview: {
                        ...(current.sharePreview ?? {}),
                        title: changeEvent.target.value,
                      },
                    }))
                  }
                  placeholder="Preview title"
                  value={featureSettings.sharePreview?.title ?? ""}
                />
                <textarea
                  onChange={(changeEvent) =>
                    updateFeatureSettings((current) => ({
                      ...current,
                      sharePreview: {
                        ...(current.sharePreview ?? {}),
                        description: changeEvent.target.value,
                      },
                    }))
                  }
                  placeholder="Preview description"
                  rows={2}
                  value={featureSettings.sharePreview?.description ?? ""}
                />
                <input
                  onChange={(changeEvent) =>
                    updateFeatureSettings((current) => ({
                      ...current,
                      sharePreview: {
                        ...(current.sharePreview ?? {}),
                        imageUrl: changeEvent.target.value,
                      },
                    }))
                  }
                  placeholder="Preview image URL"
                  type="url"
                  value={featureSettings.sharePreview?.imageUrl ?? ""}
                />
              </div>
            ) : null}

            {featureConfig.print.available ? (
              <p className="event-feature-muted">
                This template includes print/PDF page sections.
              </p>
            ) : null}
          </div>
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

function FeatureToggleRow({
  available,
  checked,
  detail,
  label,
  onChange,
}: {
  available: boolean;
  checked: boolean;
  detail: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`event-feature-toggle ${available ? "" : "disabled"}`}>
      <span>
        <strong>{label}</strong>
        <small>{available ? detail : "Not available in this template."}</small>
      </span>
      <input
        checked={available && checked}
        disabled={!available}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
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

function applyFeaturePreview(
  html: string,
  settings: EventFeatureSettings,
  config: RequiredFeatureConfig,
  fields: { key: string; label: string }[],
) {
  let result = applyThemePreview(html, settings.theme ?? {});
  result = applyLinkPreview(result, settings.links ?? []);
  result = applySlotPreview(
    result,
    "data-nimto-additional-info-slot",
    settings.additionalInfo?.enabled
      ? `<div class="nimto-preview-additional-info">${escapeHtml(settings.additionalInfo.text ?? "")}</div>`
      : "",
  );
  result = applySlotPreview(
    result,
    "data-nimto-rsvp-slot",
    settings.rsvp?.enabled
      ? `<a class="nimto-preview-rsvp" href="#rsvp">RSVP</a>`
      : "",
  );
  result = applySlotPreview(
    result,
    "data-nimto-music-slot",
    settings.music?.enabled
      ? `<button class="nimto-preview-music" type="button">Play music</button>`
      : "",
  );
  if (!settings.countdown?.enabled) {
    result = applySlotPreview(result, "data-nimto-countdown-slot", "");
  }
  const featureSummary = [
    config.countdown.available
      ? `Countdown ${settings.countdown?.enabled ? "on" : "off"} (${config.countdown.position})`
      : null,
    settings.links?.length
      ? `${settings.links.length} linked field${settings.links.length === 1 ? "" : "s"}`
      : null,
    settings.rsvp?.enabled ? "RSVP button on" : null,
    settings.music?.enabled ? "Music ready" : null,
    settings.additionalInfo?.enabled ? "Footer note on" : null,
  ].filter(Boolean);
  if (featureSummary.length) {
    result = result.replace(
      /<\/body>/i,
      `<div class="nimto-preview-feature-summary">${featureSummary
        .map((item) => escapeHtml(String(item)))
        .join(" · ")}</div></body>`,
    );
  }
  return result.replace(
    /<\/body>/i,
    `<script>document.querySelectorAll('[data-nimto-linked-field]').forEach(function(link){link.addEventListener('click',function(event){event.preventDefault();});});</script></body>`,
  );
}

function applyThemePreview(html: string, theme: Record<string, string>) {
  const entries = Object.entries(theme).filter(([, value]) => value.trim());
  if (!entries.length) return html;
  const css = entries
    .map(([key, value]) => `--nimto-${cssName(key)}:${escapeHtml(value)};`)
    .join("");
  return html.replace(/<\/head>/i, `<style>:root{${css}}</style></head>`);
}

function applyLinkPreview(html: string, links: LinkSetting[]) {
  return links.reduce((result, link) => {
    if (!link.fieldKey || !link.url) return result;
    const pattern = new RegExp(
      `(<[^>]*data-nimto-field=(["'])${escapeRegExp(link.fieldKey)}\\2[^>]*>)(.*?)(<\\/[^>]+>)`,
      "gis",
    );
    return result.replace(pattern, (_match, open, _quote, content, close) => {
      return `${open}<a data-nimto-linked-field="${escapeHtml(link.fieldKey)}" href="${escapeHtml(link.url)}" rel="noopener noreferrer" target="_blank">${content}</a>${close}`;
    });
  }, html);
}

function applySlotPreview(
  html: string,
  attribute: string,
  replacement: string,
) {
  const pattern = new RegExp(
    `(<[^>]*${attribute}(?:=(["'])[^"']*\\2)?[^>]*>)(.*?)(<\\/[^>]+>)`,
    "gis",
  );
  return html.replace(pattern, `$1${replacement}$4`);
}

type RequiredFeatureConfig = {
  countdown: { available: boolean; defaultEnabled: boolean; position: string };
  rsvp: { available: boolean; defaultEnabled: boolean };
  music: { available: boolean; defaultEnabled: boolean };
  additionalInfo: { available: boolean; defaultEnabled: boolean };
  openingAnimation: { available: boolean; defaultEnabled: boolean };
  theme: { available: boolean; defaultEnabled: boolean };
  sharePreview: { available: boolean; defaultEnabled: boolean };
  print: { available: boolean; defaultEnabled: boolean };
  links: { available: boolean; defaultEnabled: boolean };
};

function normalizeFeatureConfig(
  config?: InvitationFeatureConfig | Record<string, unknown> | null,
): RequiredFeatureConfig {
  const source = (config ?? {}) as InvitationFeatureConfig;
  return {
    countdown: {
      available: Boolean(source.countdown?.available),
      defaultEnabled: source.countdown?.defaultEnabled !== false,
      position: source.countdown?.position ?? "bottom",
    },
    rsvp: normalizeToggle(source.rsvp),
    music: normalizeToggle(source.music),
    additionalInfo: normalizeToggle(source.additionalInfo),
    openingAnimation: normalizeToggle(source.openingAnimation),
    theme: normalizeToggle(source.theme),
    sharePreview: normalizeToggle(source.sharePreview),
    print: normalizeToggle(source.print),
    links: normalizeToggle(source.links),
  };
}

function normalizeToggle(toggle?: FeatureToggle) {
  return {
    available: Boolean(toggle?.available),
    defaultEnabled: Boolean(toggle?.defaultEnabled),
  };
}

function initialFeatureSettings(
  settings: Record<string, unknown> | null | undefined,
  config: RequiredFeatureConfig,
  styleSlots: StyleSlot[],
) {
  return normalizeFeatureSettings(
    (settings as EventFeatureSettings | null | undefined) ?? {
      countdown: { enabled: config.countdown.defaultEnabled },
      rsvp: { enabled: config.rsvp.defaultEnabled },
      music: { enabled: config.music.defaultEnabled, url: "" },
      additionalInfo: {
        enabled: config.additionalInfo.defaultEnabled,
        text: "",
      },
      openingAnimation: { enabled: config.openingAnimation.defaultEnabled },
      links: [],
      theme: Object.fromEntries(
        styleSlots.map((slot) => [slot.key, slot.defaultValue ?? ""]),
      ),
      sharePreview: { title: "", description: "", imageUrl: "" },
    },
    config,
    styleSlots,
  );
}

function normalizeFeatureSettings(
  settings: EventFeatureSettings,
  config: RequiredFeatureConfig,
  styleSlots: StyleSlot[],
): EventFeatureSettings {
  const styleKeys = new Set(styleSlots.map((slot) => slot.key));
  return {
    countdown: {
      enabled: config.countdown.available
        ? settings.countdown?.enabled !== false
        : false,
    },
    rsvp: {
      enabled: config.rsvp.available ? Boolean(settings.rsvp?.enabled) : false,
    },
    music: {
      enabled: config.music.available
        ? Boolean(settings.music?.enabled)
        : false,
      url: settings.music?.url ?? "",
    },
    additionalInfo: {
      enabled: config.additionalInfo.available
        ? Boolean(settings.additionalInfo?.enabled)
        : false,
      text: settings.additionalInfo?.text ?? "",
    },
    openingAnimation: {
      enabled: config.openingAnimation.available
        ? Boolean(settings.openingAnimation?.enabled)
        : false,
    },
    links: config.links.available
      ? (settings.links ?? [])
          .filter((link) => link.fieldKey)
          .map((link) => ({ fieldKey: link.fieldKey, url: link.url ?? "" }))
      : [],
    theme: Object.fromEntries(
      Object.entries(settings.theme ?? {}).filter(([key]) =>
        styleKeys.has(key),
      ),
    ),
    sharePreview: config.sharePreview.available
      ? {
          title: settings.sharePreview?.title ?? "",
          description: settings.sharePreview?.description ?? "",
          imageUrl: settings.sharePreview?.imageUrl ?? "",
        }
      : { title: "", description: "", imageUrl: "" },
  };
}

function cssName(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
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
