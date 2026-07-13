"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { usePathname, useRouter } from "next/navigation";
import { AuthUser } from "@/lib/api";

type AdminTabKey =
  | "overview"
  | "events"
  | "designSetup"
  | "website"
  | "roles"
  | "permissions"
  | "users"
  | "staff"
  | "sessions"
  | "audit";

type AdminIconName =
  | "dashboard"
  | "events"
  | "design"
  | "website"
  | "roles"
  | "permissions"
  | "users"
  | "staff"
  | "sessions"
  | "audit";

const adminTabs: {
  key: AdminTabKey;
  label: string;
  icon: AdminIconName;
  permission: string | null;
  href: string;
  group: "Workspace" | "Access" | "Operations";
}[] = [
  {
    key: "overview",
    label: "Dashboard",
    icon: "dashboard",
    permission: null,
    href: "/dashboard",
    group: "Workspace",
  },
  {
    key: "events",
    label: "Events",
    icon: "events",
    permission: null,
    href: "/event-management",
    group: "Workspace",
  },
  {
    key: "designSetup",
    label: "Design Setup",
    icon: "design",
    permission: null,
    href: "/design-setup",
    group: "Workspace",
  },
  {
    key: "website",
    label: "Website",
    icon: "website",
    permission: null,
    href: "/website",
    group: "Workspace",
  },
  {
    key: "users",
    label: "Users",
    icon: "users",
    permission: "staff:view",
    href: "/users",
    group: "Access",
  },
  {
    key: "staff",
    label: "Staff",
    icon: "staff",
    permission: "staff:view",
    href: "/staff",
    group: "Access",
  },
  {
    key: "roles",
    label: "Roles",
    icon: "roles",
    permission: "roles:view",
    href: "/roles",
    group: "Access",
  },
  {
    key: "permissions",
    label: "Permissions",
    icon: "permissions",
    permission: "permissions:view",
    href: "/permissions",
    group: "Access",
  },
  {
    key: "sessions",
    label: "Sessions",
    icon: "sessions",
    permission: "sessions:view",
    href: "/sessions",
    group: "Operations",
  },
  {
    key: "audit",
    label: "Audit log",
    icon: "audit",
    permission: "audit:view",
    href: "/audit",
    group: "Operations",
  },
];

const adminPathToTab: Record<string, AdminTabKey | "settings"> = {
  "/audit": "audit",
  "/dashboard": "overview",
  "/event-management": "events",
  "/design-setup": "designSetup",
  "/permissions": "permissions",
  "/roles": "roles",
  "/sessions": "sessions",
  "/settings": "settings",
  "/staff": "staff",
  "/users": "users",
  "/website": "website",
};

function can(user: AuthUser | null, permission: string | null) {
  if (!permission) return true;
  return Boolean(
    user?.permissions?.includes("*") || user?.permissions?.includes(permission),
  );
}

function canAny(user: AuthUser | null, permissions: string[]) {
  return Boolean(
    user?.permissions?.includes("*") ||
    permissions.some((permission) => user?.permissions?.includes(permission)),
  );
}

function isAdminPath(pathname: string) {
  return pathname in adminPathToTab;
}

