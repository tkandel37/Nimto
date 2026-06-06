"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest, AuthUser } from "@/lib/api";

type Permission = {
  id: string;
  key: string;
  description: string | null;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: Permission }[];
  _count?: { users: number };
};

type Staff = {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "BLOCKED" | "DEACTIVATED" | "PENDING_DELETION";
  createdAt: string;
  lastLoginAt?: string | null;
  roles: { role: Pick<Role, "id" | "name" | "isSystem"> }[];
};

type Session = {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
  userAgent?: string | null;
  user: Pick<Staff, "id" | "name" | "email" | "status">;
};

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  actor?: Pick<AuthUser, "id" | "name" | "email"> | null;
};

type EventType = "WEDDING" | "BIRTHDAY" | "CORPORATE" | "OTHER";
type DesignCatalogStatus = "ACTIVE" | "INACTIVE";

type InvitationEvent = {
  id: string;
  title: string;
  type: EventType;
  eventDate?: string | null;
  venue?: string | null;
  description?: string | null;
  slug: string;
  coverImage?: string | null;
  isPublished: boolean;
  designVersionId?: string | null;
  designFieldValues?: Record<string, string> | null;
  designVersion?: {
    id: string;
    versionNumber: number;
    design: { id: string; name: string; slug: string; status: string };
  } | null;
  createdAt: string;
  updatedAt: string;
};

type DesignSubcategory = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  status: DesignCatalogStatus;
  createdAt: string;
  updatedAt: string;
  category?: Pick<DesignCategory, "id" | "name" | "slug" | "status">;
};

type DesignCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  status: DesignCatalogStatus;
  createdAt: string;
  updatedAt: string;
  subcategories?: DesignSubcategory[];
};

type InvitationTemplate = {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  rawHtml?: string;
  sourceFileName?: string | null;
  htmlSize: number;
  scanResult?: {
    sections?: { key: string; label: string }[];
    fields?: {
      key: string;
      label: string;
      type: string;
      required: boolean;
      paid: boolean;
      locked: boolean;
    }[];
    countdownFieldKey?: string;
    customNameFieldKeys?: string[];
    hasGallery?: boolean;
    hasMusic?: boolean;
    hasMap?: boolean;
  } | null;
  scannedAt?: string | null;
  designId?: string | null;
  design?: {
    id: string;
    slug: string;
    status: "ACTIVE" | "UNPUBLISHED";
    versions?: {
      id: string;
      versionNumber: number;
      status: "CURRENT" | "SUPERSEDED";
      createdAt?: string;
    }[];
  } | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Pick<DesignCategory, "id" | "name" | "slug"> | null;
  subcategory?: Pick<DesignSubcategory, "id" | "name" | "slug"> | null;
  createdBy?: Pick<AuthUser, "id" | "name" | "email"> | null;
};

type InvitationDesign = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "UNPUBLISHED";
  category?: Pick<DesignCategory, "id" | "name" | "slug"> | null;
  subcategory?: Pick<DesignSubcategory, "id" | "name" | "slug"> | null;
  createdBy?: Pick<AuthUser, "id" | "name" | "email"> | null;
  versions: {
    id: string;
    versionNumber: number;
    status: "CURRENT" | "SUPERSEDED";
    htmlSize: number;
    scanResult?: InvitationTemplate["scanResult"];
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
};

type PageContent = {
  id: string;
  key: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  updatedAt: string;
};

type TemplateEditorField = {
  key: string;
  label: string;
  type: string;
  sectionKey?: string;
  required: boolean;
  paid: boolean;
  locked: boolean;
  value: string;
};

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  citationSummary?: string | null;
  content: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string | null;
  faq?: { question: string; answer: string }[] | null;
  sources?: { label: string; url: string }[] | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
  updatedAt: string;
  author?: Pick<AuthUser, "id" | "name" | "email">;
};

type TabKey =
  | "overview"
  | "events"
  | "designSetup"
  | "settings"
  | "profile"
  | "website"
  | "roles"
  | "permissions"
  | "staff"
  | "sessions"
  | "audit";

const tabs: { key: TabKey; label: string; permission: string | null }[] = [
  { key: "overview", label: "Dashboard", permission: null },
  { key: "events", label: "Events", permission: null },
  { key: "designSetup", label: "Design Setup", permission: null },
  { key: "website", label: "Website", permission: null },
  { key: "roles", label: "Roles", permission: "roles:view" },
  { key: "permissions", label: "Permissions", permission: "permissions:view" },
  { key: "staff", label: "Staff", permission: "staff:view" },
  { key: "sessions", label: "Sessions", permission: "sessions:view" },
  { key: "audit", label: "Audit Logs", permission: "audit:view" },
];

const statuses: Staff["status"][] = [
  "ACTIVE",
  "BLOCKED",
  "DEACTIVATED",
  "PENDING_DELETION",
];

const eventTypes: EventType[] = ["WEDDING", "BIRTHDAY", "CORPORATE", "OTHER"];
const pageKeys = ["landing", "about", "features"];

function can(user: AuthUser | null, permission: string | null) {
  if (!permission) {
    return true;
  }

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

function displayDate(value?: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ProfileIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M4 20a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 0 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M15 18 9 12l6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.8"
      />
    </svg>
  );
}

function CollapseIcon({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      {isCollapsed ? (
        <path
          d="m9 6 6 6-6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.8"
        />
      ) : (
        <path
          d="m15 6-6 6 6 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.8"
        />
      )}
      <path
        d="M4 5v14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.8"
      />
    </svg>
  );
}

function FormIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.8"
      />
      <path
        d="M8 8h8M8 12h8M8 16h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.8"
      />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m8 9-3 3 3 3M16 9l3 3-3 3M14 5l-4 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.8"
      />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.8"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.8"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [events, setEvents] = useState<InvitationEvent[]>([]);
  const [designCategories, setDesignCategories] = useState<DesignCategory[]>(
    [],
  );
  const [templates, setTemplates] = useState<InvitationTemplate[]>([]);
  const [designs, setDesigns] = useState<InvitationDesign[]>([]);
  const [publicDesigns, setPublicDesigns] = useState<InvitationDesign[]>([]);
  const [pages, setPages] = useState<PageContent[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  const visibleTabs = useMemo(
    () =>
      tabs.filter((tab) => {
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
        if (tab.key === "settings") {
          return canAny(user, [
            "category:view",
            "category:manage",
            "subcategory:view",
            "subcategory:manage",
          ]);
        }

        return tab.key === "website"
          ? canAny(user, [
              "content:manage",
              "blog:manage:own",
              "blog:manage:all",
            ])
          : can(user, tab.permission);
      }),
    [user],
  );
  const currentTab =
    activeTab === "profile" ||
    (activeTab === "settings" &&
      canAny(user, [
        "category:view",
        "category:manage",
        "subcategory:view",
        "subcategory:manage",
      ])) ||
    visibleTabs.some((tab) => tab.key === activeTab)
      ? activeTab
      : "overview";

  useEffect(() => {
    const savedToken = localStorage.getItem("nimto_token");

    if (!savedToken) {
      router.replace("/auth?mode=login");
      return;
    }

    apiRequest<{ user: AuthUser }>("/auth/me", {
      headers: {
        Authorization: `Bearer ${savedToken}`,
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

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      const savedToken = localStorage.getItem("nimto_token");
      if (!savedToken) {
        throw new Error("Missing auth token.");
      }

      return apiRequest<T>(path, {
        ...options,
        headers: {
          Authorization: `Bearer ${savedToken}`,
          ...options.headers,
        },
      });
    },
    [],
  );

  const refreshAdminData = useCallback(
    async (authUser = user) => {
      const savedToken = localStorage.getItem("nimto_token");
      if (!savedToken || !authUser) {
        return;
      }

      setIsRefreshing(true);
      setError("");

      try {
        const headers = { Authorization: `Bearer ${savedToken}` };
        const results = await Promise.all([
          apiRequest<InvitationEvent[]>("/events", { headers }),
          can(authUser, "permissions:view")
            ? apiRequest<Permission[]>("/admin/permissions", { headers })
            : Promise.resolve([]),
          can(authUser, "roles:view")
            ? apiRequest<Role[]>("/admin/roles", { headers })
            : Promise.resolve([]),
          can(authUser, "staff:view")
            ? apiRequest<Staff[]>("/admin/staff", { headers })
            : Promise.resolve([]),
          can(authUser, "sessions:view")
            ? apiRequest<Session[]>("/admin/sessions", { headers })
            : Promise.resolve([]),
          can(authUser, "audit:view")
            ? apiRequest<AuditLog[]>("/admin/audit-logs", { headers })
            : Promise.resolve([]),
          canAny(authUser, [
            "category:view",
            "category:manage",
            "subcategory:view",
            "subcategory:manage",
          ])
            ? apiRequest<DesignCategory[]>("/template-design/categories", {
                headers,
              })
            : Promise.resolve([]),
          canAny(authUser, [
            "template:view:own",
            "template:view:all",
            "template:create",
            "template:update:own",
            "template:update:all",
            "template:duplicate",
          ])
            ? apiRequest<InvitationTemplate[]>("/template-design/templates", {
                headers,
              })
            : Promise.resolve([]),
          canAny(authUser, ["design:view:own", "design:view:all"])
            ? apiRequest<InvitationDesign[]>("/template-design/designs", {
                headers,
              })
            : Promise.resolve([]),
          can(authUser, "content:manage")
            ? apiRequest<PageContent[]>("/cms/admin/pages", { headers })
            : Promise.resolve([]),
          canAny(authUser, ["blog:manage:own", "blog:manage:all"])
            ? apiRequest<BlogPost[]>("/cms/admin/blog", { headers })
            : Promise.resolve([]),
        ]);

        setEvents(results[0]);
        setPermissions(results[1]);
        setRoles(results[2]);
        setStaff(results[3]);
        setSessions(results[4]);
        setAuditLogs(results[5]);
        setDesignCategories(results[6]);
        setTemplates(results[7]);
        setDesigns(results[8]);
        setPages(results[9]);
        setBlogPosts(results[10]);
        setPublicDesigns(
          await apiRequest<InvitationDesign[]>("/template-design/public/designs"),
        );
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load admin data.",
        );
      } finally {
        setIsRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    void Promise.resolve().then(() => refreshAdminData(user));
  }, [refreshAdminData, user]);

  async function logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch (caughtError) {
      console.error("Logout failed on server", caughtError);
    }

    localStorage.removeItem("nimto_token");
    localStorage.removeItem("nimto_user");
    router.replace("/");
  }

  async function completeAction(
    action: () => Promise<unknown>,
    message: string,
  ) {
    setError("");
    setNotice("");

    try {
      await action();
      await refreshAdminData();
      setNotice(message);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The action could not be completed.",
      );
    }
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
        <div>
          <Link
            href="/"
            className="text-2xl font-black uppercase tracking-[0.22em] text-marigold"
          >
            Nimto
          </Link>
          <p className="mt-3 text-sm leading-6 text-white/68">
            Invitation workspace for events, content, staff, and roles.
          </p>
        </div>
        <nav className="mt-10 grid gap-2 text-sm font-bold">
          {visibleTabs.map((tab) => (
            <button
              className={
                currentTab === tab.key
                  ? "dashboard-tab dashboard-tab-active"
                  : "dashboard-tab"
              }
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
          {canAny(user, [
            "category:view",
            "category:manage",
            "subcategory:view",
            "subcategory:manage",
          ]) ? (
            <button
              className={
                currentTab === "settings"
                  ? "sidebar-icon-tab sidebar-icon-tab-active"
                  : "sidebar-icon-tab"
              }
              aria-label="Settings"
              onClick={() => setActiveTab("settings")}
              title="Settings"
              type="button"
            >
              <SettingsIcon />
            </button>
          ) : null}
          <button
            className={
              currentTab === "profile"
                ? "sidebar-icon-tab sidebar-icon-tab-active"
                : "sidebar-icon-tab"
            }
            aria-label="Profile"
            onClick={() => setActiveTab("profile")}
            title="Profile"
            type="button"
          >
            <ProfileIcon />
          </button>
        </div>
      </aside>

      <section className="min-w-0 p-4 md:p-8">
        {currentTab === "settings" ? (
        <header className="dashboard-hero">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-leaf">
              Connected account
            </p>
            <h1 className="mt-3 text-3xl font-black text-ink md:text-5xl">
              {user?.name ?? "Creator"}
            </h1>
            <p className="mt-2 break-all text-ink/65">{user?.email}</p>
            {user?.roles?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <span className="role-chip" key={role}>
                    {role}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="dashboard-button-secondary"
              disabled={isRefreshing}
              onClick={() => refreshAdminData()}
              type="button"
            >
              Refresh
            </button>
            <button
              className="dashboard-button-secondary"
              onClick={logout}
              type="button"
            >
              Log out
            </button>
          </div>
        </header>
        ) : null}

        {notice ? (
          <p className="mt-5 rounded-lg border border-leaf/20 bg-leaf/10 p-3 text-sm font-bold text-leaf">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 rounded-lg border border-rose/20 bg-rose/10 p-3 text-sm font-bold text-rose">
            {error}
          </p>
        ) : null}

        {currentTab === "overview" ? (
          <OverviewPanel
            auditCount={auditLogs.length}
            eventCount={events.length}
            roleCount={roles.length}
            sessionCount={
              sessions.filter((session) => !session.revokedAt).length
            }
            staffCount={staff.length}
          />
        ) : null}
        {currentTab === "events" ? (
          <EventsPanel
            completeAction={completeAction}
            designs={publicDesigns}
            events={events}
            request={request}
          />
        ) : null}
        {currentTab === "designSetup" ? (
          <DesignSetupPanel
            canCreateTemplates={can(user, "template:create")}
            canDuplicateTemplates={can(user, "template:duplicate")}
            canPublishTemplates={can(user, "template:publish")}
            canUnpublishTemplates={can(user, "template:unpublish")}
            canUpdateTemplates={canAny(user, [
              "template:update:own",
              "template:update:all",
            ])}
            categories={designCategories}
            completeAction={completeAction}
            designs={designs}
            request={request}
            templates={templates}
          />
        ) : null}
        {currentTab === "settings" ? (
          <SettingsPanel
            canManageCategories={can(user, "category:manage")}
            canManageSubcategories={can(user, "subcategory:manage")}
            categories={designCategories}
            completeAction={completeAction}
            request={request}
          />
        ) : null}
        {currentTab === "profile" ? (
          <ProfilePanel logout={logout} refresh={() => refreshAdminData()} user={user} />
        ) : null}
        {currentTab === "website" ? (
          <WebsitePanel
            canManageBlog={canAny(user, ["blog:manage:own", "blog:manage:all"])}
            canManageContent={can(user, "content:manage")}
            completeAction={completeAction}
            pages={pages}
            posts={blogPosts}
            request={request}
          />
        ) : null}
        {currentTab === "roles" && can(user, "roles:view") ? (
          <RolesPanel
            canManage={can(user, "roles:manage")}
            completeAction={completeAction}
            permissions={permissions}
            request={request}
            roles={roles}
          />
        ) : null}
        {currentTab === "permissions" && can(user, "permissions:view") ? (
          <PermissionsPanel
            canManage={can(user, "permissions:manage")}
            completeAction={completeAction}
            permissions={permissions}
            request={request}
            roles={roles}
          />
        ) : null}
        {currentTab === "staff" && can(user, "staff:view") ? (
          <StaffPanel
            canManage={can(user, "staff:manage")}
            completeAction={completeAction}
            request={request}
            roles={roles}
            staff={staff}
          />
        ) : null}
        {currentTab === "sessions" && can(user, "sessions:view") ? (
          <SessionsPanel
            canManage={can(user, "sessions:manage")}
            completeAction={completeAction}
            request={request}
            sessions={sessions}
          />
        ) : null}
        {currentTab === "audit" && can(user, "audit:view") ? (
          <AuditPanel logs={auditLogs} />
        ) : null}
      </section>
    </main>
  );
}

function OverviewPanel({
  auditCount,
  eventCount,
  roleCount,
  sessionCount,
  staffCount,
}: {
  auditCount: number;
  eventCount: number;
  roleCount: number;
  sessionCount: number;
  staffCount: number;
}) {
  return (
    <section className="mt-7 grid gap-6">
      <div className="dashboard-welcome">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-marigold">
            Before Module 2
          </p>
          <h2 className="mt-3 text-2xl font-black text-ink md:text-3xl">
            A cleaner base for events, templates, and designs.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/62">
            This dashboard now separates the creator workspace feeling from the
            admin controls, so the next template and design module can sit here
            naturally.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Events" value={eventCount} tone="text-leaf" />
        <Metric label="Roles" value={roleCount} tone="text-leaf" />
        <Metric label="Staff" value={staffCount} tone="text-marigold" />
        <Metric label="Active sessions" value={sessionCount} tone="text-rose" />
        <Metric label="Audit events" value={auditCount} tone="text-ink" />
      </div>
    </section>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <div className="metric rounded-lg">
      <p className="text-sm font-bold text-ink/55">{label}</p>
      <h2 className={`mt-2 text-3xl font-black ${tone}`}>{value}</h2>
    </div>
  );
}

function EventsPanel({
  completeAction,
  designs,
  events,
  request,
}: {
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  designs: InvitationDesign[];
  events: InvitationEvent[];
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
}) {
  const [selectedEventId, setSelectedEventId] = useState("");
  const selectedEvent =
    events.find((invitationEvent) => invitationEvent.id === selectedEventId) ??
    null;

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await completeAction(
      () =>
        request("/events", {
          method: "POST",
          body: JSON.stringify(eventPayload(form)),
        }),
      "Event created.",
    );
    event.currentTarget.reset();
  }

  async function updateEvent(
    browserEvent: FormEvent<HTMLFormElement>,
    invitationEvent: InvitationEvent,
  ) {
    browserEvent.preventDefault();
    const form = new FormData(browserEvent.currentTarget);

    await completeAction(
      () =>
        request(`/events/${invitationEvent.id}`, {
          method: "PATCH",
          body: JSON.stringify(eventPayload(form)),
        }),
      "Event updated.",
    );
  }

  async function deleteEvent(invitationEvent: InvitationEvent) {
    await completeAction(
      () => request(`/events/${invitationEvent.id}`, { method: "DELETE" }),
      "Event deleted.",
    );
    setSelectedEventId("");
  }

  if (selectedEvent) {
    return (
      <section className="mt-7 grid gap-5">
        <button
          className="w-fit rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
          onClick={() => setSelectedEventId("")}
          type="button"
        >
          Back to events
        </button>
        <form
          className="border border-ink/10 bg-white p-5"
          onSubmit={(event) => updateEvent(event, selectedEvent)}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-ink">
                {selectedEvent.title}
              </h2>
              <p className="mt-1 text-sm text-ink/60">
                /invite/{selectedEvent.slug}
              </p>
            </div>
            <p className="text-sm font-black text-leaf">
              {selectedEvent.isPublished ? "Published" : "Draft"}
            </p>
          </div>
          <EventFields designs={designs} event={selectedEvent} />
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="rounded-lg bg-ink px-4 py-3 font-bold text-white">
              Update event
            </button>
            <button
              className="rounded-lg border border-rose/30 px-4 py-3 font-bold text-rose"
              onClick={() => deleteEvent(selectedEvent)}
              type="button"
            >
              Delete
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="mt-7 grid gap-5">
      <div className="overflow-x-auto border border-ink/10 bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-[0.14em] text-ink/45">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Design</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {events.map((invitationEvent) => (
              <tr
                className="cursor-pointer border-t border-ink/10 bg-white"
                key={invitationEvent.id}
                onClick={() => setSelectedEventId(invitationEvent.id)}
              >
                <td className="px-4 py-3">
                  <p className="font-black text-ink">{invitationEvent.title}</p>
                  <p className="text-xs text-ink/45">
                    /invite/{invitationEvent.slug}
                  </p>
                </td>
                <td className="px-4 py-3 font-bold text-ink/65">
                  {invitationEvent.type}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {displayDate(invitationEvent.eventDate)}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {invitationEvent.designVersion?.design.name ?? "No design"}
                </td>
                <td className="px-4 py-3 font-bold text-leaf">
                  {invitationEvent.isPublished ? "Published" : "Draft"}
                </td>
                <td className="px-4 py-3 text-ink/50">
                  {displayDate(invitationEvent.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length ? null : (
          <p className="border-t border-ink/10 p-5 text-sm text-ink/55">
            No events yet.
          </p>
        )}
      </div>

      <form
        className="border border-ink/10 bg-white p-5"
        onSubmit={createEvent}
      >
        <h2 className="text-lg font-black text-ink">Create event</h2>
        <EventFields designs={designs} />
        <button className="mt-5 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
          Create event
        </button>
      </form>
    </section>
  );
}

function EventFields({
  designs,
  event,
}: {
  designs: InvitationDesign[];
  event?: InvitationEvent;
}) {
  const [designVersionId, setDesignVersionId] = useState(
    event?.designVersionId ?? "",
  );
  const selectedVersion = designs
    .flatMap((design) =>
      design.versions
        .filter((version) => version.status === "CURRENT")
        .map((version) => version),
    )
    .find((version) => version.id === designVersionId);
  const designFields =
    selectedVersion?.scanResult?.fields?.filter((field) => !field.locked) ?? [];

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Title</span>
        <input defaultValue={event?.title ?? ""} name="title" required />
      </label>
      <label className="field">
        <span className="text-sm font-bold text-ink">Type</span>
        <select
          className="rounded-lg border border-ink/20 bg-white px-3 py-3"
          defaultValue={event?.type ?? "WEDDING"}
          name="type"
        >
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="text-sm font-bold text-ink">Date and time</span>
        <input
          defaultValue={event?.eventDate ? event.eventDate.slice(0, 16) : ""}
          name="eventDate"
          type="datetime-local"
        />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Venue</span>
        <input defaultValue={event?.venue ?? ""} name="venue" />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Cover image URL</span>
        <input
          defaultValue={event?.coverImage ?? ""}
          name="coverImage"
          type="url"
        />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Description</span>
        <textarea
          className="min-h-28 rounded-lg border border-ink/20 bg-white px-3 py-3"
          defaultValue={event?.description ?? ""}
          name="description"
        />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Design</span>
        <select
          className="rounded-lg border border-ink/20 bg-white px-3 py-3"
          name="designVersionId"
          value={designVersionId}
          onChange={(browserEvent) =>
            setDesignVersionId(browserEvent.target.value)
          }
        >
          <option value="">No design selected</option>
          {designs.flatMap((design) =>
            design.versions
              .filter((version) => version.status === "CURRENT")
              .map((version) => (
                <option key={version.id} value={version.id}>
                  {design.name} · v{version.versionNumber}
                </option>
              )),
          )}
        </select>
      </label>
      {designFields.map((field) => (
        <label
          className="field md:col-span-2"
          key={field.key}
        >
          <span className="text-sm font-bold text-ink">
            {field.label}
            {field.paid ? " · paid custom" : ""}
          </span>
          <input
            defaultValue={event?.designFieldValues?.[field.key] ?? ""}
            name={`designField_${field.key}`}
            required={field.required}
            type={field.type === "date" ? "date" : "text"}
          />
        </label>
      ))}
      <label className="flex items-center gap-3 text-sm font-bold text-ink md:col-span-2">
        <input
          defaultChecked={event?.isPublished ?? false}
          name="isPublished"
          type="checkbox"
        />
        Publish invitation
      </label>
    </div>
  );
}

function eventPayload(form: FormData) {
  const eventDate = String(form.get("eventDate") ?? "");
  const coverImage = String(form.get("coverImage") ?? "");
  const designVersionId = String(form.get("designVersionId") ?? "");
  const designFieldValues = Object.fromEntries(
    [...form.entries()]
      .filter(([key]) => key.startsWith("designField_"))
      .map(([key, value]) => [key.replace("designField_", ""), String(value)]),
  );

  return {
    title: form.get("title"),
    type: form.get("type"),
    eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
    venue: form.get("venue") || undefined,
    coverImage: coverImage || undefined,
    description: form.get("description") || undefined,
    isPublished: form.get("isPublished") === "on",
    designVersionId: designVersionId || undefined,
    designFieldValues: designVersionId ? designFieldValues : undefined,
  };
}

function DesignSetupPanel({
  canCreateTemplates,
  canDuplicateTemplates,
  canPublishTemplates,
  canUnpublishTemplates,
  canUpdateTemplates,
  categories,
  completeAction,
  designs,
  request,
  templates,
}: {
  canCreateTemplates: boolean;
  canDuplicateTemplates: boolean;
  canPublishTemplates: boolean;
  canUnpublishTemplates: boolean;
  canUpdateTemplates: boolean;
  categories: DesignCategory[];
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  designs: InvitationDesign[];
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  templates: InvitationTemplate[];
}) {
  const [selectedTemplate, setSelectedTemplate] =
    useState<InvitationTemplate | null>(null);
  const [editorFields, setEditorFields] = useState<TemplateEditorField[]>([]);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>("");

  const selectedField = editorFields.find(
    (field) => field.key === selectedFieldKey,
  );
  const [libraryMode, setLibraryMode] = useState<"designs" | "templates">(
    "designs",
  );
  const [librarySearch, setLibrarySearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [isCreatePanelCollapsed, setIsCreatePanelCollapsed] = useState(false);
  const [createPreviewHtml, setCreatePreviewHtml] = useState("");

  const filteredDesigns = designs.filter((design) => {
    const search = librarySearch.trim().toLowerCase();
    const current = design.versions.find((version) => version.status === "CURRENT");
    return (
      (!search ||
        [design.name, design.slug, design.category?.name, design.subcategory?.name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search))) &&
      (!categoryFilter || design.category?.id === categoryFilter) &&
      (!subcategoryFilter || design.subcategory?.id === subcategoryFilter) &&
      (!statusFilter || design.status === statusFilter) &&
      matchesDateFilter(current?.createdAt ?? design.updatedAt, dateFilter)
    );
  });
  const filteredTemplates = templates.filter((template) => {
    const search = librarySearch.trim().toLowerCase();
    return (
      (!search ||
        [
          template.name,
          template.sourceFileName,
          template.category?.name,
          template.subcategory?.name,
          template.createdBy?.name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search))) &&
      (!categoryFilter || template.categoryId === categoryFilter) &&
      (!subcategoryFilter || template.subcategoryId === subcategoryFilter) &&
      (!statusFilter || template.status === statusFilter) &&
      matchesDateFilter(template.updatedAt, dateFilter)
    );
  });
  const selectedDesign =
    designs.find((design) => design.id === selectedDesignId) ?? null;
  const selectedTemplateSummary =
    templates.find((template) => template.id === selectedTemplateId) ?? null;
  const visibleSubcategories = categoryFilter
    ? categories.find((category) => category.id === categoryFilter)?.subcategories ?? []
    : categories.flatMap((category) => category.subcategories ?? []);

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await completeAction(
      async () =>
        request("/template-design/templates", {
          method: "POST",
          body: JSON.stringify(await templatePayload(form)),
        }),
      "Template uploaded as draft.",
    );
    event.currentTarget.reset();
    setCreatePreviewHtml("");
    setIsCreatingTemplate(false);
  }

  async function openTemplateEditor(templateId: string) {
    const template = await request<InvitationTemplate>(
      `/template-design/templates/${templateId}`,
    );
    setSelectedTemplate(template);
    const fields = extractTemplateEditorFields(template);
    setEditorFields(fields);
    setSelectedFieldKey(fields[0]?.key ?? "");
  }

  async function saveTemplateDraft() {
    if (!selectedTemplate?.rawHtml) return;
    const rawHtml = applyTemplateEditorFields(
      selectedTemplate.rawHtml,
      editorFields,
    );

    await completeAction(
      async () => {
        const template = await request<InvitationTemplate>(
          `/template-design/templates/${selectedTemplate.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ rawHtml }),
          },
        );
        setSelectedTemplate({ ...template, rawHtml });
        setEditorFields(extractTemplateEditorFields({ ...template, rawHtml }));
      },
      "Template draft saved.",
    );
  }

  async function publishTemplate(templateId: string) {
    await completeAction(
      () =>
        request(`/template-design/templates/${templateId}/publish`, {
          method: "POST",
        }),
      "Template published as current design.",
    );
    const template = await request<InvitationTemplate>(
      `/template-design/templates/${templateId}`,
    );
    setSelectedTemplate((current) =>
      current?.id === template.id ? template : current,
    );
  }

  async function unpublishTemplate(templateId: string) {
    await completeAction(
      () =>
        request(`/template-design/templates/${templateId}/unpublish`, {
          method: "POST",
        }),
      "Design unpublished.",
    );
    const template = await request<InvitationTemplate>(
      `/template-design/templates/${templateId}`,
    );
    setSelectedTemplate((current) =>
      current?.id === template.id ? template : current,
    );
  }

  async function duplicateTemplate(templateId: string) {
    await completeAction(
      () =>
        request(`/template-design/templates/${templateId}/duplicate`, {
          method: "POST",
        }),
      "Template duplicated as draft.",
    );
  }

  function updateEditorField(
    key: string,
    patch: Partial<TemplateEditorField>,
  ) {
    setEditorFields((fields) =>
      fields.map((field) => (field.key === key ? { ...field, ...patch } : field)),
    );
  }

  useEffect(() => {
    function receivePreviewMessage(event: MessageEvent) {
      if (event.data?.source !== "nimto-template-preview") return;
      if (event.data.type === "selectField") {
        setSelectedFieldKey(event.data.fieldKey);
      }
      if (event.data.type === "fieldValue") {
        setSelectedFieldKey(event.data.fieldKey);
        updateEditorField(event.data.fieldKey, { value: event.data.value });
      }
    }

    window.addEventListener("message", receivePreviewMessage);
    return () => window.removeEventListener("message", receivePreviewMessage);
  }, []);

  if (selectedDesign && libraryMode === "designs") {
    return (
      <section className="mt-7 grid gap-5">
        <button
          className="w-fit rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
          onClick={() => setSelectedDesignId("")}
          type="button"
        >
          Back to designs
        </button>
        <DesignDetailPanel design={selectedDesign} />
      </section>
    );
  }

  if (isCreatingTemplate) {
    return (
      <TemplateCreatePanel
        categories={categories}
        createPreviewHtml={createPreviewHtml}
        isCreatePanelCollapsed={isCreatePanelCollapsed}
        onCancel={() => {
          setIsCreatingTemplate(false);
          setCreatePreviewHtml("");
        }}
        onFileHtml={setCreatePreviewHtml}
        onSubmit={createTemplate}
        onTogglePanel={() =>
          setIsCreatePanelCollapsed((isCollapsed) => !isCollapsed)
        }
      />
    );
  }

  if (selectedTemplateSummary && libraryMode === "templates") {
    return (
      <section className="mt-7 grid gap-5">
        <button
          className="w-fit rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
          onClick={() => setSelectedTemplateId("")}
          type="button"
        >
          Back to templates
        </button>
        <TemplateDetailPanel
          canDuplicateTemplates={canDuplicateTemplates}
          canPublishTemplates={canPublishTemplates}
          canUnpublishTemplates={canUnpublishTemplates}
          canUpdateTemplates={canUpdateTemplates}
          onDuplicate={duplicateTemplate}
          onEdit={openTemplateEditor}
          onPublish={publishTemplate}
          onUnpublish={unpublishTemplate}
          template={selectedTemplateSummary}
        />
        {selectedTemplate ? (
          <TemplateEditorPanel
            canPublishTemplates={canPublishTemplates}
            canUnpublishTemplates={canUnpublishTemplates}
            editorFields={editorFields}
            onPublish={publishTemplate}
            onSave={saveTemplateDraft}
            onSelectField={setSelectedFieldKey}
            onUnpublish={unpublishTemplate}
            onUpdateField={updateEditorField}
            selectedField={selectedField}
            selectedFieldKey={selectedFieldKey}
            selectedTemplate={selectedTemplate}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section className="mt-7 grid gap-5">
      <div className="border-y border-ink/10 bg-white px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-black text-ink">Design Setup</h2>
            <p className="mt-1 text-sm text-ink/55">
              Manage designs and templates from a scalable table view.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-5 xl:min-w-[760px]">
            <label className="field md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
                Search
              </span>
              <input
                placeholder="Name, slug, owner, file"
                value={librarySearch}
                onChange={(event) => setLibrarySearch(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
                Category
              </span>
              <select
                className="rounded-lg border border-ink/20 bg-white px-3 py-3"
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setSubcategoryFilter("");
                }}
              >
                <option value="">All</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
                Subcategory
              </span>
              <select
                className="rounded-lg border border-ink/20 bg-white px-3 py-3"
                value={subcategoryFilter}
                onChange={(event) => setSubcategoryFilter(event.target.value)}
              >
                <option value="">All</option>
                {visibleSubcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
                Date
              </span>
              <select
                className="rounded-lg border border-ink/20 bg-white px-3 py-3"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              >
                <option value="">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        <div className="min-w-0 border border-ink/10 bg-white">
          <div className="flex flex-col gap-3 border-b border-ink/10 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                className={`rounded-lg px-4 py-2 text-sm font-bold ${
                  libraryMode === "designs"
                    ? "bg-ink text-white"
                    : "border border-ink/15 bg-white text-ink"
                }`}
                onClick={() => {
                  setLibraryMode("designs");
                  setStatusFilter("");
                }}
                type="button"
              >
                Designs ({filteredDesigns.length})
              </button>
              <button
                className={`rounded-lg px-4 py-2 text-sm font-bold ${
                  libraryMode === "templates"
                    ? "bg-ink text-white"
                    : "border border-ink/15 bg-white text-ink"
                }`}
                onClick={() => {
                  setLibraryMode("templates");
                  setStatusFilter("");
                }}
                type="button"
              >
                Templates ({filteredTemplates.length})
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                Status
                <select
                  className="rounded-lg border border-ink/20 bg-white px-3 py-2"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All</option>
                  {libraryMode === "designs" ? (
                    <>
                      <option value="ACTIVE">Active</option>
                      <option value="UNPUBLISHED">Unpublished</option>
                    </>
                  ) : (
                    <>
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="UNPUBLISHED">Unpublished</option>
                    </>
                  )}
                </select>
              </label>
              {canCreateTemplates ? (
                <button
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white"
                  onClick={() => {
                    setCreatePreviewHtml("");
                    setIsCreatePanelCollapsed(false);
                    setIsCreatingTemplate(true);
                  }}
                  type="button"
                >
                  Create
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            {libraryMode === "designs" ? (
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead className="bg-paper text-xs uppercase tracking-[0.14em] text-ink/45">
                  <tr>
                    <th className="px-4 py-3">Design</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDesigns.map((design) => {
                    const current = design.versions.find(
                      (version) => version.status === "CURRENT",
                    );
                    return (
                      <tr
                        className={`cursor-pointer border-t border-ink/10 ${
                          selectedDesign?.id === design.id ? "bg-leaf/10" : "bg-white"
                        }`}
                        key={design.id}
                        onClick={() => setSelectedDesignId(design.id)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-black text-ink">{design.name}</p>
                          <p className="text-xs text-ink/45">/{design.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-ink/65">
                          {[design.category?.name, design.subcategory?.name]
                            .filter(Boolean)
                            .join(" / ") || "Uncategorized"}
                        </td>
                        <td className="px-4 py-3 font-bold text-ink">
                          {current ? `v${current.versionNumber}` : "No current"}
                        </td>
                        <td className="px-4 py-3 font-bold text-leaf">
                          {design.status}
                        </td>
                        <td className="px-4 py-3 text-ink/60">
                          {design.createdBy?.name ?? "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-ink/50">
                          {displayDate(design.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-paper text-xs uppercase tracking-[0.14em] text-ink/45">
                  <tr>
                    <th className="px-4 py-3">Template</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Fields</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.map((template) => (
                    <tr
                      className={`cursor-pointer border-t border-ink/10 ${
                        selectedTemplateSummary?.id === template.id
                          ? "bg-leaf/10"
                          : "bg-white"
                      }`}
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-black text-ink">{template.name}</p>
                        <p className="text-xs text-ink/45">
                          {template.sourceFileName ?? "HTML template"} ·{" "}
                          {Math.ceil(template.htmlSize / 1024)} KB
                        </p>
                      </td>
                      <td className="px-4 py-3 text-ink/65">
                        {[template.category?.name, template.subcategory?.name]
                          .filter(Boolean)
                          .join(" / ") || "Uncategorized"}
                      </td>
                      <td className="px-4 py-3 text-ink/60">
                        {template.scanResult?.fields?.length ?? 0} fields ·{" "}
                        {template.scanResult?.sections?.length ?? 0} sections
                      </td>
                      <td className="px-4 py-3 font-bold text-marigold">
                        {template.status}
                      </td>
                      <td className="px-4 py-3 text-ink/60">
                        {template.createdBy?.name ?? "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-ink/50">
                        {displayDate(template.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selectedTemplate ? (
        <TemplateEditorPanel
          canPublishTemplates={canPublishTemplates}
          canUnpublishTemplates={canUnpublishTemplates}
          editorFields={editorFields}
          onPublish={publishTemplate}
          onSave={saveTemplateDraft}
          onSelectField={setSelectedFieldKey}
          onUnpublish={unpublishTemplate}
          onUpdateField={updateEditorField}
          selectedField={selectedField}
          selectedFieldKey={selectedFieldKey}
          selectedTemplate={selectedTemplate}
        />
      ) : null}
    </section>
  );
}

function DesignDetailPanel({ design }: { design: InvitationDesign | null }) {
  const current = design?.versions.find((version) => version.status === "CURRENT");
  const supersededCount =
    design?.versions.filter((version) => version.status === "SUPERSEDED").length ??
    0;

  return (
    <div className="border border-ink/10 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
        Design details
      </p>
      {design ? (
        <div className="mt-4 grid gap-3">
          <div>
            <h3 className="text-xl font-black text-ink">{design.name}</h3>
            <p className="mt-1 text-sm text-ink/50">/{design.slug}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="font-bold text-ink/45">Status</dt>
              <dd className="mt-1 font-black text-leaf">{design.status}</dd>
            </div>
            <div>
              <dt className="font-bold text-ink/45">Current version</dt>
              <dd className="mt-1 font-black text-ink">
                {current ? `v${current.versionNumber}` : "None"}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-ink/45">Superseded</dt>
              <dd className="mt-1 font-black text-ink">{supersededCount}</dd>
            </div>
            <div>
              <dt className="font-bold text-ink/45">Owner</dt>
              <dd className="mt-1 font-black text-ink">
                {design.createdBy?.name ?? "Unknown"}
              </dd>
            </div>
          </dl>
          <p className="text-sm leading-6 text-ink/60">
            {[design.category?.name, design.subcategory?.name]
              .filter(Boolean)
              .join(" / ") || "Uncategorized"}
          </p>
          <div className="border-t border-ink/10 pt-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
              Version history
            </p>
            <div className="mt-2 grid gap-2">
              {design.versions.map((version) => (
                <div
                  className="flex items-center justify-between border border-ink/10 px-3 py-2 text-sm"
                  key={version.id}
                >
                  <span className="font-bold text-ink">
                    v{version.versionNumber}
                  </span>
                  <span
                    className={
                      version.status === "CURRENT"
                        ? "font-black text-leaf"
                        : "font-bold text-ink/45"
                    }
                  >
                    {version.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-ink/55">
          Select a design row to view details.
        </p>
      )}
    </div>
  );
}

function TemplateCreatePanel({
  categories,
  createPreviewHtml,
  isCreatePanelCollapsed,
  onCancel,
  onFileHtml,
  onSubmit,
  onTogglePanel,
}: {
  categories: DesignCategory[];
  createPreviewHtml: string;
  isCreatePanelCollapsed: boolean;
  onCancel: () => void;
  onFileHtml: (html: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTogglePanel: () => void;
}) {
  const [isSourceMode, setIsSourceMode] = useState(false);

  async function readHtmlFile(file?: File) {
    if (!file || file.size === 0) return;
    onFileHtml(await file.text());
  }

  return (
    <section className="mt-7 grid gap-5">
      <div className="flex flex-col gap-3 border-y border-ink/10 bg-white px-4 py-4 md:flex-row md:items-center">
        <button
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-lg border border-ink/15 bg-white text-ink"
          onClick={onCancel}
          title="Back"
          type="button"
        >
          <BackIcon />
        </button>
        <div>
          <h2 className="text-2xl font-black text-ink">Create template</h2>
          <p className="mt-1 text-sm text-ink/55">
            Add HTML on the left and preview the design on the right.
          </p>
        </div>
        {isCreatePanelCollapsed ? (
          <button
            aria-label="Show form"
            className="ml-auto grid h-11 w-11 place-items-center rounded-lg border border-ink/15 bg-white text-ink"
            onClick={onTogglePanel}
            title="Show form"
            type="button"
          >
            <FormIcon />
          </button>
        ) : null}
      </div>

      <div
        className={`grid gap-5 ${
          isCreatePanelCollapsed
            ? "xl:grid-cols-1"
            : "xl:grid-cols-[420px_minmax(0,1fr)]"
        }`}
      >
        {isCreatePanelCollapsed ? null : (
          <form
            className="border border-ink/10 bg-white p-4"
            onSubmit={onSubmit}
          >
            <>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-ink">Template details</h3>
                <button
                  aria-label="Minimize form"
                  className="grid h-10 w-10 place-items-center rounded-lg border border-ink/15 bg-white text-ink"
                  onClick={onTogglePanel}
                  title="Minimize form"
                  type="button"
                >
                  <CollapseIcon isCollapsed={false} />
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="field">
                  <span className="text-sm font-bold text-ink">Name</span>
                  <input name="name" required />
                </label>
                <label className="field">
                  <span className="text-sm font-bold text-ink">HTML file</span>
                  <input
                    accept=".html,text/html"
                    name="templateFile"
                    onChange={(event) => readHtmlFile(event.target.files?.[0])}
                    type="file"
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  <label className="field">
                    <span className="text-sm font-bold text-ink">Category</span>
                    <select
                      className="rounded-lg border border-ink/20 bg-white px-3 py-3"
                      name="categoryId"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="text-sm font-bold text-ink">
                      Subcategory
                    </span>
                    <select
                      className="rounded-lg border border-ink/20 bg-white px-3 py-3"
                      name="subcategoryId"
                    >
                      <option value="">None</option>
                      {categories.flatMap((category) =>
                        (category.subcategories ?? []).map((subcategory) => (
                          <option key={subcategory.id} value={subcategory.id}>
                            {category.name} / {subcategory.name}
                          </option>
                        )),
                      )}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span className="text-sm font-bold text-ink">HTML</span>
                  <textarea
                    className="min-h-72 rounded-lg border border-ink/20 bg-white px-3 py-3 font-mono text-xs"
                    name="rawHtml"
                    onChange={(event) => onFileHtml(event.target.value)}
                    value={createPreviewHtml}
                  />
                </label>
              </div>
              <button className="mt-4 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
                Create draft
              </button>
            </>
          </form>
        )}

        <div className="min-h-[720px] border border-ink/10 bg-white">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <h3 className="font-black text-ink">
              {isSourceMode ? "Source" : "Preview"}
            </h3>
            <button
              aria-label={isSourceMode ? "Show preview" : "Edit source code"}
              className={`grid h-10 w-10 place-items-center rounded-lg border border-ink/15 bg-white text-ink ${
                isSourceMode ? "text-leaf" : ""
              }`}
              onClick={() => setIsSourceMode((value) => !value)}
              title={isSourceMode ? "Show preview" : "Edit source code"}
              type="button"
            >
              {isSourceMode ? <PreviewIcon /> : <CodeIcon />}
            </button>
          </div>
          {isSourceMode ? (
            <textarea
              className="min-h-[672px] w-full resize-none border-0 bg-ink px-4 py-4 font-mono text-xs leading-5 text-white outline-none"
              onChange={(event) => onFileHtml(event.target.value)}
              value={createPreviewHtml}
            />
          ) : createPreviewHtml ? (
            <iframe
              className="h-full min-h-[672px] w-full border-0 bg-white"
              sandbox="allow-scripts"
              srcDoc={createPreviewHtml}
              title="Template preview"
            />
          ) : (
            <div className="grid min-h-[672px] place-items-center p-6 text-center">
              <div>
                <h3 className="text-xl font-black text-ink">Preview</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-ink/55">
                  Upload an HTML file, paste HTML, or use the source icon to
                  start editing here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TemplateDetailPanel({
  canDuplicateTemplates,
  canPublishTemplates,
  canUnpublishTemplates,
  canUpdateTemplates,
  onDuplicate,
  onEdit,
  onPublish,
  onUnpublish,
  template,
}: {
  canDuplicateTemplates: boolean;
  canPublishTemplates: boolean;
  canUnpublishTemplates: boolean;
  canUpdateTemplates: boolean;
  onDuplicate: (templateId: string) => void;
  onEdit: (templateId: string) => void;
  onPublish: (templateId: string) => void;
  onUnpublish: (templateId: string) => void;
  template: InvitationTemplate | null;
}) {
  return (
    <div className="border border-ink/10 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
        Template details
      </p>
      {template ? (
        <div className="mt-4 grid gap-3">
          <div>
            <h3 className="text-xl font-black text-ink">{template.name}</h3>
            <p className="mt-1 text-sm text-ink/50">
              {template.sourceFileName ?? "HTML template"} ·{" "}
              {Math.ceil(template.htmlSize / 1024)} KB
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="font-bold text-ink/45">Status</dt>
              <dd className="mt-1 font-black text-marigold">
                {template.status}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-ink/45">Fields</dt>
              <dd className="mt-1 font-black text-ink">
                {template.scanResult?.fields?.length ?? 0}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-ink/45">Sections</dt>
              <dd className="mt-1 font-black text-ink">
                {template.scanResult?.sections?.length ?? 0}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-ink/45">Owner</dt>
              <dd className="mt-1 font-black text-ink">
                {template.createdBy?.name ?? "Unknown"}
              </dd>
            </div>
          </dl>
          <p className="text-sm leading-6 text-ink/60">
            {[template.category?.name, template.subcategory?.name]
              .filter(Boolean)
              .join(" / ") || "Uncategorized"}
          </p>
          <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-3">
            {canUpdateTemplates ? (
              <button
                className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
                onClick={() => onEdit(template.id)}
                type="button"
              >
                Edit
              </button>
            ) : null}
            {canPublishTemplates ? (
              <button
                className="rounded-lg bg-leaf px-4 py-2 text-sm font-bold text-white"
                onClick={() => onPublish(template.id)}
                type="button"
              >
                Publish
              </button>
            ) : null}
            {canUnpublishTemplates && template.designId ? (
              <button
                className="rounded-lg border border-rose/20 bg-rose/10 px-4 py-2 text-sm font-bold text-rose"
                onClick={() => onUnpublish(template.id)}
                type="button"
              >
                Unpublish
              </button>
            ) : null}
            {canDuplicateTemplates ? (
              <button
                className="rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
                onClick={() => onDuplicate(template.id)}
                type="button"
              >
                Duplicate
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-ink/55">
          Select a template row to view details.
        </p>
      )}
    </div>
  );
}

function TemplateEditorPanel({
  canPublishTemplates,
  canUnpublishTemplates,
  editorFields,
  onPublish,
  onSave,
  onSelectField,
  onUnpublish,
  onUpdateField,
  selectedField,
  selectedFieldKey,
  selectedTemplate,
}: {
  canPublishTemplates: boolean;
  canUnpublishTemplates: boolean;
  editorFields: TemplateEditorField[];
  onPublish: (templateId: string) => void;
  onSave: () => void;
  onSelectField: (fieldKey: string) => void;
  onUnpublish: (templateId: string) => void;
  onUpdateField: (key: string, patch: Partial<TemplateEditorField>) => void;
  selectedField?: TemplateEditorField;
  selectedFieldKey: string;
  selectedTemplate: InvitationTemplate;
}) {
  return (
    <div className="border border-ink/10 bg-white p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-ink">
            {selectedTemplate.name}
          </h2>
          <p className="mt-1 text-sm text-ink/55">
            Preview is the working surface. Side panel controls field rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg bg-ink px-4 py-3 font-bold text-white"
            onClick={onSave}
            type="button"
          >
            Save draft
          </button>
          {canPublishTemplates ? (
            <button
              className="rounded-lg bg-leaf px-4 py-3 font-bold text-white"
              onClick={() => onPublish(selectedTemplate.id)}
              type="button"
            >
              Publish
            </button>
          ) : null}
          {canUnpublishTemplates && selectedTemplate.designId ? (
            <button
              className="rounded-lg border border-rose/20 bg-rose/10 px-4 py-3 font-bold text-rose"
              onClick={() => onUnpublish(selectedTemplate.id)}
              type="button"
            >
              Unpublish
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <iframe
          className="h-[640px] w-full border border-ink/10 bg-white"
          sandbox="allow-scripts allow-same-origin"
          srcDoc={templateEditorPreviewHtml(
            selectedTemplate.rawHtml ?? "",
            editorFields,
            selectedFieldKey,
          )}
          title={`${selectedTemplate.name} preview`}
        />

        <div className="border border-ink/10 bg-paper/70 p-4">
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-ink/55">
            Layers
          </h3>
          <div className="mt-4 grid gap-2">
            {groupTemplateFields(
              editorFields,
              selectedTemplate.scanResult?.sections ?? [],
            ).map((group) => (
              <div key={group.key}>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/40">
                  {group.label}
                </p>
                <div className="mt-2 grid gap-2">
                  {group.fields.map((field) => (
                    <button
                      className={`rounded-lg border px-3 py-2 text-left text-sm font-bold ${
                        field.key === selectedFieldKey
                          ? "border-leaf bg-leaf/10 text-leaf"
                          : "border-ink/10 bg-white text-ink"
                      }`}
                      key={field.key}
                      onClick={() => onSelectField(field.key)}
                      type="button"
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {selectedField ? (
            <div className="mt-5 grid gap-3 border-t border-ink/10 pt-4">
              <label className="field">
                <span className="text-sm font-bold text-ink">Value</span>
                <textarea
                  className="min-h-28 rounded-lg border border-ink/20 bg-white px-3 py-3"
                  value={selectedField.value}
                  onChange={(event) =>
                    onUpdateField(selectedField.key, {
                      value: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span className="text-sm font-bold text-ink">Type</span>
                <select
                  className="rounded-lg border border-ink/20 bg-white px-3 py-3"
                  value={selectedField.type}
                  onChange={(event) =>
                    onUpdateField(selectedField.key, {
                      type: event.target.value,
                    })
                  }
                >
                  <option value="text">Text</option>
                  <option value="long_text">Long text</option>
                  <option value="date">Date</option>
                  <option value="datetime">Date time</option>
                  <option value="custom_name">Custom name</option>
                  <option value="image">Image</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input
                  checked={selectedField.required}
                  onChange={(event) =>
                    onUpdateField(selectedField.key, {
                      required: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input
                  checked={selectedField.locked}
                  onChange={(event) =>
                    onUpdateField(selectedField.key, {
                      locked: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                Locked
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input
                  checked={selectedField.paid}
                  onChange={(event) =>
                    onUpdateField(selectedField.key, {
                      paid: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                Paid custom field
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProfilePanel({
  logout,
  refresh,
  user,
}: {
  logout: () => Promise<void>;
  refresh: () => void;
  user: AuthUser | null;
}) {
  return (
    <section className="mt-7 grid gap-5">
      <div className="border-y border-ink/10 bg-white px-4 py-4">
        <h2 className="text-2xl font-black text-ink">Profile</h2>
        <p className="mt-1 text-sm text-ink/55">
          Account information for the current dashboard session.
        </p>
      </div>
      <div className="border border-ink/10 bg-white p-5">
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
              Name
            </dt>
            <dd className="mt-1 text-lg font-black text-ink">
              {user?.name ?? "Creator"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
              Email
            </dt>
            <dd className="mt-1 break-all text-lg font-black text-ink">
              {user?.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">
              Roles
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {user?.roles?.length ? (
                user.roles.map((role) => (
                  <span className="role-chip" key={role}>
                    {role}
                  </span>
                ))
              ) : (
                <span className="text-sm font-bold text-ink/45">No roles</span>
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-ink/10 pt-5">
          <button
            className="dashboard-button-secondary"
            onClick={refresh}
            type="button"
          >
            Refresh
          </button>
          <button
            className="dashboard-button-secondary"
            onClick={logout}
            type="button"
          >
            Log out
          </button>
        </div>
      </div>
    </section>
  );
}

function SettingsPanel({
  canManageCategories,
  canManageSubcategories,
  categories,
  completeAction,
  request,
}: {
  canManageCategories: boolean;
  canManageSubcategories: boolean;
  categories: DesignCategory[];
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
}) {
  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await completeAction(
      () =>
        request("/template-design/categories", {
          method: "POST",
          body: JSON.stringify(taxonomyPayload(form)),
        }),
      "Category created.",
    );
    event.currentTarget.reset();
  }

  async function updateCategory(
    event: FormEvent<HTMLFormElement>,
    category: DesignCategory,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await completeAction(
      () =>
        request(`/template-design/categories/${category.id}`, {
          method: "PATCH",
          body: JSON.stringify(taxonomyPayload(form)),
        }),
      "Category updated.",
    );
  }

  async function createSubcategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const categoryId = String(form.get("categoryId") ?? "");
    await completeAction(
      () =>
        request(`/template-design/categories/${categoryId}/subcategories`, {
          method: "POST",
          body: JSON.stringify(taxonomyPayload(form)),
        }),
      "Subcategory created.",
    );
    event.currentTarget.reset();
  }

  async function updateSubcategory(
    event: FormEvent<HTMLFormElement>,
    subcategory: DesignSubcategory,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await completeAction(
      () =>
        request(`/template-design/subcategories/${subcategory.id}`, {
          method: "PATCH",
          body: JSON.stringify(taxonomyPayload(form)),
        }),
      "Subcategory updated.",
    );
  }

  return (
    <section className="mt-7 grid gap-5">
      <div className="border-y border-ink/10 bg-white px-4 py-4">
        <h2 className="text-2xl font-black text-ink">Settings</h2>
        <p className="mt-1 text-sm text-ink/55">
          Category and subcategory setup lives here. Later settings can be added
          beside these tables.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-x-auto border border-ink/10 bg-white">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-[0.14em] text-ink/45">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Subcategories</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sort</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr className="border-t border-ink/10" key={category.id}>
                  <td className="px-4 py-3 font-black text-ink">
                    {category.name}
                  </td>
                  <td className="px-4 py-3 text-ink/55">/{category.slug}</td>
                  <td className="px-4 py-3 text-ink/60">
                    {category.subcategories?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 font-bold text-leaf">
                    {category.status}
                  </td>
                  <td className="px-4 py-3 text-ink/55">
                    {category.sortOrder}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid content-start gap-4">
          {canManageCategories ? (
            <form
              className="border border-ink/10 bg-white p-4"
              onSubmit={createCategory}
            >
              <h3 className="font-black text-ink">Create category</h3>
              <div className="mt-4 grid gap-3">
                <TaxonomyFields />
              </div>
              <button className="mt-4 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
                Create category
              </button>
            </form>
          ) : null}

          {canManageSubcategories ? (
            <form
              className="border border-ink/10 bg-white p-4"
              onSubmit={createSubcategory}
            >
              <h3 className="font-black text-ink">Create subcategory</h3>
              <div className="mt-4 grid gap-3">
                <label className="field">
                  <span className="text-sm font-bold text-ink">Category</span>
                  <select
                    className="rounded-lg border border-ink/20 bg-white px-3 py-3"
                    name="categoryId"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <TaxonomyFields titlePrefix="New" />
              </div>
              <button className="mt-4 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
                Create subcategory
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4">
        {categories.map((category) => (
          <div className="border border-ink/10 bg-white p-4" key={category.id}>
            {canManageCategories ? (
              <form
                className="grid gap-3 md:grid-cols-5"
                onSubmit={(event) => updateCategory(event, category)}
              >
                <TaxonomyFields item={category} />
                <button className="rounded-lg bg-ink px-4 py-3 font-bold text-white md:col-span-5">
                  Update category
                </button>
              </form>
            ) : null}
            {category.subcategories?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-paper text-xs uppercase tracking-[0.14em] text-ink/45">
                    <tr>
                      <th className="px-4 py-3">Subcategory</th>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Sort</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.subcategories.map((subcategory) => (
                      <tr className="border-t border-ink/10" key={subcategory.id}>
                        <td className="px-4 py-3 font-bold text-ink">
                          {subcategory.name}
                        </td>
                        <td className="px-4 py-3 text-ink/55">
                          /{subcategory.slug}
                        </td>
                        <td className="px-4 py-3 font-bold text-leaf">
                          {subcategory.status}
                        </td>
                        <td className="px-4 py-3 text-ink/55">
                          {subcategory.sortOrder}
                        </td>
                        <td className="px-4 py-3">
                          {canManageSubcategories ? (
                            <form
                              className="grid gap-2"
                              onSubmit={(event) =>
                                updateSubcategory(event, subcategory)
                              }
                            >
                              <TaxonomyFields item={subcategory} />
                              <button className="rounded-lg bg-ink px-3 py-2 text-sm font-bold text-white">
                                Update
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function matchesDateFilter(value: string | undefined, filter: string) {
  if (!filter || !value) return true;
  const days = Number(filter);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(value).getTime() >= cutoff;
}

function TaxonomyFields({
  item,
  titlePrefix,
}: {
  item?: Pick<
    DesignCategory | DesignSubcategory,
    "description" | "name" | "slug" | "sortOrder" | "status"
  >;
  titlePrefix?: string;
}) {
  return (
    <>
      <label className="field">
        <span className="text-sm font-bold text-ink">
          {titlePrefix ? `${titlePrefix} name` : "Name"}
        </span>
        <input defaultValue={item?.name ?? ""} name="name" required />
      </label>
      <label className="field">
        <span className="text-sm font-bold text-ink">Slug</span>
        <input defaultValue={item?.slug ?? ""} name="slug" />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Description</span>
        <input defaultValue={item?.description ?? ""} name="description" />
      </label>
      <label className="field">
        <span className="text-sm font-bold text-ink">Sort order</span>
        <input
          defaultValue={item?.sortOrder ?? 0}
          min={0}
          name="sortOrder"
          type="number"
        />
      </label>
      <label className="field">
        <span className="text-sm font-bold text-ink">Status</span>
        <select
          className="rounded-lg border border-ink/20 bg-white px-3 py-3"
          defaultValue={item?.status ?? "ACTIVE"}
          name="status"
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </label>
    </>
  );
}

function taxonomyPayload(form: FormData) {
  const slug = String(form.get("slug") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  return {
    name: form.get("name"),
    slug: slug || undefined,
    description: description || undefined,
    sortOrder: Number(form.get("sortOrder") ?? 0),
    status: form.get("status"),
  };
}

async function templatePayload(form: FormData) {
  const file = form.get("templateFile");
  const rawHtml =
    file instanceof File && file.size > 0
      ? await file.text()
      : String(form.get("rawHtml") ?? "");
  const categoryId = String(form.get("categoryId") ?? "");
  const subcategoryId = String(form.get("subcategoryId") ?? "");

  return {
    name: form.get("name"),
    rawHtml,
    sourceFileName:
      file instanceof File && file.size > 0 ? file.name : undefined,
    categoryId: categoryId || undefined,
    subcategoryId: subcategoryId || undefined,
  };
}

function extractTemplateEditorFields(template: InvitationTemplate) {
  if (!template.rawHtml || typeof DOMParser === "undefined") return [];
  const document = new DOMParser().parseFromString(template.rawHtml, "text/html");
  const scannedFields = template.scanResult?.fields ?? [];

  return scannedFields.map((field) => {
    const element = document.querySelector(`[data-nimto-field="${field.key}"]`);
    return {
      key: field.key,
      label: field.label,
      type: field.type,
      sectionKey: element?.getAttribute("data-nimto-section-ref") ?? undefined,
      required: field.required,
      paid: field.paid,
      locked: field.locked,
      value: element?.textContent?.trim() ?? "",
    };
  });
}

function applyTemplateEditorFields(
  rawHtml: string,
  fields: TemplateEditorField[],
) {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return rawHtml;
  }

  const document = new DOMParser().parseFromString(rawHtml, "text/html");
  fields.forEach((field) => {
    const element = document.querySelector(`[data-nimto-field="${field.key}"]`);
    if (!element) return;

    element.textContent = field.value;
    element.setAttribute("data-nimto-type", field.type);
    setBooleanMarker(element, "data-nimto-required", field.required);
    setBooleanMarker(element, "data-nimto-paid", field.paid);
    setBooleanMarker(element, "data-nimto-locked", field.locked);
  });

  return `<!doctype html>\n${new XMLSerializer().serializeToString(document)}`;
}

function setBooleanMarker(element: Element, attribute: string, enabled: boolean) {
  if (enabled) {
    element.setAttribute(attribute, "true");
    return;
  }
  element.removeAttribute(attribute);
}

function templateEditorPreviewHtml(
  rawHtml: string,
  fields: TemplateEditorField[],
  selectedFieldKey: string,
) {
  const html = applyTemplateEditorFields(rawHtml, fields);
  const state = JSON.stringify({
    fields: fields.map((field) => ({
      key: field.key,
      locked: field.locked,
    })),
    selectedFieldKey,
  }).replace(/<\/script/gi, "<\\/script");
  const script = `
    <style>
      [data-nimto-field] { cursor: text; outline-offset: 3px; }
      [data-nimto-field][data-nimto-preview-selected="true"] {
        outline: 2px solid #3f8f5f !important;
        background: rgba(63, 143, 95, 0.10) !important;
      }
    </style>
    <script>
      (() => {
        const state = ${state};
        const fields = new Map(state.fields.map((field) => [field.key, field]));
        function selectField(key) {
          document.querySelectorAll("[data-nimto-field]").forEach((element) => {
            element.removeAttribute("data-nimto-preview-selected");
          });
          const element = document.querySelector('[data-nimto-field="' + key + '"]');
          element?.setAttribute("data-nimto-preview-selected", "true");
          window.parent.postMessage({
            source: "nimto-template-preview",
            type: "selectField",
            fieldKey: key
          }, "*");
        }
        document.querySelectorAll("[data-nimto-field]").forEach((element) => {
          const key = element.getAttribute("data-nimto-field");
          const field = fields.get(key);
          if (!field?.locked) element.setAttribute("contenteditable", "true");
          element.addEventListener("click", (event) => {
            event.preventDefault();
            selectField(key);
          });
          element.addEventListener("input", () => {
            window.parent.postMessage({
              source: "nimto-template-preview",
              type: "fieldValue",
              fieldKey: key,
              value: element.textContent || ""
            }, "*");
          });
        });
        if (state.selectedFieldKey) selectField(state.selectedFieldKey);
      })();
    </script>
  `;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}</body>`);
  }
  return `${html}${script}`;
}

function groupTemplateFields(
  fields: TemplateEditorField[],
  sections: { key: string; label: string }[],
) {
  const sectionMap = new Map(
    sections.map((section) => [
      section.key,
      { key: section.key, label: section.label, fields: [] as TemplateEditorField[] },
    ]),
  );
  const fallback = { key: "unsectioned", label: "Other", fields: [] };

  fields.forEach((field) => {
    const group =
      (field.sectionKey ? sectionMap.get(field.sectionKey) : undefined) ??
      fallback;
    group.fields.push(field);
  });

  return [...sectionMap.values(), fallback].filter(
    (group) => group.fields.length,
  );
}

function WebsitePanel({
  canManageBlog,
  canManageContent,
  completeAction,
  pages,
  posts,
  request,
}: {
  canManageBlog: boolean;
  canManageContent: boolean;
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  pages: PageContent[];
  posts: BlogPost[];
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
}) {
  async function savePage(event: FormEvent<HTMLFormElement>, key: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await completeAction(
      () =>
        request(`/cms/admin/pages/${key}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: form.get("title"),
            subtitle: form.get("subtitle") || undefined,
            body: form.get("body") || undefined,
          }),
        }),
      "Website content saved.",
    );
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await completeAction(
      () =>
        request("/cms/admin/blog", {
          method: "POST",
          body: JSON.stringify(blogPayload(form)),
        }),
      "Blog post created.",
    );
    event.currentTarget.reset();
  }

  async function updatePost(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await completeAction(
      () =>
        request(`/cms/admin/blog/${postId}`, {
          method: "PATCH",
          body: JSON.stringify(blogPayload(form)),
        }),
      "Blog post updated.",
    );
  }

  async function deletePost(postId: string) {
    await completeAction(
      () => request(`/cms/admin/blog/${postId}`, { method: "DELETE" }),
      "Blog post deleted.",
    );
  }

  return (
    <section className="mt-7 grid gap-6">
      {canManageContent ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {pageKeys.map((key) => {
            const page = pages.find((item) => item.key === key);
            return (
              <form
                className="rounded-lg border border-ink/10 bg-white p-5"
                key={key}
                onSubmit={(event) => savePage(event, key)}
              >
                <h2 className="text-lg font-black capitalize text-ink">
                  {key}
                </h2>
                <label className="field mt-4">
                  <span className="text-sm font-bold text-ink">Title</span>
                  <input
                    defaultValue={page?.title ?? ""}
                    name="title"
                    required
                  />
                </label>
                <label className="field mt-4">
                  <span className="text-sm font-bold text-ink">Subtitle</span>
                  <input defaultValue={page?.subtitle ?? ""} name="subtitle" />
                </label>
                <label className="field mt-4">
                  <span className="text-sm font-bold text-ink">Body</span>
                  <textarea
                    className="min-h-32 rounded-lg border border-ink/20 bg-white px-3 py-3"
                    defaultValue={page?.body ?? ""}
                    name="body"
                  />
                </label>
                <button className="mt-5 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
                  Save page
                </button>
              </form>
            );
          })}
        </div>
      ) : null}

      {canManageBlog ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid gap-4">
            {posts.map((post) => (
              <form
                className="rounded-lg border border-ink/10 bg-white p-5"
                key={post.id}
                onSubmit={(event) => updatePost(event, post.id)}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-black text-ink">
                      {post.title}
                    </h2>
                    <p className="mt-1 text-sm text-ink/55">
                      /blog/{post.slug}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-leaf">{post.status}</p>
                </div>
                <BlogFields post={post} />
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="rounded-lg bg-ink px-4 py-3 font-bold text-white">
                    Update post
                  </button>
                  <button
                    className="rounded-lg border border-rose/30 px-4 py-3 font-bold text-rose"
                    onClick={() => deletePost(post.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </form>
            ))}
          </div>

          <form
            className="rounded-lg border border-ink/10 bg-white p-5"
            onSubmit={createPost}
          >
            <h2 className="text-lg font-black text-ink">Create blog post</h2>
            <BlogFields />
            <button className="mt-5 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
              Create post
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function BlogFields({ post }: { post?: BlogPost }) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Title</span>
        <input defaultValue={post?.title ?? ""} name="title" required />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Excerpt</span>
        <input defaultValue={post?.excerpt ?? ""} name="excerpt" />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Citation summary</span>
        <textarea
          className="min-h-24 rounded-lg border border-ink/20 bg-white px-3 py-3"
          defaultValue={post?.citationSummary ?? ""}
          name="citationSummary"
        />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Content</span>
        <textarea
          className="min-h-56 rounded-lg border border-ink/20 bg-white px-3 py-3"
          defaultValue={post?.content ?? ""}
          name="content"
          required
        />
      </label>
      <label className="field">
        <span className="text-sm font-bold text-ink">Meta title</span>
        <input defaultValue={post?.metaTitle ?? ""} name="metaTitle" />
      </label>
      <label className="field">
        <span className="text-sm font-bold text-ink">Meta description</span>
        <input
          defaultValue={post?.metaDescription ?? ""}
          name="metaDescription"
        />
      </label>
      <label className="field">
        <span className="text-sm font-bold text-ink">Keywords</span>
        <input defaultValue={post?.keywords ?? ""} name="keywords" />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">FAQ</span>
        <textarea
          className="min-h-28 rounded-lg border border-ink/20 bg-white px-3 py-3"
          defaultValue={formatFaq(post?.faq)}
          name="faq"
          placeholder="Question | Answer"
        />
      </label>
      <label className="field md:col-span-2">
        <span className="text-sm font-bold text-ink">Sources</span>
        <textarea
          className="min-h-24 rounded-lg border border-ink/20 bg-white px-3 py-3"
          defaultValue={formatSources(post?.sources)}
          name="sources"
          placeholder="Source title | https://example.com"
        />
      </label>
      <label className="field">
        <span className="text-sm font-bold text-ink">Status</span>
        <select
          className="rounded-lg border border-ink/20 bg-white px-3 py-3"
          defaultValue={post?.status ?? "DRAFT"}
          name="status"
        >
          <option value="DRAFT">DRAFT</option>
          <option value="PUBLISHED">PUBLISHED</option>
        </select>
      </label>
    </div>
  );
}

function blogPayload(form: FormData) {
  return {
    title: form.get("title"),
    excerpt: form.get("excerpt") || undefined,
    citationSummary: form.get("citationSummary") || undefined,
    content: form.get("content"),
    metaTitle: form.get("metaTitle") || undefined,
    metaDescription: form.get("metaDescription") || undefined,
    keywords: form.get("keywords") || undefined,
    faq: form.get("faq") || undefined,
    sources: form.get("sources") || undefined,
    status: form.get("status"),
  };
}

function formatFaq(items?: { question: string; answer: string }[] | null) {
  return (
    items?.map((item) => `${item.question} | ${item.answer}`).join("\n") ?? ""
  );
}

function formatSources(items?: { label: string; url: string }[] | null) {
  return items?.map((item) => `${item.label} | ${item.url}`).join("\n") ?? "";
}

function RolesPanel({
  canManage,
  completeAction,
  permissions,
  request,
  roles,
}: {
  canManage: boolean;
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  permissions: Permission[];
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  roles: Role[];
}) {
  const [editingRoleId, setEditingRoleId] = useState("");
  const editingRole =
    roles.find((role) => role.id === editingRoleId) ?? null;

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const permissionKeys = form.getAll("permissionKeys").map(String);

    await completeAction(
      () =>
        request("/admin/roles", {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            description: form.get("description"),
            permissionKeys,
          }),
        }),
      "Role created.",
    );
    event.currentTarget.reset();
  }

  async function updateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRole) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const permissionKeys = form.getAll("permissionKeys").map(String);

    await completeAction(
      () =>
        request(`/admin/roles/${editingRole.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.get("name"),
            description: form.get("description"),
            permissionKeys,
          }),
        }),
      "Role updated.",
    );
  }

  async function deleteRole(role: Role) {
    await completeAction(
      () => request(`/admin/roles/${role.id}`, { method: "DELETE" }),
      "Role deleted.",
    );
    setEditingRoleId("");
  }

  if (editingRole) {
    return (
      <section className="mt-7 grid gap-5">
        <button
          className="w-fit rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
          onClick={() => setEditingRoleId("")}
          type="button"
        >
          Back to roles
        </button>
        {canManage ? (
          <div className="grid gap-4">
            <RoleForm
              key={editingRole.id}
              disabled={editingRole.isSystem}
              onSubmit={updateRole}
              permissions={permissions}
              role={editingRole}
              title="Edit role"
            />
            {!editingRole.isSystem ? (
              <button
                className="w-fit rounded-lg border border-rose/30 px-4 py-3 font-bold text-rose"
                onClick={() => deleteRole(editingRole)}
                type="button"
              >
                Delete role
              </button>
            ) : null}
          </div>
        ) : (
          <div className="border border-ink/10 bg-white p-5">
            <h2 className="text-2xl font-black text-ink">{editingRole.name}</h2>
            <p className="mt-2 text-sm text-ink/60">
              {editingRole.description ?? "No description"}
            </p>
            <p className="mt-4 text-sm font-bold text-ink">
              {editingRole.permissions.length} permissions assigned
            </p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mt-7 grid gap-5">
      <div className="overflow-x-auto border border-ink/10 bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-[0.14em] text-ink/45">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Permissions</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr
                className="cursor-pointer border-t border-ink/10 bg-white"
                key={role.id}
                onClick={() => setEditingRoleId(role.id)}
              >
                <td className="px-4 py-3">
                  <p className="font-black text-ink">{role.name}</p>
                  <p className="mt-1 text-ink/55">
                    {role.description ?? "No description"}
                  </p>
                </td>
                <td className="px-4 py-3 text-ink/65">
                  {role.permissions.length} assigned
                </td>
                <td className="px-4 py-3 text-ink/65">
                  {role._count?.users ?? 0}
                </td>
                <td className="px-4 py-3 font-bold text-ink/60">
                  {role.isSystem ? "System" : "Custom"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <div className="grid gap-5">
          <RoleForm
            onSubmit={createRole}
            permissions={permissions}
            title="Create role"
          />
        </div>
      ) : null}
    </section>
  );
}

function RoleForm({
  disabled,
  onSubmit,
  permissions,
  role,
  title,
}: {
  disabled?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  permissions: Permission[];
  role?: Role;
  title: string;
}) {
  const selected = new Set(
    role?.permissions.map((rolePermission) => rolePermission.permission.key) ??
      [],
  );

  return (
    <form
      className="rounded-lg border border-ink/10 bg-white p-5"
      onSubmit={onSubmit}
    >
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <label className="field mt-4">
        <span className="text-sm font-bold text-ink">Name</span>
        <input
          defaultValue={role?.name ?? ""}
          disabled={disabled}
          name="name"
          required
        />
      </label>
      <label className="field mt-4">
        <span className="text-sm font-bold text-ink">Description</span>
        <input
          defaultValue={role?.description ?? ""}
          disabled={disabled}
          name="description"
        />
      </label>
      <div className="mt-4 grid max-h-64 gap-2 overflow-auto pr-1">
        {permissions.map((permission) => (
          <label
            className="flex items-start gap-3 rounded-md border border-ink/10 p-3 text-sm"
            key={permission.key}
          >
            <input
              className="mt-1"
              defaultChecked={selected.has(permission.key)}
              disabled={disabled}
              name="permissionKeys"
              type="checkbox"
              value={permission.key}
            />
            <span>
              <span className="block font-bold text-ink">{permission.key}</span>
              <span className="text-ink/55">{permission.description}</span>
            </span>
          </label>
        ))}
      </div>
      <button
        className="mt-5 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white disabled:opacity-50"
        disabled={disabled}
        type="submit"
      >
        Save role
      </button>
    </form>
  );
}

function PermissionsPanel({
  canManage,
  completeAction,
  permissions,
  request,
  roles,
}: {
  canManage: boolean;
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  permissions: Permission[];
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  roles: Role[];
}) {
  async function syncCatalog() {
    await completeAction(
      () => request("/admin/permissions/seed", { method: "POST" }),
      "Permission catalog synced.",
    );
  }

  return (
    <section className="mt-7">
      {canManage ? (
        <div className="mb-5 flex justify-end">
          <button
            className="rounded-lg bg-ink px-4 py-3 font-bold text-white"
            onClick={syncCatalog}
            type="button"
          >
            Sync catalog
          </button>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {permissions.map((permission) => {
          const assignedRoles = roles.filter((role) =>
            role.permissions.some(
              (rolePermission) =>
                rolePermission.permission.key === permission.key,
            ),
          );

          return (
            <article
              className="rounded-lg border border-ink/10 bg-white p-5"
              key={permission.key}
            >
              <h2 className="break-all text-lg font-black text-ink">
                {permission.key}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                {permission.description}
              </p>
              <p className="mt-4 text-sm font-bold text-leaf">
                {assignedRoles.length} roles assigned
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StaffPanel({
  canManage,
  completeAction,
  request,
  roles,
  staff,
}: {
  canManage: boolean;
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  roles: Role[];
  staff: Staff[];
}) {
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const selectedStaff =
    staff.find((member) => member.id === selectedStaffId) ?? null;

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await completeAction(
      () =>
        request("/admin/staff", {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            email: form.get("email"),
            password: form.get("password"),
            roleIds: form.getAll("roleIds").map(String),
          }),
        }),
      "Staff account created.",
    );
    event.currentTarget.reset();
  }

  async function updateStaff(
    event: FormEvent<HTMLFormElement>,
    userId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");

    await completeAction(
      () =>
        request(`/admin/staff/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.get("name"),
            password: password || undefined,
            status: form.get("status"),
            roleIds: form.getAll("roleIds").map(String),
          }),
        }),
      "Staff account updated.",
    );
    event.currentTarget.reset();
  }

  if (selectedStaff) {
    const selectedRoles = new Set(
      selectedStaff.roles.map((userRole) => userRole.role.id),
    );
    const protectedAccount = selectedStaff.roles.some(
      (userRole) => userRole.role.name === "SUPER_ADMIN",
    );

    return (
      <section className="mt-7 grid gap-5">
        <button
          className="w-fit rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink"
          onClick={() => setSelectedStaffId("")}
          type="button"
        >
          Back to staff
        </button>
        <form
          className="border border-ink/10 bg-white p-5"
          onSubmit={(event) => updateStaff(event, selectedStaff.id)}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-ink">
                {selectedStaff.name}
              </h2>
              <p className="mt-1 break-all text-sm text-ink/60">
                {selectedStaff.email}
              </p>
            </div>
            <p className="text-sm font-black text-leaf">
              {selectedStaff.status}
            </p>
          </div>
          {canManage ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="field">
                <span className="text-sm font-bold text-ink">Name</span>
                <input defaultValue={selectedStaff.name} name="name" required />
              </label>
              <label className="field">
                <span className="text-sm font-bold text-ink">Password</span>
                <input
                  disabled={protectedAccount}
                  minLength={8}
                  name="password"
                  placeholder="Leave unchanged"
                  type="password"
                />
              </label>
              <label className="field">
                <span className="text-sm font-bold text-ink">Status</span>
                <select
                  className="rounded-lg border border-ink/20 bg-white px-3 py-3"
                  defaultValue={selectedStaff.status}
                  disabled={protectedAccount}
                  name="status"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="text-sm font-bold text-ink">Roles</p>
                <div className="mt-2 grid max-h-36 gap-2 overflow-auto">
                  {roles
                    .filter((role) => role.name !== "SUPER_ADMIN")
                    .map((role) => (
                      <label
                        className="flex items-center gap-2 text-sm"
                        key={role.id}
                      >
                        <input
                          defaultChecked={selectedRoles.has(role.id)}
                          disabled={protectedAccount}
                          name="roleIds"
                          type="checkbox"
                          value={role.id}
                        />
                        {role.name}
                      </label>
                    ))}
                </div>
              </div>
              <button
                className="rounded-lg bg-ink px-4 py-3 font-bold text-white disabled:opacity-50 md:col-span-2"
                disabled={protectedAccount}
                type="submit"
              >
                Update staff
              </button>
            </div>
          ) : null}
        </form>
      </section>
    );
  }

  return (
    <section className="mt-7 grid gap-5">
      <div className="overflow-x-auto border border-ink/10 bg-white">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-[0.14em] text-ink/45">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr
                className="cursor-pointer border-t border-ink/10 bg-white"
                key={member.id}
                onClick={() => setSelectedStaffId(member.id)}
              >
                <td className="px-4 py-3">
                  <p className="font-black text-ink">{member.name}</p>
                  <p className="break-all text-xs text-ink/45">
                    {member.email}
                  </p>
                </td>
                <td className="px-4 py-3 font-bold text-leaf">
                  {member.status}
                </td>
                <td className="px-4 py-3 text-ink/60">
                  {member.roles.map((userRole) => userRole.role.name).join(", ") ||
                    "No roles"}
                </td>
                <td className="px-4 py-3 text-ink/55">
                  {displayDate(member.lastLoginAt)}
                </td>
                <td className="px-4 py-3 text-ink/55">
                  {displayDate(member.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <form
          className="border border-ink/10 bg-white p-5"
          onSubmit={createStaff}
        >
          <h2 className="text-lg font-black text-ink">Create staff</h2>
          <label className="field mt-4">
            <span className="text-sm font-bold text-ink">Name</span>
            <input name="name" required />
          </label>
          <label className="field mt-4">
            <span className="text-sm font-bold text-ink">Email</span>
            <input name="email" required type="email" />
          </label>
          <label className="field mt-4">
            <span className="text-sm font-bold text-ink">Password</span>
            <input minLength={8} name="password" required type="password" />
          </label>
          <div className="mt-4">
            <p className="text-sm font-bold text-ink">Roles</p>
            <div className="mt-2 grid gap-2">
              {roles
                .filter((role) => role.name !== "SUPER_ADMIN")
                .map((role) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    key={role.id}
                  >
                    <input name="roleIds" type="checkbox" value={role.id} />
                    {role.name}
                  </label>
                ))}
            </div>
          </div>
          <button className="mt-5 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
            Create staff
          </button>
        </form>
      ) : null}
    </section>
  );
}

function SessionsPanel({
  canManage,
  completeAction,
  request,
  sessions,
}: {
  canManage: boolean;
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  sessions: Session[];
}) {
  async function forceLogout(session: Session) {
    await completeAction(
      () =>
        request(`/admin/sessions/${session.id}/force-logout`, {
          method: "POST",
        }),
      "Session revoked.",
    );
  }

  return (
    <section className="mt-7 overflow-x-auto rounded-lg border border-ink/10 bg-white">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="bg-paper text-ink/60">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Expires</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr className="border-t border-ink/10" key={session.id}>
              <td className="px-4 py-3">
                <p className="font-bold text-ink">{session.user.name}</p>
                <p className="break-all text-ink/55">{session.user.email}</p>
              </td>
              <td className="px-4 py-3 text-ink/65">
                {displayDate(session.createdAt)}
              </td>
              <td className="px-4 py-3 text-ink/65">
                {displayDate(session.expiresAt)}
              </td>
              <td className="px-4 py-3 font-bold text-ink">
                {session.revokedAt
                  ? (session.revocationReason ?? "REVOKED")
                  : "ACTIVE"}
              </td>
              <td className="px-4 py-3">
                {canManage && !session.revokedAt ? (
                  <button
                    className="rounded-md border border-rose/30 px-3 py-2 font-bold text-rose"
                    onClick={() => forceLogout(session)}
                    type="button"
                  >
                    Force logout
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AuditPanel({ logs }: { logs: AuditLog[] }) {
  if (!logs.length) {
    return (
      <section className="mt-7 rounded-lg border border-ink/10 bg-white p-6">
        <h2 className="text-xl font-black text-ink">No audit events yet</h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          New login, content, blog, staff, role, and session actions will appear
          here.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-7 grid gap-3">
      {logs.map((log) => (
        <article
          className="rounded-lg border border-ink/10 bg-white p-4"
          key={log.id}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-black text-ink">{log.action}</h2>
              <p className="mt-1 text-sm text-ink/55">
                {log.entityType}
                {log.entityId ? ` / ${log.entityId}` : ""}
              </p>
            </div>
            <p className="text-sm text-ink/50">{displayDate(log.createdAt)}</p>
          </div>
          <p className="mt-3 text-sm text-ink/60">
            {log.actor ? `${log.actor.name} (${log.actor.email})` : "System"}
          </p>
        </article>
      ))}
    </section>
  );
}
