import Link from "next/link";
import { notFound } from "next/navigation";

type BlogPost = {
  title: string;
  content: string;
  excerpt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | null;
  publishedAt?: string | null;
  author?: { name: string };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const response = await fetch(`${API_URL}/cms/public/blog/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return {};
    }
    const post = (await response.json()) as BlogPost;
    return {
      title: post.metaTitle ?? post.title,
      description: post.metaDescription ?? post.excerpt,
      keywords: post.keywords,
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
    response = await fetch(`${API_URL}/cms/public/blog/${slug}`, {
      next: { revalidate: 60 },
    });
  } catch {
    notFound();
  }

  if (!response.ok) {
    notFound();
  }
  const post = (await response.json()) as BlogPost;

  return (
    <main className="site-shell">
      <header className="site-header">
        <Link className="text-xl font-black text-ink" href="/">
          myNimto
        </Link>
        <nav className="flex flex-wrap items-center gap-5 text-sm font-bold text-ink/65">
          <Link href="/blog">Blog</Link>
          <Link href="/features">Features</Link>
          <Link href="/about">About</Link>
        </nav>
      </header>
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
        <div className="blog-body mt-10 whitespace-pre-wrap text-base leading-8 text-ink/75">
          {post.content}
        </div>
      </article>
    </main>
  );
}
