import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApiUrl } from "@/lib/server-api";
import { PublicSiteShell } from "../../public-site-shell";

type BlogPost = {
  title: string;
  content: string;
  excerpt?: string | null;
  citationSummary?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | null;
  faq?: { question: string; answer: string }[] | null;
  sources?: { label: string; url: string }[] | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  author?: { name: string };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const response = await fetch(`${serverApiUrl}/cms/public/blog/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return {};
    }
    const post = (await response.json()) as BlogPost;
    return {
      title: post.metaTitle ?? post.title,
      description: post.metaDescription ?? post.citationSummary ?? post.excerpt,
      keywords: post.keywords,
      openGraph: {
        title: post.metaTitle ?? post.title,
        description:
          post.metaDescription ?? post.citationSummary ?? post.excerpt,
        type: "article",
      },
    };
  } catch {
    return {};
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let response: Response;
  try {
    response = await fetch(`${serverApiUrl}/cms/public/blog/${slug}`, {
      next: { revalidate: 60 },
    });
  } catch {
    notFound();
  }

  if (!response.ok) {
    notFound();
  }
  const post = (await response.json()) as BlogPost;
  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.citationSummary ?? post.metaDescription ?? post.excerpt,
    author: {
      "@type": "Person",
      name: post.author?.name ?? "myNimto",
    },
    publisher: {
      "@type": "Organization",
      name: "myNimto",
    },
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt ?? post.publishedAt ?? undefined,
    keywords: post.keywords,
    citation: post.sources?.map((source) => source.url),
    mainEntityOfPage: `/blog/${slug}`,
  };
  const faqStructuredData = post.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;
  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "/blog" },
      { "@type": "ListItem", position: 3, name: post.title },
    ],
  };

  return (
    <PublicSiteShell activePage="blog">
      {[articleStructuredData, faqStructuredData, breadcrumbStructuredData]
        .filter(Boolean)
        .map((item, index) => (
          <script
            dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
            key={index}
            type="application/ld+json"
          />
        ))}
      <article className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-leaf">
          Digital invitation guide
        </p>
        <h1 className="mt-5 text-5xl font-black leading-tight text-ink">
          {post.title}
        </h1>
        <p className="mt-5 text-sm font-bold text-ink/45">
          {post.author?.name ? `By ${post.author.name}` : "myNimto"}
          {post.publishedAt
            ? ` / ${new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
              }).format(new Date(post.publishedAt))}`
            : ""}
        </p>
        {post.excerpt ? (
          <p className="mt-8 text-xl leading-8 text-ink/65">{post.excerpt}</p>
        ) : null}
        {post.citationSummary ? (
          <aside className="mt-8 rounded-lg border border-leaf/20 bg-white p-5">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-leaf">
              Quick answer
            </p>
            <p className="mt-3 text-base leading-7 text-ink/70">
              {post.citationSummary}
            </p>
          </aside>
        ) : null}
        <div className="blog-body mt-10 whitespace-pre-wrap text-base leading-8 text-ink/75">
          {post.content}
        </div>
        {post.faq?.length ? (
          <section className="mt-12 border-t border-ink/10 pt-8">
            <h2 className="text-2xl font-black text-ink">
              Frequently asked questions
            </h2>
            <div className="mt-5 grid gap-4">
              {post.faq.map((item) => (
                <article
                  className="rounded-lg border border-ink/10 bg-white p-5"
                  key={item.question}
                >
                  <h3 className="font-black text-ink">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/65">
                    {item.answer}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {post.sources?.length ? (
          <section className="mt-12 border-t border-ink/10 pt-8">
            <h2 className="text-2xl font-black text-ink">
              Sources and references
            </h2>
            <ul className="mt-5 grid gap-2 text-sm leading-6 text-ink/70">
              {post.sources.map((source) => (
                <li key={`${source.label}-${source.url}`}>
                  <a className="font-bold text-leaf" href={source.url}>
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </PublicSiteShell>
  );
}
