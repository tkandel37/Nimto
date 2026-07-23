import { serverApiUrl } from "@/lib/server-api";
import { PublicSiteShell } from "../public-site-shell";

type PageContent = {
  title: string;
  subtitle?: string | null;
  body?: string | null;
};

async function getPage(): Promise<PageContent> {
  try {
    const response = await fetch(`${serverApiUrl}/cms/public/pages/features`, {
      next: { revalidate: 60 },
    });
    if (response.ok) {
      return response.json();
    }
  } catch {}

  return {
    title: "Features",
    subtitle: "Simple tools for creating and sharing event invitations.",
    body: "Invitation design, guest personalization, map links, countdowns, QR options, bulk PDF export, and bilingual content are planned for myNimto.",
  };
}

export default async function FeaturesPage() {
  const page = await getPage();

  return (
    <PublicSiteShell activePage="features">
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h1 className="text-5xl font-black text-ink">{page.title}</h1>
        <p className="mt-5 max-w-3xl text-xl leading-8 text-ink/65">
          {page.subtitle}
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Feature
            title="Invitation editor"
            body="Prepare event title, date, venue, message, and cover details."
          />
          <Feature
            title="Guest personalization"
            body="Add guest names and prepare printable or shareable versions."
          />
          <Feature
            title="Digital sharing"
            body="Send invitations through WhatsApp, Messenger, email, or direct links."
          />
          <Feature
            title="Content management"
            body="Keep website pages and blogs editable from the admin dashboard."
          />
        </div>
        <p className="mt-10 max-w-3xl whitespace-pre-wrap text-base leading-8 text-ink/70">
          {page.body}
        </p>
      </section>
    </PublicSiteShell>
  );
}

function Feature({ body, title }: { body: string; title: string }) {
  return (
    <article className="feature-card p-6">
      <h2 className="text-xl font-black text-ink">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-ink/60">{body}</p>
    </article>
  );
}
