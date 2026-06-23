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
      <section className="hero-section landing-hero">
        <div className="landing-orb landing-orb-one" />
        <div className="landing-orb landing-orb-two" />
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[minmax(0,1fr)_460px] md:items-center md:py-20">
          <div className="landing-hero-copy">
            <p className="hero-kicker">Digital invitations that feel personal</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight text-ink md:text-7xl">
              {content.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              {content.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="site-button-primary" href="/auth?mode=register">
                Start creating free
              </Link>
              <AuthAwareAccountLink
                className="site-button-secondary"
                loggedOutLabel="Log in"
              />
              <Link className="site-button-ghost" href="/features">
                See how it works
              </Link>
            </div>
            <div className="landing-trust-row" aria-label="What myNimto helps with">
              <span>✓ Guest names</span>
              <span>✓ Share links</span>
              <span>✓ RSVP tracking</span>
            </div>
          </div>

          <InvitationShowcase body={content.body} />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-12 md:grid-cols-3">
        <FeatureCard
          eyebrow="01"
          title="Choose a design"
          body="Start with a clean template for weddings, birthdays, family events, launches, and more."
        />
        <FeatureCard
          eyebrow="02"
          title="Make it yours"
          body="Add the event story, venue, time, custom guest names, and a beautiful share-ready preview."
        />
        <FeatureCard
          eyebrow="03"
          title="Share with joy"
          body="Publish a simple link, upload guests with CSV, and keep every invitation organised."
        />
      </section>

      <section className="landing-section">
        <div className="landing-section-copy">
          <p className="hero-kicker">Made for real hosts</p>
          <h2>Less stress, more celebration.</h2>
          <p>
            myNimto keeps the full flow in one place: designs, events, guests,
            invite links, history, and previews. No scattered files. No “which
            link did I send?” panic. Just a calm workspace for happy moments.
          </p>
        </div>
        <div className="landing-flow-card">
          {[
            ["Pick", "Browse simple invitation templates."],
            ["Create", "Fill in event details and personalize the message."],
            ["Invite", "Upload guests or add them one by one."],
            ["Track", "Reuse designs and manage invitations later."],
          ].map(([title, body]) => (
            <div className="landing-flow-step" key={title}>
              <span>{title}</span>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-template-strip" aria-label="Invitation types">
        {[
          "Corporate event",
          "Birthday",
          "Wedding",
          "House party",
          "Business opening",
          "Family gathering",
        ].map((template) => (
          <span key={template}>{template}</span>
        ))}
      </section>

      <section className="landing-cta">
        <p className="hero-kicker">Ready when you are</p>
        <h2>Create your next invitation in minutes.</h2>
        <p>
          Simple enough for a quick birthday invite, polished enough for a
          wedding or corporate event.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link className="site-button-primary" href="/auth?mode=register">
            Create an invitation
          </Link>
          <AuthAwareAccountLink className="site-button-secondary" />
        </div>
      </section>
    </main>
  );
}

function InvitationShowcase({ body }: { body?: string | null }) {
  return (
    <div className="landing-preview" aria-label="Invitation preview">
      <div className="landing-preview-bar">
        <span>Live invitation</span>
        <span>Preview</span>
      </div>
      <div className="landing-preview-card">
        <p className="landing-preview-label">Kathmandu • Saturday</p>
        <h2>Aarav & Sita</h2>
        <p>Wedding celebration · 6:00 PM</p>
        <div className="landing-preview-note">
          {body ||
            "Create beautiful invitations, personalize guest names, and share every event from one calm workspace."}
        </div>
      </div>
      <div className="landing-preview-actions">
        <span className="preview-chip">Dear Aama & Buwa</span>
        <span className="preview-chip">Open invite →</span>
      </div>
      <div className="landing-mini-dashboard" aria-hidden="true">
        <span>Guests</span>
        <strong>128</strong>
        <span>RSVP</span>
        <strong>84</strong>
      </div>
    </div>
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

function FeatureCard({
  body,
  eyebrow,
  title,
}: {
  body: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <article className="feature-card">
      <span className="feature-eyebrow">{eyebrow}</span>
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-ink/60">{body}</p>
    </article>
  );
}
