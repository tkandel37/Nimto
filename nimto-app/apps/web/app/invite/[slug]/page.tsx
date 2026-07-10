import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { serverApiUrl } from "@/lib/server-api";
import { RsvpConfig, RsvpFieldConfig } from "../../events/event-types";
import { RsvpForm } from "./rsvp-form";

type InvitationEvent = {
  title: string;
  type: string;
  eventDate?: string | null;
  venue?: string | null;
  description?: string | null;
  coverImage?: string | null;
  user?: {
    name: string;
  };
  designFieldValues?: Record<string, string> | null;
  inviteeName?: string | null;
  inviteeSlug?: string | null;
  rsvpStatus?: "PENDING" | "ATTENDING" | "DECLINED";
  partySize?: number | null;
  mealPreference?: string | null;
  rsvpMessage?: string | null;
  rsvpDeadline?: string | null;
  featureSettings?: InvitationFeatureSettings | null;
  rsvpConfig?: RsvpConfig | Record<string, unknown> | null;
  designVersion?: {
    rawHtml: string;
    featureConfig?: InvitationFeatureConfig | null;
    design?: { name: string; slug: string };
  } | null;
};

type InvitationFeatureConfig = {
  countdown?: { available?: boolean; position?: string };
  rsvp?: { available?: boolean };
  music?: { available?: boolean };
  additionalInfo?: { available?: boolean };
  theme?: { available?: boolean };
  sharePreview?: { available?: boolean };
  print?: { available?: boolean };
  links?: { available?: boolean };
};

