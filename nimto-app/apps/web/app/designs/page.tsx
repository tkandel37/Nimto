import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  subcategories?: { id: string; name: string; slug: string }[];
};

type PublicDesign = {
  id: string;
  name: string;
  slug: string;
  category?: Pick<PublicCategory, "id" | "name" | "slug"> | null;
  subcategory?: { id: string; name: string; slug: string } | null;
  versions: {
    id: string;
    versionNumber: number;
    rawHtml: string;
    htmlSize: number;
  }[];
};

async function getCategories() {
  try {
    const response = await fetch(`${API_URL}/template-design/public/categories`, {
      next: { revalidate: 60 },
    });
    if (response.ok) return response.json() as Promise<PublicCategory[]>;
  } catch {}
  return [];
}

async function getDesigns(params: Record<string, string>) {
  const query = new URLSearchParams();
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.subcategoryId) query.set("subcategoryId", params.subcategoryId);
  if (params.search) query.set("search", params.search);

  try {
    const response = await fetch(
      `${API_URL}/template-design/public/designs?${query.toString()}`,
      { next: { revalidate: 30 } },
    );
    if (response.ok) return response.json() as Promise<PublicDesign[]>;
  } catch {}
  return [];
}

export default async function DesignsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  const params = (await searchParams) ?? {};
  const [categories, designs] = await Promise.all([
    getCategories(),
    getDesigns(params),
  ]);

  return (
    <main className="site-shell">
      <SimpleHeader />
      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-ink">Designs</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink/60">
              Browse current invitation designs and preview the real HTML before
              creating your event.
            </p>
          </div>
          <form className="flex w-full gap-2 md:w-auto">
            <input
              className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-4 py-3"
              defaultValue={params.search ?? ""}
              name="search"
              placeholder="Search designs"
            />
            <button className="rounded-lg bg-ink px-5 py-3 font-bold text-white">
              Search
            </button>
          </form>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            className={`rounded-lg px-4 py-2 text-sm font-bold ${
              params.categoryId ? "bg-white text-ink" : "bg-leaf text-white"
            }`}
            href="/designs"
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                params.categoryId === category.id
                  ? "bg-leaf text-white"
                  : "bg-white text-ink"
              }`}
              href={`/designs?categoryId=${category.id}`}
              key={category.id}
            >
              {category.name}
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {designs.map((design) => {
            const current = design.versions[0];
            return (
              <article
                className="overflow-hidden rounded-lg border border-ink/10 bg-white"
                key={design.id}
              >
                <iframe
                  className="h-[420px] w-full border-0 bg-white"
                  sandbox="allow-scripts"
                  srcDoc={current?.rawHtml ?? ""}
                  title={`${design.name} preview`}
                />
                <div className="border-t border-ink/10 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-xl font-black text-ink">
                        {design.name}
                      </h2>
                      <p className="mt-1 text-sm text-ink/50">
                        {[design.category?.name, design.subcategory?.name]
                          .filter(Boolean)
                          .join(" / ") || "Uncategorized"}
                      </p>
                    </div>
                    <span className="rounded-md bg-leaf/10 px-3 py-1 text-sm font-black text-leaf">
                      v{current?.versionNumber ?? 1}
                    </span>
                  </div>
                  <Link
                    className="mt-4 inline-flex rounded-lg bg-ink px-4 py-3 font-bold text-white"
                    href={`/dashboard?designId=${design.id}`}
                  >
                    Select design
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {designs.length ? null : (
          <div className="mt-8 rounded-lg border border-ink/10 bg-white p-6">
            <h2 className="text-xl font-black text-ink">No designs found</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Try another category or search term.
            </p>
          </div>
        )}
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
        <Link href="/designs">Designs</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/about">About</Link>
        <Link className="site-login-button" href="/auth?mode=login">
          Log in
        </Link>
      </nav>
    </header>
  );
}
