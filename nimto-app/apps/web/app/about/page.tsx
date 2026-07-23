import { serverApiUrl } from "@/lib/server-api";
import { PublicSiteShell } from "../public-site-shell";

type PageContent = {
  title: string;
  subtitle?: string | null;
  body?: string | null;
};

async function getPage(): Promise<PageContent> {
  try {
    const response = await fetch(`${serverApiUrl}/cms/public/pages/about`, {
      next: { revalidate: 60 },
    });
    if (response.ok) {
      return response.json();
    }
  } catch {}

  return {
    title: "About myNimto",
    subtitle:
      "A digital invitation platform for real events and real families.",
    body: "myNimto helps hosts create, personalize, and share event invitations without needing design or technical skills. We are building for weddings, birthdays, engagements, and cultural celebrations.",
  };
}

export default async function AboutPage() {
  const page = await getPage();

  return (
    <PublicSiteShell activePage="about">
      <section className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
          About us
        </p>
        <h1 className="mt-5 text-5xl font-black text-ink">{page.title}</h1>
        <p className="mt-6 text-xl leading-8 text-ink/65">{page.subtitle}</p>
        <div className="mt-10 whitespace-pre-wrap text-base leading-8 text-ink/70">
          {page.body}
        </div>
        <div className="feature-card mt-10">
          <h2 className="font-black text-ink">Contact</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Email: trilochan@mynimto.com
          </p>
        </div>
      </section>
    </PublicSiteShell>
  );
}
