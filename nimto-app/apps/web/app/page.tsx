import Link from "next/link";
import { serverApiUrl } from "@/lib/server-api";
import { AuthAwareAccountLink } from "./auth-aware-account-link";

type PageContent = {
  title: string;
  subtitle?: string | null;
  body?: string | null;
};

async function getLandingContent(): Promise<PageContent> {
  try {
    const response = await fetch(`${serverApiUrl}/cms/public/pages/landing`, {
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
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[minmax(0,1fr)_440px] md:items-center md:py-20">
          <div>
            <p className="hero-kicker">
              Digital invitations for every celebration
            </p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight text-ink md:text-7xl">
              {content.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              {content.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <AuthAwareAccountLink className="site-button-secondary" />
              <Link className="site-button-primary" href="/auth?mode=register">
                Start creating
              </Link>
              <Link className="site-button-ghost" href="/features">
                View features
              </Link>
            </div>
          </div>

          <div className="landing-preview" aria-label="Invitation preview">
            <div className="landing-preview-bar">
              <span>Wedding invitation</span>
              <span>Live preview</span>
            </div>
            <p className="mt-8 text-sm font-black uppercase tracking-[0.25em] text-marigold">
              Kathmandu
            </p>
            <h2 className="mt-6 text-4xl font-black text-ink">Aarav & Sita</h2>
            <p className="mt-4 text-ink/65">Saturday, 21 December, 6:00 PM</p>
            <div className="mt-8 rounded-lg border border-ink/10 bg-white/72 p-5 text-sm leading-7 text-ink/65">
              {content.body}
            </div>
            <div className="mt-6 grid gap-3 text-sm font-bold text-ink/70 sm:grid-cols-2">
              <span className="preview-chip">Guest names</span>
              <span className="preview-chip">Share link</span>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-12 md:grid-cols-3">
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
        <AuthAwareAccountLink className="site-login-button" />
      </nav>
    </header>
  );
}

function FeatureCard({ body, title }: { body: string; title: string }) {
  return (
    <article className="feature-card">
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-ink/60">{body}</p>
    </article>
  );
}
