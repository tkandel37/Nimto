import {
  DesignScanResult,
  InvitationFeatureConfig,
  InvitationFeatureSettings,
  StyleSlot,
  TemplateField,
  UserEvent,
} from "@/lib/types";

export type NormalizedFeatureConfig = {
  countdown: {
    available: boolean;
    defaultEnabled: boolean;
    position: "top" | "middle" | "bottom";
  };
  rsvp: { available: boolean; defaultEnabled: boolean };
  music: { available: boolean; defaultEnabled: boolean };
  additionalInfo: { available: boolean; defaultEnabled: boolean };
  openingAnimation: { available: boolean; defaultEnabled: boolean };
  theme: { available: boolean; defaultEnabled: boolean };
  sharePreview: { available: boolean; defaultEnabled: boolean };
  print: { available: boolean; defaultEnabled: boolean };
  links: { available: boolean; defaultEnabled: boolean };
};

export function editableInvitationFields(scanResult?: DesignScanResult | null) {
  return (scanResult?.fields ?? []).filter(
    (field) => field.editableByUser !== false && !field.locked && !field.paid,
  );
}

export function initialInvitationValues(
  fields: TemplateField[],
  savedValues?: Record<string, unknown> | null,
) {
  return Object.fromEntries(
    fields.map((field) => {
      const saved = savedValues?.[field.key];
      return [
        field.key,
        typeof saved === "string" || typeof saved === "number"
          ? String(saved)
          : (field.defaultValue ?? ""),
      ];
    }),
  );
}

export function missingRequiredInvitationFields(
  fields: TemplateField[],
  values: Record<string, string>,
) {
  return fields.filter(
    (field) => field.required && !String(values[field.key] ?? "").trim(),
  );
}

export function normalizeFeatureConfig(
  config?: InvitationFeatureConfig | null,
): NormalizedFeatureConfig {
  return {
    countdown: {
      available: Boolean(config?.countdown?.available),
      defaultEnabled: config?.countdown?.defaultEnabled !== false,
      position: config?.countdown?.position ?? "bottom",
    },
    rsvp: normalizeToggle(config?.rsvp),
    music: normalizeToggle(config?.music),
    additionalInfo: normalizeToggle(config?.additionalInfo),
    openingAnimation: normalizeToggle(config?.openingAnimation),
    theme: normalizeToggle(config?.theme),
    sharePreview: normalizeToggle(config?.sharePreview),
    print: normalizeToggle(config?.print),
    links: normalizeToggle(config?.links),
  };
}

export function initialFeatureSettings(
  settings:
    InvitationFeatureSettings | Record<string, unknown> | null | undefined,
  config: NormalizedFeatureConfig,
  styleSlots: StyleSlot[],
) {
  const source = (settings ?? {}) as InvitationFeatureSettings;
  const styleKeys = new Set(styleSlots.map((slot) => slot.key));
  const defaultTheme = Object.fromEntries(
    styleSlots.map((slot) => [slot.key, slot.defaultValue ?? ""]),
  );
  return {
    countdown: {
      enabled: config.countdown.available
        ? (source.countdown?.enabled ?? config.countdown.defaultEnabled)
        : false,
    },
    rsvp: {
      enabled: config.rsvp.available
        ? (source.rsvp?.enabled ?? config.rsvp.defaultEnabled)
        : false,
    },
    music: {
      enabled: config.music.available
        ? (source.music?.enabled ?? config.music.defaultEnabled)
        : false,
      url: source.music?.url ?? "",
    },
    additionalInfo: {
      enabled: config.additionalInfo.available
        ? (source.additionalInfo?.enabled ??
          config.additionalInfo.defaultEnabled)
        : false,
      text: source.additionalInfo?.text ?? "",
    },
    openingAnimation: {
      enabled: config.openingAnimation.available
        ? (source.openingAnimation?.enabled ??
          config.openingAnimation.defaultEnabled)
        : false,
    },
    links: config.links.available
      ? (source.links ?? []).map((link) => ({
          fieldKey: link.fieldKey,
          url: link.url ?? "",
          hoverText: link.hoverText ?? "Follow link",
        }))
      : [],
    theme: {
      ...defaultTheme,
      ...Object.fromEntries(
        Object.entries(source.theme ?? {}).filter(([key]) =>
          styleKeys.has(key),
        ),
      ),
    },
    sharePreview: config.sharePreview.available
      ? {
          title: source.sharePreview?.title ?? "",
          description: source.sharePreview?.description ?? "",
          imageUrl: source.sharePreview?.imageUrl ?? "",
        }
      : { title: "", description: "", imageUrl: "" },
  } satisfies InvitationFeatureSettings;
}

export function applyInvitationValues(
  html: string,
  values: Record<string, unknown> | null | undefined,
) {
  const rendered = Object.entries(values ?? {}).reduce(
    (result, [key, value]) => {
      if (typeof value !== "string" && typeof value !== "number") return result;
      const pattern = new RegExp(
        `(<[^>]*data-nimto-field=(["'])${escapeRegExp(key)}\\2[^>]*>)(.*?)(<\\/[^>]+>)`,
        "gis",
      );
      return result.replace(pattern, `$1${escapeHtml(String(value))}$4`);
    },
    html,
  );
  return addMobileDocumentStyles(rendered);
}

