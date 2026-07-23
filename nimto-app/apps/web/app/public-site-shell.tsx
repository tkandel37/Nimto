import Link from "next/link";
import type { ReactNode } from "react";
import { AuthAwareAccountLink } from "./auth-aware-account-link";
import { BrandLogo } from "./brand-logo";

export type PublicPage = "home" | "designs" | "features" | "blog" | "about";

const publicLinks: {
  href: string;
  label: string;
  page: PublicPage;
}[] = [
  { href: "/", label: "Home", page: "home" },
  { href: "/designs", label: "Designs", page: "designs" },
  { href: "/features", label: "Features", page: "features" },
  { href: "/blog", label: "Blog", page: "blog" },
  { href: "/about", label: "About", page: "about" },
];

export function PublicSiteShell({
  activePage,
  children,
}: {
  activePage: PublicPage;
  children: ReactNode;
}) {
  return (
    <main className="site-shell public-site-shell">
      <aside className="public-site-rail">
        <Link className="public-site-logo" href="/" aria-label="myNimto home">
          <BrandLogo priority={activePage === "home"} />
        </Link>
        <PublicNavigation activePage={activePage} />
        <p className="public-site-rail-note">
          Browse first.
          <span>Sign in when you are ready.</span>
        </p>
      </aside>

      <section className="public-site-main">
        <header className="public-site-authbar">
          <Link
            className="public-site-mobile-logo"
            href="/"
            aria-label="myNimto home"
          >
            <BrandLogo compact priority={activePage === "home"} />
          </Link>
          <AuthAwareAccountLink className="site-login-button" />
        </header>
        <div className="public-site-mobile-nav">
          <PublicNavigation activePage={activePage} />
        </div>
        {children}
      </section>
    </main>
  );
}

function PublicNavigation({ activePage }: { activePage: PublicPage }) {
  return (
    <nav className="public-site-nav" aria-label="Explore myNimto">
      {publicLinks.map((link) => (
        <Link
          aria-current={activePage === link.page ? "page" : undefined}
          className={
            activePage === link.page
              ? "public-site-nav-link active"
              : "public-site-nav-link"
          }
          href={link.href}
          key={link.page}
        >
          <strong>{link.label}</strong>
        </Link>
      ))}
    </nav>
  );
}
