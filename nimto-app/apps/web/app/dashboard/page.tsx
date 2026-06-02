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
  categoryId?: string | null;
  subcategoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Pick<DesignCategory, "id" | "name" | "slug"> | null;
  subcategory?: Pick<DesignSubcategory, "id" | "name" | "slug"> | null;
  createdBy?: Pick<AuthUser, "id" | "name" | "email"> | null;
};

type PageContent = {
  id: string;
  key: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  updatedAt: string;
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
  const [pages, setPages] = useState<PageContent[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  const visibleTabs = useMemo(
    () =>
      tabs.filter((tab) => {
        if (tab.key === "designSetup") {
          return canAny(user, [
            "category:view",
            "category:manage",
            "subcategory:view",
            "subcategory:manage",
            "template:view:own",
            "template:view:all",
            "template:create",
            "template:update:own",
            "template:update:all",
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
  const currentTab = visibleTabs.some((tab) => tab.key === activeTab)
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
          ])
            ? apiRequest<InvitationTemplate[]>("/template-design/templates", {
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
        setPages(results[8]);
        setBlogPosts(results[9]);
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
      </aside>

      <section className="min-w-0 p-4 md:p-8">
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
            events={events}
            request={request}
          />
        ) : null}
        {currentTab === "designSetup" ? (
          <DesignSetupPanel
            canManageCategories={can(user, "category:manage")}
            canManageSubcategories={can(user, "subcategory:manage")}
            canCreateTemplates={can(user, "template:create")}
            categories={designCategories}
            completeAction={completeAction}
            request={request}
            templates={templates}
          />
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
  events,
  request,
}: {
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  events: InvitationEvent[];
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
}) {
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
  }

  return (
    <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-4">
        {events.length ? (
          events.map((invitationEvent) => (
            <form
              className="rounded-lg border border-ink/10 bg-white p-5"
              key={invitationEvent.id}
              onSubmit={(event) => updateEvent(event, invitationEvent)}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-ink">
                    {invitationEvent.title}
                  </h2>
                  <p className="mt-1 text-sm text-ink/60">
                    /invite/{invitationEvent.slug}
                  </p>
                  <p className="mt-2 text-sm font-bold text-leaf">
                    {invitationEvent.isPublished ? "Published" : "Draft"}
                  </p>
                </div>
                <p className="text-sm text-ink/45">
                  {displayDate(invitationEvent.eventDate)}
                </p>
              </div>
              <EventFields event={invitationEvent} />
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="rounded-lg bg-ink px-4 py-3 font-bold text-white">
                  Update event
                </button>
                <button
                  className="rounded-lg border border-rose/30 px-4 py-3 font-bold text-rose"
                  onClick={() => deleteEvent(invitationEvent)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </form>
          ))
        ) : (
          <div className="rounded-lg border border-ink/10 bg-white p-6">
            <h2 className="text-xl font-black text-ink">No events yet</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Create the first invitation workspace to start managing event
              details.
            </p>
          </div>
        )}
      </div>

      <form
        className="rounded-lg border border-ink/10 bg-white p-5"
        onSubmit={createEvent}
      >
        <h2 className="text-lg font-black text-ink">Create event</h2>
        <EventFields />
        <button className="mt-5 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
          Create event
        </button>
      </form>
    </section>
  );
}

function EventFields({ event }: { event?: InvitationEvent }) {
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

  return {
    title: form.get("title"),
    type: form.get("type"),
    eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
    venue: form.get("venue") || undefined,
    coverImage: coverImage || undefined,
    description: form.get("description") || undefined,
    isPublished: form.get("isPublished") === "on",
  };
}

function DesignSetupPanel({
  canManageCategories,
  canManageSubcategories,
  canCreateTemplates,
  categories,
  completeAction,
  request,
  templates,
}: {
  canManageCategories: boolean;
  canManageSubcategories: boolean;
  canCreateTemplates: boolean;
  categories: DesignCategory[];
  completeAction: (
    action: () => Promise<unknown>,
    message: string,
  ) => Promise<void>;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  templates: InvitationTemplate[];
}) {
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
  }

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
    <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-4">
        <div className="rounded-lg border border-ink/10 bg-white p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-black text-ink">Draft templates</h2>
              <p className="mt-1 text-sm leading-6 text-ink/55">
                Uploaded HTML files are stored as draft templates before they
                become published designs.
              </p>
            </div>
            <p className="text-sm font-black text-leaf">{templates.length}</p>
          </div>
          {templates.length ? (
            <div className="mt-5 grid gap-3">
              {templates.map((template) => (
                <article
                  className="rounded-lg border border-ink/10 bg-paper/70 p-4"
                  key={template.id}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-black text-ink">{template.name}</h3>
                      <p className="mt-1 text-sm text-ink/55">
                        {template.sourceFileName ?? "HTML template"} ·{" "}
                        {Math.ceil(template.htmlSize / 1024)} KB
                      </p>
                      <p className="mt-1 text-sm text-ink/45">
                        {[template.category?.name, template.subcategory?.name]
                          .filter(Boolean)
                          .join(" / ") || "Uncategorized"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-ink/55">
                        <span className="rounded-md bg-white px-2 py-1">
                          {template.scanResult?.fields?.length ?? 0} fields
                        </span>
                        <span className="rounded-md bg-white px-2 py-1">
                          {template.scanResult?.sections?.length ?? 0} sections
                        </span>
                        {template.scanResult?.countdownFieldKey ? (
                          <span className="rounded-md bg-white px-2 py-1">
                            countdown
                          </span>
                        ) : null}
                        {template.scanResult?.customNameFieldKeys?.length ? (
                          <span className="rounded-md bg-white px-2 py-1 text-marigold">
                            paid name
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm font-black text-marigold">
                      {template.status}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-ink/55">
              No templates uploaded yet.
            </p>
          )}
        </div>

        {categories.length ? (
          categories.map((category) => (
            <article
              className="rounded-lg border border-ink/10 bg-white p-5"
              key={category.id}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-ink">
                    {category.name}
                  </h2>
                  <p className="mt-1 text-sm text-ink/55">
                    /{category.slug}
                  </p>
                </div>
                <p className="text-sm font-black text-leaf">
                  {category.status}
                </p>
              </div>

              {canManageCategories ? (
                <form
                  className="mt-5 grid gap-4 md:grid-cols-2"
                  onSubmit={(event) => updateCategory(event, category)}
                >
                  <TaxonomyFields item={category} />
                  <button className="rounded-lg bg-ink px-4 py-3 font-bold text-white md:col-span-2">
                    Update category
                  </button>
                </form>
              ) : null}

              <div className="mt-6 border-t border-ink/10 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.16em] text-ink/55">
                    Subcategories
                  </h3>
                  <span className="text-sm font-bold text-ink/45">
                    {category.subcategories?.length ?? 0}
                  </span>
                </div>

                {category.subcategories?.length ? (
                  <div className="mt-4 grid gap-3">
                    {category.subcategories.map((subcategory) => (
                      <form
                        className="rounded-lg border border-ink/10 bg-paper/70 p-4"
                        key={subcategory.id}
                        onSubmit={(event) =>
                          updateSubcategory(event, subcategory)
                        }
                      >
                        <div className="grid gap-3 md:grid-cols-2">
                          <TaxonomyFields item={subcategory} />
                          {canManageSubcategories ? (
                            <button className="rounded-lg bg-ink px-4 py-3 font-bold text-white md:col-span-2">
                              Update subcategory
                            </button>
                          ) : null}
                        </div>
                      </form>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-ink/55">
                    No subcategories yet.
                  </p>
                )}

                {canManageSubcategories ? (
                  <form
                    className="mt-5 grid gap-4 md:grid-cols-2"
                    onSubmit={createSubcategory}
                  >
                    <input name="categoryId" type="hidden" value={category.id} />
                    <TaxonomyFields titlePrefix="New" />
                    <button className="rounded-lg border border-ink/15 bg-white px-4 py-3 font-bold text-ink md:col-span-2">
                      Add subcategory
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-ink/10 bg-white p-6">
            <h2 className="text-xl font-black text-ink">
              No design categories yet
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Create categories like Wedding, Birthday, Proposal, Festival, or
              Corporate before uploading templates.
            </p>
          </div>
        )}
      </div>

      <div className="grid content-start gap-5">
        {canCreateTemplates ? (
          <form
            className="rounded-lg border border-ink/10 bg-white p-5"
            onSubmit={createTemplate}
          >
            <h2 className="text-lg font-black text-ink">Upload template</h2>
            <div className="mt-5 grid gap-4">
              <label className="field">
                <span className="text-sm font-bold text-ink">Name</span>
                <input name="name" required />
              </label>
              <label className="field">
                <span className="text-sm font-bold text-ink">HTML file</span>
                <input accept=".html,text/html" name="templateFile" type="file" />
              </label>
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
                <span className="text-sm font-bold text-ink">Subcategory</span>
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
              <label className="field">
                <span className="text-sm font-bold text-ink">
                  Paste HTML fallback
                </span>
                <textarea
                  className="min-h-40 rounded-lg border border-ink/20 bg-white px-3 py-3"
                  name="rawHtml"
                />
              </label>
            </div>
            <button className="mt-5 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
              Upload draft
            </button>
          </form>
        ) : null}

        {canManageCategories ? (
          <form
            className="rounded-lg border border-ink/10 bg-white p-5"
            onSubmit={createCategory}
          >
            <h2 className="text-lg font-black text-ink">Create category</h2>
            <div className="mt-5 grid gap-4">
              <TaxonomyFields />
            </div>
            <button className="mt-5 w-full rounded-lg bg-ink px-4 py-3 font-bold text-white">
              Create category
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
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
    roles.find((role) => role.id === editingRoleId) ?? roles[0];

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
  }

  return (
    <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="overflow-x-auto rounded-lg border border-ink/10 bg-white">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-paper text-ink/60">
            <tr>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Permissions</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr className="border-t border-ink/10" key={role.id}>
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
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {canManage ? (
                      <>
                        <button
                          className="rounded-md border border-ink/15 px-3 py-2 font-bold"
                          onClick={() => setEditingRoleId(role.id)}
                          type="button"
                        >
                          Edit
                        </button>
                        {!role.isSystem ? (
                          <button
                            className="rounded-md border border-rose/30 px-3 py-2 font-bold text-rose"
                            onClick={() => deleteRole(role)}
                            type="button"
                          >
                            Delete
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <div className="grid gap-5">
          <RoleForm
            key={editingRole?.id ?? "edit-role"}
            disabled={editingRole?.isSystem}
            onSubmit={updateRole}
            permissions={permissions}
            role={editingRole}
            title="Edit role"
          />
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

  return (
    <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-4">
        {staff.map((member) => {
          const selectedRoles = new Set(
            member.roles.map((userRole) => userRole.role.id),
          );
          const protectedAccount = member.roles.some(
            (userRole) => userRole.role.name === "SUPER_ADMIN",
          );

          return (
            <form
              className="rounded-lg border border-ink/10 bg-white p-5"
              key={member.id}
              onSubmit={(event) => updateStaff(event, member.id)}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-ink">{member.name}</h2>
                  <p className="mt-1 break-all text-sm text-ink/60">
                    {member.email}
                  </p>
                  <p className="mt-2 text-sm font-bold text-leaf">
                    {member.status}
                  </p>
                </div>
                <p className="text-sm text-ink/45">
                  {displayDate(member.lastLoginAt)}
                </p>
              </div>
              {canManage ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="field">
                    <span className="text-sm font-bold text-ink">Name</span>
                    <input defaultValue={member.name} name="name" required />
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
                      defaultValue={member.status}
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
          );
        })}
      </div>

      {canManage ? (
        <form
          className="rounded-lg border border-ink/10 bg-white p-5"
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
