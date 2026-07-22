import Link from "next/link";
import { serverApiUrl } from "@/lib/server-api";
import { AuthAwareAccountLink } from "./auth-aware-account-link";
import { BrandLogo } from "./brand-logo";

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
    title: "Invitations your guests will actually want to open",
    subtitle:
      "Pick a design, add the little details, and send a link that feels made for the people you are inviting.",
    body: "myNimto is built for weddings, birthdays, pujas, family gatherings, openings, and the small-big moments we end up remembering.",
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
            <p className="hero-kicker">Made around real Nepali events</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-tight text-ink md:text-7xl">
              Invitations your guests will actually want to open.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              {content.subtitle ||
                "Pick a design, add the little details, and send a link that feels made for the people you are inviting."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="site-button-primary" href="/designs">
                Browse invitation designs
              </Link>
              <AuthAwareAccountLink
                className="site-button-secondary"
                loggedOutLabel="Log in"
              />
              <Link className="site-button-ghost" href="/features">
                Take a quick look
              </Link>
            </div>
            <div className="landing-trust-row" aria-label="What myNimto helps with">
              <span>Guest names, not “Dear all”</span>
              <span>WhatsApp-friendly links</span>
              <span>Events kept in one calm place</span>
            </div>
          </div>

          <InvitationShowcase body={content.body} />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-12 md:grid-cols-3">
        <FeatureCard
          eyebrow="01"
          title="Start from the mood"
          body="Wedding mandap, Dashain tika, business opening, birthday dinner — choose the design that already feels close."
        />
        <FeatureCard
          eyebrow="02"
          title="Fill the real details"
          body="Names, venue, time, message, guest names — the things people actually look for before they leave home."
        />
        <FeatureCard
          eyebrow="03"
          title="Send it without drama"
          body="Publish a clean link, reuse a previous design, and keep the whole invite history where you can find it later."
        />
      </section>

      <section className="landing-section">
        <div className="landing-section-copy">
          <p className="hero-kicker">For the person arranging everything</p>
          <h2>A little less “send me the details again.”</h2>
          <p>
            myNimto keeps designs, event details, guests, links, and previous
            invitations together. It is not trying to be fancy for the sake of
            it — just useful when family, friends, and last-minute changes are
            all happening at once.
          </p>
        </div>
        <div className="landing-flow-card">
          {[
            ["Pick", "Choose something that matches the event, not a blank page."],
            ["Write", "Add the date, venue, message, and the name your guest sees."],
            ["Check", "Preview it once before you send the link around."],
            ["Reuse", "Come back later and use a design again for another event."],
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
        <p className="hero-kicker">No big setup</p>
        <h2>Make one invite. Send one good link.</h2>
        <p>
          Start small if you want. A birthday, a puja, a family dinner — the
          flow stays the same when the event gets bigger.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link className="site-button-primary" href="/designs">
            Browse designs
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
        <p>Wedding bhoj · 6:00 PM</p>
        <div className="landing-preview-note">
          {body ||
            "Come a little early if you can. Tika starts before dinner, and the family photo always takes longer than planned."}
        </div>
      </div>
      <div className="landing-preview-actions">
        <span className="preview-chip">For: Aama & Buwa</span>
        <span className="preview-chip">Open the invite →</span>
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
      <Link className="site-brand-link" href="/" aria-label="myNimto home">
        <BrandLogo priority />
      </Link>
      <nav className="flex flex-wrap items-center gap-5 text-sm font-bold text-ink/65">
        <Link href="/designs">Designs</Link>
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
