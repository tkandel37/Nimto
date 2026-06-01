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

type TabKey = "overview" | "roles" | "permissions" | "staff" | "sessions" | "audit";

const tabs: { key: TabKey; label: string; permission: string | null }[] = [
  { key: "overview", label: "Dashboard", permission: null },
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

function can(user: AuthUser | null, permission: string | null) {
  if (!permission) {
    return true;
  }

  return Boolean(
    user?.permissions?.includes("*") || user?.permissions?.includes(permission),
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

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => can(user, tab.permission)),
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

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}) => {
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
  }, []);

  const refreshAdminData = useCallback(async (authUser = user) => {
    const savedToken = localStorage.getItem("nimto_token");
    if (!savedToken || !authUser) {
      return;
    }

    setIsRefreshing(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${savedToken}` };
      const results = await Promise.all([
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
      ]);

      setPermissions(results[0]);
      setRoles(results[1]);
      setStaff(results[2]);
      setSessions(results[3]);
      setAuditLogs(results[4]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load admin data.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

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

  async function completeAction(action: () => Promise<unknown>, message: string) {
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
        <Link
          href="/"
          className="text-2xl font-black uppercase tracking-[0.28em] text-marigold"
        >
          Nimto
        </Link>
        <p className="mt-3 text-sm leading-6 text-white/65">
          Digital invitation workspace
        </p>
        <nav className="mt-10 grid gap-2 text-sm font-bold">
          {visibleTabs.map((tab) => (
            <button
              className={
                currentTab === tab.key
                  ? "rounded-lg bg-white/10 px-4 py-3 text-left text-white"
                  : "rounded-lg px-4 py-3 text-left text-white/60 hover:bg-white/5 hover:text-white"
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

      <section className="min-w-0 p-5 md:p-8">
        <header className="flex flex-col gap-4 border-b border-ink/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
              Connected account
            </p>
            <h1 className="mt-3 text-3xl font-black text-ink md:text-4xl">
              {user?.name ?? "Creator"}
            </h1>
            <p className="mt-2 break-all text-ink/65">{user?.email}</p>
            {user?.roles?.length ? (
              <p className="mt-2 text-sm font-bold text-ink/45">
                {user.roles.join(", ")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-lg border border-ink/20 bg-white px-4 py-3 font-bold text-ink"
              disabled={isRefreshing}
              onClick={() => refreshAdminData()}
              type="button"
            >
              Refresh
            </button>
            <button
              className="rounded-lg border border-ink/20 bg-white px-4 py-3 font-bold text-ink"
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
            roleCount={roles.length}
            sessionCount={sessions.filter((session) => !session.revokedAt).length}
            staffCount={staff.length}
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
          <PermissionsPanel permissions={permissions} roles={roles} />
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
  roleCount,
  sessionCount,
  staffCount,
}: {
  auditCount: number;
  roleCount: number;
  sessionCount: number;
  staffCount: number;
}) {
  return (
    <section className="mt-7 grid gap-4 md:grid-cols-4">
      <Metric label="Roles" value={roleCount} tone="text-leaf" />
      <Metric label="Staff" value={staffCount} tone="text-marigold" />
      <Metric label="Active sessions" value={sessionCount} tone="text-rose" />
      <Metric label="Audit events" value={auditCount} tone="text-ink" />
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

function RolesPanel({
  canManage,
  completeAction,
  permissions,
  request,
  roles,
}: {
  canManage: boolean;
  completeAction: (action: () => Promise<unknown>, message: string) => Promise<void>;
  permissions: Permission[];
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  roles: Role[];
}) {
  const [editingRoleId, setEditingRoleId] = useState("");
  const editingRole = roles.find((role) => role.id === editingRoleId) ?? roles[0];

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
      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white">
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
                  <p className="mt-1 text-ink/55">{role.description ?? "No description"}</p>
                </td>
                <td className="px-4 py-3 text-ink/65">
                  {role.permissions.length} assigned
                </td>
                <td className="px-4 py-3 text-ink/65">{role._count?.users ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-ink/15 px-3 py-2 font-bold"
                      onClick={() => setEditingRoleId(role.id)}
                      type="button"
                    >
                      Edit
                    </button>
                    {canManage && !role.isSystem ? (
                      <button
                        className="rounded-md border border-rose/30 px-3 py-2 font-bold text-rose"
                        onClick={() => deleteRole(role)}
                        type="button"
                      >
                        Delete
                      </button>
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
    role?.permissions.map((rolePermission) => rolePermission.permission.key) ?? [],
  );

  return (
    <form className="rounded-lg border border-ink/10 bg-white p-5" onSubmit={onSubmit}>
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <label className="field mt-4">
        <span className="text-sm font-bold text-ink">Name</span>
        <input defaultValue={role?.name ?? ""} disabled={disabled} name="name" required />
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
  permissions,
  roles,
}: {
  permissions: Permission[];
  roles: Role[];
}) {
  return (
    <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {permissions.map((permission) => {
        const assignedRoles = roles.filter((role) =>
          role.permissions.some(
            (rolePermission) => rolePermission.permission.key === permission.key,
          ),
        );

        return (
          <article className="rounded-lg border border-ink/10 bg-white p-5" key={permission.key}>
            <h2 className="break-all text-lg font-black text-ink">{permission.key}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              {permission.description}
            </p>
            <p className="mt-4 text-sm font-bold text-leaf">
              {assignedRoles.length} roles assigned
            </p>
          </article>
        );
      })}
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
  completeAction: (action: () => Promise<unknown>, message: string) => Promise<void>;
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

  async function updateStaff(event: FormEvent<HTMLFormElement>, userId: string) {
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
          const selectedRoles = new Set(member.roles.map((userRole) => userRole.role.id));
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
                  <p className="mt-1 break-all text-sm text-ink/60">{member.email}</p>
                  <p className="mt-2 text-sm font-bold text-leaf">{member.status}</p>
                </div>
                <p className="text-sm text-ink/45">{displayDate(member.lastLoginAt)}</p>
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
                          <label className="flex items-center gap-2 text-sm" key={role.id}>
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
        <form className="rounded-lg border border-ink/10 bg-white p-5" onSubmit={createStaff}>
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
                  <label className="flex items-center gap-2 text-sm" key={role.id}>
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
  completeAction: (action: () => Promise<unknown>, message: string) => Promise<void>;
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
    <section className="mt-7 overflow-hidden rounded-lg border border-ink/10 bg-white">
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
              <td className="px-4 py-3 text-ink/65">{displayDate(session.createdAt)}</td>
              <td className="px-4 py-3 text-ink/65">{displayDate(session.expiresAt)}</td>
              <td className="px-4 py-3 font-bold text-ink">
                {session.revokedAt ? session.revocationReason ?? "REVOKED" : "ACTIVE"}
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
  return (
    <section className="mt-7 grid gap-3">
      {logs.map((log) => (
        <article className="rounded-lg border border-ink/10 bg-white p-4" key={log.id}>
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
