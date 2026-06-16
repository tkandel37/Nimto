import { notFound } from "next/navigation";
import type { Metadata } from "next";

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
  designVersion?: {
    rawHtml: string;
    design?: { name: string; slug: string };
  } | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
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

async function getInvitation(slug: string) {
  const response = await fetch(`${API_URL}/events/public/${slug}`, {
    next: { revalidate: 60 },
  });

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
  const event = await getInvitation(slug);
  if (!event) {
    return { title: "Invitation not found" };
  }

  const title = `${event.title} Invitation`;
  const description =
    event.description ||
    `${event.type} invitation${event.eventDate ? ` on ${displayDate(event.eventDate)}` : ""}.`;

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
      images: event.coverImage ? [{ url: event.coverImage }] : undefined,
    },
    twitter: {
      card: event.coverImage ? "summary_large_image" : "summary",
      title,
      description,
      images: event.coverImage ? [event.coverImage] : undefined,
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
  const renderedHtml = event.designVersion?.rawHtml
    ? applyFieldValuesToHtml(event.designVersion.rawHtml, event)
    : null;

  if (renderedHtml) {
    return (
      <main className="min-h-screen bg-paper">
        <iframe
          className="min-h-screen w-full border-0 bg-white"
          sandbox="allow-scripts"
          srcDoc={renderedHtml}
          title={event.title}
        />
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
            <p className="mt-3 text-base font-bold text-ink/70">{event.venue}</p>
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
      </section>
    </main>
  );
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