export function renderInvitationPreview({
  config,
  event,
  featureSettings,
  rawHtml,
  values,
}: {
  config: NormalizedFeatureConfig;
  event: Pick<UserEvent, "description" | "eventDate" | "title" | "venue">;
  featureSettings: InvitationFeatureSettings;
  rawHtml: string;
  values: Record<string, string>;
}) {
  let html = applyInvitationValues(rawHtml, {
    title: event.title,
    event_title: event.title,
    event_date: event.eventDate?.slice(0, 10) ?? "",
    venue: event.venue ?? "",
    description: event.description ?? "",
    ...values,
  });

  if (config.theme.available && featureSettings.theme) {
    const css = Object.entries(featureSettings.theme)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => `--nimto-${cssName(key)}:${escapeHtml(value)};`)
      .join("");
    if (css) html = injectHeadHtml(html, `<style>:root{${css}}</style>`);
  }

  if (config.links.available) {
    html = applyFieldLinks(html, featureSettings.links ?? []);
  }
  if (config.countdown.available) {
    html = applySlotHtml(
      html,
      "data-nimto-countdown-slot",
      featureSettings.countdown?.enabled && event.eventDate
        ? `<div class="nimto-countdown"><span><b>${escapeHtml(formatCountdownDate(event.eventDate))}</b><small>Event date</small></span></div>`
        : "",
    );
  }
  if (config.rsvp.available) {
    html = applySlotHtml(
      html,
      "data-nimto-rsvp-slot",
      featureSettings.rsvp?.enabled
        ? '<span class="nimto-rsvp-button">RSVP</span>'
        : "",
    );
  }
  if (config.music.available) {
    const musicUrl = safeUrl(featureSettings.music?.url, ["https:"]);
    html = applySlotHtml(
      html,
      "data-nimto-music-slot",
      featureSettings.music?.enabled && musicUrl
        ? '<span class="nimto-music-player">Music enabled</span>'
        : "",
    );
  }
  if (config.additionalInfo.available) {
    html = applySlotHtml(
      html,
      "data-nimto-additional-info-slot",
      featureSettings.additionalInfo?.enabled
        ? `<div class="nimto-additional-info">${escapeHtml(featureSettings.additionalInfo.text ?? "")}</div>`
        : "",
    );
  }

  return injectHeadHtml(
    html,
    `<style>
      .nimto-rsvp-button{display:inline-flex;align-items:center;justify-content:center}
      .nimto-music-player{display:inline-flex;align-items:center;justify-content:center}
      .nimto-countdown{display:inline-grid;gap:.3rem;text-align:center}
      .nimto-countdown span{display:grid;font-weight:800}
      .nimto-countdown small{font-size:.68em;text-transform:uppercase;letter-spacing:.08em;opacity:.72}
      .nimto-additional-info{white-space:pre-wrap}
      a[data-nimto-linked-field]{color:inherit!important;font:inherit!important;text-decoration:underline;text-decoration-thickness:.08em;text-underline-offset:.12em}
    </style>`,
  );
}

export function hasInvitationDraft(event: UserEvent) {
  if (
    !event.draftDesignVersionId &&
    !event.draftDesignFieldValues &&
    !event.draftFeatureSettings
  ) {
    return false;
  }
  if (
    event.draftDesignVersionId &&
    event.draftDesignVersionId !== event.designVersion?.id
  ) {
    return true;
  }
  if (
    JSON.stringify(event.draftDesignFieldValues ?? {}) !==
    JSON.stringify(event.designFieldValues ?? {})
  ) {
    return true;
  }
  return (
    JSON.stringify(event.draftFeatureSettings ?? {}) !==
    JSON.stringify(event.featureSettings ?? {})
  );
}

function normalizeToggle(toggle?: {
  available?: boolean;
  defaultEnabled?: boolean;
}) {
  return {
    available: Boolean(toggle?.available),
    defaultEnabled: Boolean(toggle?.defaultEnabled),
  };
}

function applyFieldLinks(
  html: string,
  links: NonNullable<InvitationFeatureSettings["links"]>,
) {
  return links.reduce((result, link) => {
    const target = safeUrl(link.url, ["https:", "mailto:", "tel:"]);
    if (!link.fieldKey || !target) return result;
    const pattern = new RegExp(
      `(<[^>]*data-nimto-field=(["'])${escapeRegExp(link.fieldKey)}\\2[^>]*>)(.*?)(<\\/[^>]+>)`,
      "gis",
    );
    return result.replace(
      pattern,
      (_match, open, _quote, content, close) =>
        `${open}<a data-nimto-linked-field="${escapeHtml(link.fieldKey)}" href="${escapeHtml(target)}">${content}</a>${close}`,
    );
  }, html);
}

function applySlotHtml(html: string, attribute: string, replacement: string) {
  const pattern = new RegExp(
    `(<[^>]*${attribute}(?:=(["'])[^"']*\\2)?[^>]*>)(.*?)(<\\/[^>]+>)`,
    "gis",
  );
  return html.replace(pattern, `$1${replacement}$4`);
}

function addMobileDocumentStyles(html: string) {
  const viewport = /name=["']viewport["']/i.test(html)
    ? ""
    : '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">';
  const css =
    "<style>html,body{max-width:100%;min-height:100%;overflow-x:hidden}img,video{max-width:100%;height:auto}</style>";
  return injectHeadHtml(html, `${viewport}${css}`);
}

function injectHeadHtml(html: string, injection: string) {
  return /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `${injection}</head>`)
    : `${injection}${html}`;
}

function safeUrl(value: string | undefined, protocols: string[]) {
  if (!value?.trim()) return "";
  try {
    const parsed = new URL(value.trim());
    return protocols.includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function formatCountdownDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
