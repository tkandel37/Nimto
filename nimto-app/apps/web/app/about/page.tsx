import Link from "next/link";

type PageContent = {
  title: string;
  subtitle?: string | null;
  body?: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getPage(): Promise<PageContent> {
  try {
    const response = await fetch(`${API_URL}/cms/public/pages/about`, {
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
    <main className="site-shell">
      <SimpleHeader />
      <section className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
          About us
        </p>
        <h1 className="mt-5 text-5xl font-black text-ink">{page.title}</h1>
        <p className="mt-6 text-xl leading-8 text-ink/65">{page.subtitle}</p>
        <div className="mt-10 whitespace-pre-wrap text-base leading-8 text-ink/70">
          {page.body}
        </div>
        <div className="mt-10 rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="font-black text-ink">Contact</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Email: trilochan@mynimto.com
          </p>
        </div>
      </section>
    </main>
  );
}

function SimpleHeader() {
  return (
    <header className="site-header">
      <Link className="text-xl font-black text-ink" href="/">
        myNimto
      </Link>
      <nav className="flex flex-wrap items-center gap-5 text-sm font-bold text-ink/65">
        <Link href="/features">Features</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/auth?mode=login">Log in</Link>
      </nav>
    </header>
  );
}