type InvitationFeatureSettings = {
  countdown?: { enabled?: boolean };
  rsvp?: { enabled?: boolean };
  music?: { enabled?: boolean; url?: string };
  additionalInfo?: { enabled?: boolean; text?: string };
  links?: { fieldKey: string; url: string }[];
  theme?: Record<string, string>;
  sharePreview?: {
    title?: string;
    description?: string;
    imageUrl?: string;
  };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function displayDate(value?: string | null) {
  if (!value) {
    return "Date to be announced";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

async function getInvitation(slug: string, track = true) {
  const response = await fetch(
    `${serverApiUrl}/events/public/${slug}${track ? "" : "?track=false"}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as InvitationEvent;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getInvitation(slug, false);
  if (!event) {
    return { title: "Invitation not found" };
  }

  const sharePreview = event.featureSettings?.sharePreview;
  const title = sharePreview?.title?.trim() || `${event.title} Invitation`;
  const description =
    sharePreview?.description?.trim() ||
    event.description ||
    `${event.type} invitation${event.eventDate ? ` on ${displayDate(event.eventDate)}` : ""}.`;
  const image = sharePreview?.imageUrl?.trim() || event.coverImage || undefined;

  return {
    metadataBase: new URL(APP_URL),
    title,
    description,
    alternates: {
      canonical: `/invite/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/invite/${slug}`,
      siteName: "myNimto",
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getInvitation(slug);
  if (!event) notFound();
  const rsvpEnabled = Boolean(
    event.designVersion?.featureConfig?.rsvp?.available &&
    event.featureSettings?.rsvp?.enabled,
  );
  const rsvpConfig = normalizeRsvpConfig(event.rsvpConfig);
  const renderedHtml = event.designVersion?.rawHtml
    ? renderInvitationHtml(event.designVersion.rawHtml, event, slug)
    : null;

  if (renderedHtml) {
    return (
      <main className="min-h-screen bg-paper">
        <iframe
          className="min-h-screen w-full border-0 bg-white"
          sandbox="allow-scripts allow-popups allow-top-navigation-by-user-activation"
          srcDoc={renderedHtml}
          title={event.title}
        />
        {rsvpEnabled || (event.inviteeSlug && event.inviteeName) ? (
          <RsvpForm
            config={rsvpConfig}
            initialMealPreference={event.mealPreference}
            initialMessage={event.rsvpMessage}
            initialPartySize={event.partySize}
            initialStatus={event.rsvpStatus}
            inviteeName={event.inviteeName ?? event.title}
            publicMode={!event.inviteeSlug}
            rsvpDeadline={event.rsvpDeadline}
            slug={event.inviteeSlug ?? slug}
          />
        ) : null}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper">
      <section
        className="grid min-h-screen place-items-center bg-cover bg-center px-5 py-12"
        style={
          event.coverImage
            ? {
                backgroundImage: `linear-gradient(rgba(255,250,241,.82), rgba(255,250,241,.82)), url(${event.coverImage})`,
              }
            : undefined
        }
      >
        <article className="w-full max-w-2xl rounded-lg border border-ink/10 bg-white/88 p-7 text-center shadow-2xl shadow-ink/10 backdrop-blur md:p-12">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-marigold">
            {event.type}
          </p>
          <h1 className="mt-5 text-4xl font-black text-ink md:text-6xl">
            {event.title}
          </h1>
          <p className="mt-6 text-lg font-bold text-leaf">
            {displayDate(event.eventDate)}
          </p>
          {event.venue ? (
            <p className="mt-3 text-base font-bold text-ink/70">
              {event.venue}
            </p>
          ) : null}
          {event.description ? (
            <p className="mx-auto mt-7 max-w-xl whitespace-pre-wrap text-base leading-8 text-ink/70">
              {event.description}
            </p>
          ) : null}
          {event.user?.name ? (
            <p className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-ink/45">
              Hosted by {event.user.name}
            </p>
          ) : null}
        </article>
        {rsvpEnabled || (event.inviteeSlug && event.inviteeName) ? (
          <RsvpForm
            config={rsvpConfig}
            initialMealPreference={event.mealPreference}
            initialMessage={event.rsvpMessage}
            initialPartySize={event.partySize}
            initialStatus={event.rsvpStatus}
            inviteeName={event.inviteeName ?? event.title}
            publicMode={!event.inviteeSlug}
            rsvpDeadline={event.rsvpDeadline}
            slug={event.inviteeSlug ?? slug}
          />
        ) : null}
      </section>
    </main>
  );
}

function renderInvitationHtml(
  rawHtml: string,
  event: InvitationEvent,
  slug: string,
) {
  const withValues = applyFieldValuesToHtml(rawHtml, event);
  return applyInvitationFeatures(withValues, event, slug);
}

function applyFieldValuesToHtml(rawHtml: string, event: InvitationEvent) {
  const values = {
    title: event.title,
    event_title: event.title,
    event_date: event.eventDate ? event.eventDate.slice(0, 10) : "",
    venue: event.venue ?? "",
    invitee_name: event.inviteeName ?? "",
    description: event.description ?? "",
    ...(event.designFieldValues ?? {}),
  };

  return Object.entries(values).reduce((html, [key, value]) => {
    if (!value) return html;
    const pattern = new RegExp(
      `(<[^>]*data-nimto-field=(["'])${escapeRegExp(key)}\\2[^>]*>)(.*?)(<\\/[^>]+>)`,
      "gis",
    );
    return html.replace(pattern, `$1${escapeHtml(value)}$4`);
  }, rawHtml);
}

function applyInvitationFeatures(
  rawHtml: string,
  event: InvitationEvent,
  slug: string,
) {
  const config = event.designVersion?.featureConfig ?? {};
  const settings = event.featureSettings ?? {};
  let html = rawHtml;

  if (config.theme?.available && settings.theme) {
    html = injectHeadHtml(
      html,
      `<style>:root{${Object.entries(settings.theme)
        .filter(([, value]) => String(value).trim())
        .map(
          ([key, value]) =>
            `--nimto-${cssName(key)}:${escapeHtml(String(value))};`,
        )
        .join("")}}</style>`,
    );
  }

  if (config.print?.available) {
    html = injectHeadHtml(
      html,
      "<style>@media print{body{margin:0}.nimto-print-page,[data-nimto-print-page]{break-after:page;page-break-after:always}.nimto-print-page:last-child,[data-nimto-print-page]:last-child{break-after:auto;page-break-after:auto}}</style>",
    );
  }

  if (config.links?.available) {
    html = applyFieldLinks(html, settings.links ?? []);
  }

  if (config.countdown?.available) {
    html = applySlotHtml(
      html,
      "data-nimto-countdown-slot",
      settings.countdown?.enabled !== false && event.eventDate
        ? countdownHtml(event.eventDate)
        : "",
    );
  }

  if (config.rsvp?.available) {
    html = applySlotHtml(
      html,
      "data-nimto-rsvp-slot",
      settings.rsvp?.enabled
        ? `<a class="nimto-rsvp-button" href="/invite/${escapeHtml(slug)}#nimto-rsvp-form" target="_top">RSVP</a>`
        : "",
    );
  }

  if (config.music?.available) {
    const musicUrl = settings.music?.url?.trim();
    html = applySlotHtml(
      html,
      "data-nimto-music-slot",
      settings.music?.enabled && musicUrl
        ? `<audio class="nimto-music-player" controls preload="none" src="${escapeHtml(musicUrl)}"></audio>`
        : "",
    );
  }

  if (config.additionalInfo?.available) {
    html = applySlotHtml(
      html,
      "data-nimto-additional-info-slot",
      settings.additionalInfo?.enabled
        ? `<div class="nimto-additional-info">${escapeHtml(settings.additionalInfo.text ?? "")}</div>`
        : "",
    );
  }

  return injectHeadHtml(
    html,
    `<style>
      .nimto-rsvp-button{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer}
      .nimto-music-player{max-width:100%}
      .nimto-countdown{display:inline-grid;grid-auto-flow:column;gap:.65rem;align-items:center}
      .nimto-countdown span{display:grid;text-align:center;font-weight:800}
      .nimto-countdown small{font-size:.68em;text-transform:uppercase;letter-spacing:.08em;opacity:.72}
      .nimto-additional-info{white-space:pre-wrap}
    </style>`,
  );
}

function applyFieldLinks(
  html: string,
  links: { fieldKey: string; url: string }[],
) {
  return links.reduce((result, link) => {
    if (!link.fieldKey || !link.url) return result;
    const pattern = new RegExp(
      `(<[^>]*data-nimto-field=(["'])${escapeRegExp(link.fieldKey)}\\2[^>]*>)(.*?)(<\\/[^>]+>)`,
      "gis",
    );
    return result.replace(
      pattern,
      `$1<a href="${escapeHtml(link.url)}" rel="noopener noreferrer" target="_blank">$3</a>$4`,
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

function countdownHtml(eventDate: string) {
  const target = escapeHtml(eventDate);
  return `<div class="nimto-countdown" data-nimto-countdown-target="${target}">
    <span><b data-nimto-countdown-days>0</b><small>Days</small></span>
    <span><b data-nimto-countdown-hours>0</b><small>Hours</small></span>
    <span><b data-nimto-countdown-minutes>0</b><small>Minutes</small></span>
  </div>
  <script>
    (function(){
      var root=document.currentScript.previousElementSibling;
      if(!root)return;
      var target=new Date(root.getAttribute("data-nimto-countdown-target")).getTime();
      function tick(){
        var diff=Math.max(0,target-Date.now());
        var minutes=Math.floor(diff/60000);
        var days=Math.floor(minutes/1440);
        var hours=Math.floor((minutes%1440)/60);
        root.querySelector("[data-nimto-countdown-days]").textContent=days;
        root.querySelector("[data-nimto-countdown-hours]").textContent=hours;
        root.querySelector("[data-nimto-countdown-minutes]").textContent=minutes%60;
      }
      tick(); window.setInterval(tick,60000);
    })();
  </script>`;
}

function injectHeadHtml(html: string, injection: string) {
  if (!injection.trim()) return html;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${injection}</head>`);
  }
  return `${injection}${html}`;
}

function cssName(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
}

function normalizeRsvpConfig(
  config?: Record<string, unknown> | RsvpConfig | null,
): RsvpConfig {
  return {
    note: String(config?.note ?? ""),
    closedMessage: String(
      config?.closedMessage ?? "Sorry, RSVP is closed for this event.",
    ),
    fields: Array.isArray(config?.fields)
      ? (config.fields as RsvpFieldConfig[])
      : [
          {
            id: "attendance_status",
            key: "attendance_status",
            label: "Will you attend?",
            type: "single_choice",
            required: true,
            enabled: true,
            builtIn: true,
            options: ["Attending", "Cannot attend"],
          },
          {
            id: "full_name",
            key: "full_name",
            label: "Full name",
            type: "text",
            required: true,
            enabled: true,
            builtIn: true,
          },
          {
            id: "phone_number",
            key: "phone_number",
            label: "Phone number",
            type: "phone",
            required: false,
            enabled: true,
            builtIn: true,
          },
          {
            id: "email_address",
            key: "email_address",
            label: "Email address",
            type: "email",
            required: false,
            enabled: true,
            builtIn: true,
          },
          {
            id: "number_of_guests",
            key: "number_of_guests",
            label: "How many people are coming?",
            type: "number",
            required: false,
            enabled: true,
            builtIn: true,
          },
        ],
  };
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
