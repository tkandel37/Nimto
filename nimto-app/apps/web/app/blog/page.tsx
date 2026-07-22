import Link from "next/link";
import { serverApiUrl } from "@/lib/server-api";
import { AuthAwareAccountLink } from "../auth-aware-account-link";
import { BrandLogo } from "../brand-logo";

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  citationSummary?: string | null;
  metaDescription?: string | null;
  publishedAt?: string | null;
  author?: { name: string };
};

async function getPosts(): Promise<BlogPost[]> {
  try {
    const response = await fetch(`${serverApiUrl}/cms/public/blog`, {
      next: { revalidate: 60 },
    });
    return response.ok ? response.json() : [];
  } catch {
    return [];
  }
}

export default async function BlogPage() {
  const posts = await getPosts();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "myNimto Digital Invitation Blog",
    description:
      "Guides about digital invitations, online invitation wording, guest personalization, RSVP planning, and event sharing.",
    hasPart: posts.map((post) => ({
      "@type": "Article",
      headline: post.title,
      description:
        post.citationSummary ??
        post.excerpt ??
        post.metaDescription ??
        undefined,
      url: `/blog/${post.slug}`,
    })),
  };

  return (
    <main className="site-shell">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <header className="site-header">
        <Link className="site-brand-link" href="/" aria-label="myNimto home">
          <BrandLogo />
        </Link>
        <nav className="flex flex-wrap items-center gap-5 text-sm font-bold text-ink/65">
          <Link href="/designs">Designs</Link>
          <Link href="/features">Features</Link>
          <Link href="/about">About</Link>
          <AuthAwareAccountLink className="site-login-button" />
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
          myNimto blog
        </p>
        <h1 className="mt-5 max-w-4xl text-5xl font-black leading-tight text-ink md:text-6xl">
          Digital invitation guides for hosts, families, and event teams.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-ink/65">
          Articles here are written to answer real questions about digital
          invitations, online RSVP, wedding cards, guest personalization, and
          modern invitation sharing.
        </p>
        <div className="mt-8 grid gap-3 rounded-lg border border-ink/10 bg-white p-5 md:grid-cols-3">
          <p className="text-sm font-bold text-ink">Clear answers</p>
          <p className="text-sm font-bold text-ink">FAQ-ready sections</p>
          <p className="text-sm font-bold text-ink">Source-backed notes</p>
        </div>
        <div className="mt-12 grid gap-4">
          {posts.length ? (
            posts.map((post) => (
              <article
                className="rounded-lg border border-ink/10 bg-white p-6"
                key={post.id}
              >
                <p className="text-sm font-bold text-leaf">
                  {post.publishedAt
                    ? new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                      }).format(new Date(post.publishedAt))
                    : "Published"}
                </p>
                <h2 className="mt-3 text-2xl font-black text-ink">
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/60">
                  {post.citationSummary ?? post.excerpt ?? post.metaDescription}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-ink/10 bg-white p-6">
              <h2 className="text-xl font-black text-ink">
                Blog posts are coming soon.
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                Staff can publish SEO-friendly articles from the dashboard.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
