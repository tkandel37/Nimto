import Link from "next/link";

type PageContent = {
  title: string;
  subtitle?: string | null;
  body?: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getLandingContent(): Promise<PageContent> {
  try {
    const response = await fetch(`${API_URL}/cms/public/pages/landing`, {
      next: { revalidate: 60 },
    });

    if (response.ok) {
      return response.json();
    }
  } catch {
    // Build should succeed even when the API is not reachable.
  }

  return {
    title: "Digital invitations made simple",
    subtitle:
      "Create beautiful invitations, personalize guest names, and share every event from one calm workspace.",
    body: "myNimto is built for weddings, birthdays, engagements, and community celebrations.",
  };
}

export default async function Home() {
  const content = await getLandingContent();

  return (
    <main className="site-shell">
      <SiteHeader />
      <section className="hero-section">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[minmax(0,1fr)_420px] md:items-center md:py-20">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
              myNimto
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight text-ink md:text-7xl">
              {content.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              {content.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="site-button-primary" href="/auth?mode=register">
                Start creating
              </Link>
              <Link className="site-button-secondary" href="/features">
                View features
              </Link>
            </div>
          </div>

          <div className="invitation-card">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-marigold">
              Wedding invitation
            </p>
            <h2 className="mt-8 text-4xl font-black text-ink">Aarav & Sita</h2>
            <p className="mt-4 text-ink/65">Saturday, 21 December</p>
            <div className="mt-10 border-t border-ink/10 pt-6 text-sm leading-7 text-ink/60">
              {content.body}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-10 md:grid-cols-3">
        <FeatureCard
          title="Create"
          body="Build invitation content and event details in one place."
        />
        <FeatureCard
          title="Personalize"
          body="Prepare guest names, PDF exports, and sharing links."
        />
        <FeatureCard
          title="Publish"
          body="Share a clean invitation page with family and guests."
        />
      </section>
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="text-xl font-black text-ink" href="/">
        myNimto
      </Link>
      <nav className="flex flex-wrap items-center gap-5 text-sm font-bold text-ink/65">
        <Link href="/features">Features</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/about">About</Link>
        <Link href="/auth?mode=login">Log in</Link>
      </nav>
    </header>
  );
}

function FeatureCard({ body, title }: { body: string; title: string }) {
  return (
    <article className="rounded-lg border border-ink/10 bg-white p-5">
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-ink/60">{body}</p>
    </article>
  );
}
