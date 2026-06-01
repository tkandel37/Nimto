"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, AuthUser } from "@/lib/api";

const templates = [
  {
    title: "Classic Wedding",
    tone: "Marigold florals, formal RSVP, family-focused details",
  },
  {
    title: "Birthday Spark",
    tone: "Bright layout, photo hero, quick WhatsApp sharing",
  },
  {
    title: "Corporate Invite",
    tone: "Clean agenda, venue map, attendee confirmation",
  },
];

const menuItems = [
  { label: "Dashboard", permission: null },
  { label: "Roles", permission: "roles:view" },
  { label: "Permissions", permission: "permissions:view" },
  { label: "Staff", permission: "staff:view" },
  { label: "Sessions", permission: "sessions:view" },
  { label: "Audit Logs", permission: "audit:view" },
];

function can(user: AuthUser | null, permission: string | null) {
  if (!permission) {
    return true;
  }

  return Boolean(
    user?.permissions?.includes("*") || user?.permissions?.includes(permission),
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("nimto_token");

    if (!token) {
      router.replace("/auth?mode=login");
      return;
    }

    apiRequest<{ user: AuthUser }>("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        setUser(response.user);
        localStorage.setItem("nimto_user", JSON.stringify(response.user));
      })
      .catch(() => {
        localStorage.removeItem("nimto_token");
        localStorage.removeItem("nimto_user");
        router.replace("/auth?mode=login");
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  async function logout() {
    const token = localStorage.getItem("nimto_token");
    if (token) {
      try {
        await apiRequest("/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error("Logout failed on server", error);
      }
    }
    localStorage.removeItem("nimto_token");
    localStorage.removeItem("nimto_user");
    router.replace("/");
  }

  if (isLoading && !user) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="font-bold text-ink">Checking your session...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <Link href="/" className="text-2xl font-black uppercase tracking-[0.28em] text-marigold">
          Nimto
        </Link>
        <p className="mt-3 text-sm leading-6 text-white/65">
          Digital invitation workspace
        </p>
        <nav className="mt-10 grid gap-3 text-sm font-bold">
          {menuItems
            .filter((item) => can(user, item.permission))
            .map((item, index) => (
              <span
                className={
                  index === 0
                    ? "rounded-xl bg-white/10 px-4 py-3"
                    : "rounded-xl px-4 py-3 text-white/60"
                }
                key={item.label}
              >
                {item.label}
              </span>
            ))}
        </nav>
      </aside>

      <section className="p-6 md:p-10">
        <header className="flex flex-col gap-4 border-b border-ink/10 pb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
              Connected account
            </p>
            <h1 className="mt-3 text-4xl font-black text-ink">
              Welcome, {user?.name ?? "creator"}
            </h1>
            <p className="mt-2 text-ink/65">{user?.email}</p>
            {user?.roles?.length ? (
              <p className="mt-2 text-sm font-bold text-ink/45">
                {user.roles.join(", ")}
              </p>
            ) : null}
          </div>
          <button
            className="rounded-xl border border-ink/20 bg-white px-5 py-3 font-bold text-ink"
            onClick={logout}
            type="button"
          >
            Log out
          </button>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="metric">
            <p className="text-sm font-bold text-ink/55">Deployment</p>
            <h2 className="mt-2 text-2xl font-black text-leaf">API verified</h2>
          </div>
          <div className="metric">
            <p className="text-sm font-bold text-ink/55">Database</p>
            <h2 className="mt-2 text-2xl font-black text-marigold">User saved</h2>
          </div>
          <div className="metric">
            <p className="text-sm font-bold text-ink/55">Auth</p>
            <h2 className="mt-2 text-2xl font-black text-rose">JWT active</h2>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
                Glimpse
              </p>
              <h2 className="mt-3 text-3xl font-black text-ink">
                What Nimto will become
              </h2>
            </div>
            {can(user, "roles:manage") ? (
              <button
                className="rounded-xl bg-ink px-5 py-3 font-bold text-white"
                type="button"
              >
                Manage roles
              </button>
            ) : null}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {templates.map((template) => (
              <article
                className="border border-ink/10 bg-paper p-5 shadow-sm"
                key={template.title}
              >
                <div className="aspect-[4/3] border border-ink/10 bg-[url('/invitation-preview.svg')] bg-cover" />
                <h3 className="mt-5 text-xl font-black text-ink">{template.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink/65">{template.tone}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
