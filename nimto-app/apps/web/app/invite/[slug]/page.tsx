import { notFound } from "next/navigation";

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
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function displayDate(value?: string | null) {
  if (!value) {
    return "Date to be announced";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const response = await fetch(`${API_URL}/events/public/${slug}`, {
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    notFound();
  }

  const event = (await response.json()) as InvitationEvent;

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