export function AdminFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const activeTab = adminPathToTab[pathname] ?? "overview";
  const isAdmin = isAdminPath(pathname);

  useEffect(() => {
    if (!isAdmin) return;

    const savedUser = localStorage.getItem("nimto_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser) as AuthUser);
      } catch {
        localStorage.removeItem("nimto_user");
      }
    }
  }, [isAdmin, pathname]);

  const visibleTabs = useMemo(
    () =>
      adminTabs.filter((tab) => {
        if (!user) {
          return true;
        }

        if (tab.key === "designSetup") {
          return canAny(user, [
            "template:view:own",
            "template:view:all",
            "template:create",
            "template:update:own",
            "template:update:all",
            "template:duplicate",
            "design:view:own",
            "design:view:all",
          ]);
        }

        if (tab.key === "website") {
          return canAny(user, [
            "content:manage",
            "blog:manage:own",
            "blog:manage:all",
          ]);
        }

        return can(user, tab.permission);
      }),
    [user],
  );

  useEffect(() => {
    if (!isAdmin) return;

    const hrefs = new Set(visibleTabs.map((tab) => tab.href));

    if (
      canAny(user, [
        "category:view",
        "category:manage",
        "subcategory:view",
        "subcategory:manage",
      ])
    ) {
      hrefs.add("/settings");
    }

    hrefs.forEach((href) => router.prefetch(href));
  }, [isAdmin, router, user, visibleTabs]);

  if (!isAdmin) {
    return <>{children}</>;
  }

  return (
    <main
      className={`dashboard-shell ${
        isSidebarCollapsed ? "sidebar-collapsed" : ""
      }`}
    >
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand-row">
            <Link href="/dashboard" className="sidebar-logo">
              <BrandLogo className="sidebar-logo-full" />
              <BrandLogo className="sidebar-logo-mark" compact />
            </Link>
            <button
              aria-label={
                isSidebarCollapsed ? "Expand navigation" : "Minimize navigation"
              }
              className="sidebar-collapse-button"
              data-tooltip={
                isSidebarCollapsed ? "Expand navigation" : "Minimize navigation"
              }
              onClick={() =>
                setIsSidebarCollapsed((isCollapsed) => !isCollapsed)
              }
              title={
                isSidebarCollapsed ? "Expand navigation" : "Minimize navigation"
              }
              type="button"
            >
              <CollapseIcon isCollapsed={isSidebarCollapsed} />
            </button>
          </div>
        </div>

        <nav className="mt-8 grid gap-5 text-sm font-bold">
          {(["Workspace", "Access", "Operations"] as const).map((group) => {
            const tabs = visibleTabs.filter((tab) => tab.group === group);
            if (!tabs.length) return null;
            return (
              <div className="sidebar-nav-group" key={group}>
                <p className="sidebar-nav-label">{group}</p>
                <div className="mt-2 grid gap-1.5">
                  {tabs.map((tab) => (
                    <Link
                      aria-current={activeTab === tab.key ? "page" : undefined}
                      aria-label={tab.label}
                      className={
                        activeTab === tab.key
                          ? "dashboard-tab dashboard-tab-active"
                          : "dashboard-tab"
                      }
                      href={tab.href}
                      key={tab.key}
                      data-tooltip={tab.label}
                      title={tab.label}
                    >
                      <AdminTabIcon icon={tab.icon} />
                      <span className="sidebar-tab-label">{tab.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer mt-auto grid gap-3 border-t border-white/10 pt-4">
          {!user ||
          canAny(user, [
            "category:view",
            "category:manage",
            "subcategory:view",
            "subcategory:manage",
          ]) ? (
            <Link
              aria-current={activeTab === "settings" ? "page" : undefined}
              aria-label="Settings"
              className={
                activeTab === "settings"
                  ? "dashboard-tab dashboard-tab-active"
                  : "dashboard-tab"
              }
              data-tooltip="Settings"
              href="/settings"
              title="Settings"
            >
              <SettingsIcon />
              <span className="sidebar-tab-label">Settings</span>
            </Link>
          ) : null}
        </div>
      </aside>

      <section className="dashboard-main">{children}</section>
    </main>
  );
}

function AdminTabIcon({ icon }: { icon: AdminIconName }) {
  const paths: Record<AdminIconName, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </>
    ),
    events: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" />
      </>
    ),
    design: (
      <>
        <path d="M4 20h16" />
        <path d="m6 16 8.5-8.5 2 2L8 18H6v-2Z" />
        <path d="m13.5 7.5 1.8-1.8a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2l-1.8 1.8" />
      </>
    ),
    website: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
    roles: (
      <>
        <path d="M16 11a4 4 0 1 0-8 0" />
        <path d="M5 21a7 7 0 0 1 14 0" />
        <path d="M19 5l1.5 1.5L23 4" />
      </>
    ),
    permissions: (
      <>
        <path d="M12 3 5 6v5c0 4.5 3 7.5 7 10 4-2.5 7-5.5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    staff: (
      <>
        <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a6 6 0 0 1 12 0" />
        <path d="M17 8a3 3 0 1 1 0 6M16 21a5 5 0 0 1 5-5" />
      </>
    ),
    users: (
      <>
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    sessions: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M8 21h8M12 17v4M8 10h8" />
      </>
    ),
    audit: (
      <>
        <path d="M7 3h10l2 2v16H5V5l2-2Z" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {paths[icon]}
    </svg>
  );
}

function CollapseIcon({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d={isCollapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.8"
      />
      <path
        d={isCollapsed ? "M4 4v16" : "M20 4v16"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.8"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path
        d="M19.4 15a8 8 0 0 0 .1-2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L15 5h-4l-.4 3.1a8 8 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a8 8 0 0 0 .1 2l-2.1 1.5 2 3.4 2.5-1a8 8 0 0 0 1.7.9L11 23h4l.4-3.2a8 8 0 0 0 1.7-.9l2.5 1 2-3.4-2.2-1.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.1"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path
        d="M4 21a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}
