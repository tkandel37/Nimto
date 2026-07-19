"use client";

import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, apiRequest, AuthUser } from "@/lib/api";
import {
  AUTH_SESSION_MARKER,
  clearAuthSession,
  isSessionFresh,
  readAuthSession,
  saveAuthSession,
} from "@/lib/auth-session";

type WorkspacePage = "events" | "designs" | "myDesigns" | "profile";

type Toast = {
  id: number;
  tone: "success" | "error";
  message: string;
};

type AuthState = {
  isChecking: boolean;
  token: string;
  user: AuthUser | null;
};

type UserWorkspaceContextValue = {
  authHeaders: Record<string, string>;
  refreshUser: () => Promise<AuthUser | null>;
  showToast: (message: string, tone?: Toast["tone"]) => void;
  token: string;
  user: AuthUser;
};

const UserWorkspaceContext = createContext<UserWorkspaceContextValue | null>(
  null,
);

const pageLinks: {
  key: WorkspacePage;
  label: string;
  href: string;
  icon: ReactNode;
}[] = [
  {
    key: "events",
    label: "Events",
    href: "/events",
    icon: (
      <>
        <path d="M7 3v4M17 3v4" />
        <rect x="4" y="5" width="16" height="17" rx="3" />
        <path d="M4 10h16M8 14h.01M12 14h.01M16 14h.01" />
      </>
    ),
  },
  {
    key: "designs",
    label: "Invitations",
    href: "/designs",
    icon: (
      <>
        <path d="M4 20h16" />
        <path d="m6 16 8.5-8.5 2 2L8 18H6v-2Z" />
        <path d="m13.5 7.5 1.8-1.8a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2l-1.8 1.8" />
      </>
    ),
  },
  {
    key: "myDesigns",
    label: "My Invitations",
    href: "/my-designs",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M8 8h8M8 12h5M8 16h3" />
        <path d="m15 15 1.5 1.5L20 13" />
      </>
    ),
  },
  {
    key: "profile",
    label: "Profile",
    href: "/profile",
    icon: (
      <>
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  },
];

let userRefreshPromise: Promise<{ user: AuthUser }> | null = null;
let workspaceHasMounted = false;

export function UserFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activePage = workspacePage(pathname);
  const isUserArea = activePage !== null;
  const workspaceHomeHref = activePage === "designs" ? "/designs" : "/events";
  const [authState, setAuthState] = useState<AuthState>(() => {
    const session = workspaceHasMounted ? readAuthSession() : null;
    return session
      ? { isChecking: false, token: session.token, user: session.user }
      : { isChecking: true, token: "", user: null };
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const isLoggingOutRef = useRef(false);
  const { isChecking, token, user } = authState;

  const showToast = useCallback(
    (message: string, tone: Toast["tone"] = "success") => {
      const id = Date.now();
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    },
    [],
  );

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const refreshUser = useCallback(async () => {
    const session = readAuthSession();
    if (!session?.token) {
      setAuthState({ isChecking: false, token: "", user: null });
      return null;
    }

    userRefreshPromise ??= apiRequest<{ user: AuthUser }>("/auth/me", {
      headers: { Authorization: `Bearer ${session.token}` },
    }).finally(() => {
      userRefreshPromise = null;
    });
    const response = await userRefreshPromise;
    saveAuthSession(session.token, response.user);
    setAuthState({
      isChecking: false,
      token: session.token,
      user: response.user,
    });
    return response.user;
  }, []);

  useEffect(() => {
    if (!isUserArea) return;
    pageLinks.forEach((link) => router.prefetch(link.href));
  }, [isUserArea, router]);

  useEffect(() => {
    if (!isUserArea) return;
    let isActive = true;
    workspaceHasMounted = true;
    const storedAuth = readAuthSession();

    if (!storedAuth?.token) {
      setAuthState({ isChecking: false, token: "", user: null });
      return;
    }

    setAuthState({
      ...storedAuth,
      isChecking: false,
    });

    if (isSessionFresh()) {
      return;
    }

    refreshUser()
      .catch((error) => {
        if (!isActive) return;
        if (isAuthFailure(error)) {
          clearAuthSession();
          setAuthState({ isChecking: false, token: "", user: null });
          return;
        }
        setAuthState((current) => ({
          ...current,
          isChecking: false,
        }));
      })
      .finally(() => {
        if (!isActive) return;
        setAuthState((current) => ({
          ...current,
          isChecking: false,
        }));
      });

    return () => {
      isActive = false;
    };
  }, [isUserArea, refreshUser]);

  useEffect(() => {
    if (!isUserArea) return;

    function syncSession() {
      const session = readAuthSession();
      if (session) {
        setAuthState({
          isChecking: false,
          token: session.token,
          user: session.user,
        });
        return;
      }
      setAuthState({ isChecking: false, token: "", user: null });
      if (window.location.pathname !== "/auth") {
        window.location.replace("/auth?mode=login");
      }
    }

    window.addEventListener("pageshow", syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener("pageshow", syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, [isUserArea]);

  useEffect(() => {
    if (!isUserArea || isChecking || token || isLoggingOutRef.current) return;
    window.location.replace("/auth?mode=login");
  }, [isChecking, isUserArea, token]);

  async function logout() {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await apiRequest("/auth/logout", {
        headers: {
          Authorization: `Bearer ${token || AUTH_SESSION_MARKER}`,
        },
        method: "POST",
      });
      clearAuthSession();
      setAuthState({ isChecking: false, token: "", user: null });
      window.location.replace("/");
    } catch {
      isLoggingOutRef.current = false;
      showToast("We could not log you out. Please try again.", "error");
    }
  }

  if (!isUserArea || !activePage) {
    return <>{children}</>;
  }

  if (isChecking && !user) {
    return <PendingUserShell activePage={activePage} />;
  }

  if (!token) {
    return <PendingUserShell activePage={activePage} />;
  }

  if (!user) {
    return (
      <main className="user-shell">
        <section className="user-auth-card">
          <Link className="text-xl font-black text-ink" href="/">
            myNimto
          </Link>
          <h1 className="mt-6 text-3xl font-black text-ink">
            Getting your invitations back
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            Your session is still saved. We just need the server to answer once
            so we can bring your events back.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="user-primary-button"
              onClick={() => {
                setAuthState((current) => ({ ...current, isChecking: true }));
                refreshUser().catch((error) => {
                  if (isAuthFailure(error)) {
                    clearAuthSession();
                    setAuthState({ isChecking: false, token: "", user: null });
                    return;
                  }
                  setAuthState((current) => ({
                    ...current,
                    isChecking: false,
                  }));
                  showToast("Could not reconnect. Please try again.", "error");
                });
              }}
              type="button"
            >
              Retry
            </button>
            <button
              className="user-secondary-button"
              onClick={logout}
              type="button"
            >
              Log in again
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <UserWorkspaceContext.Provider
      value={{ authHeaders, refreshUser, showToast, token, user }}
    >
      <main className="user-shell">
        <aside className="user-sidebar">
          <Link className="user-logo" href={workspaceHomeHref}>
            <BrandLogo compact />
          </Link>
          <nav className="user-nav">
            {pageLinks.map((link) => (
              <Link
                aria-current={activePage === link.key ? "page" : undefined}
                className={
                  activePage === link.key
                    ? "user-nav-link active"
                    : "user-nav-link"
                }
                href={link.href}
                key={link.key}
              >
                <Icon>{link.icon}</Icon>
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>
          <div className="user-sidebar-note">
            <span>✍</span>
            <p>Draft, check, send</p>
          </div>
        </aside>

        <section className="user-main">
          <header className="user-topbar">
            <Link className="user-mobile-logo" href={workspaceHomeHref}>
              <BrandLogo compact />
            </Link>
            <div className="user-workspace-context">
              <span>Your invitation desk</span>
              <strong>
                {pageLinks.find((link) => link.key === activePage)?.label}
              </strong>
            </div>
            <div className="user-account-menu">
              <button
                aria-expanded={isAccountMenuOpen}
                className="user-account-trigger"
                onClick={() => setIsAccountMenuOpen((value) => !value)}
                type="button"
              >
                <span className="user-account-avatar" aria-hidden="true">
                  {user.name.trim().charAt(0).toUpperCase() || "U"}
                </span>
                <span className="user-account-name">{user.name}</span>
              </button>
              <div
                aria-hidden={!isAccountMenuOpen}
                className={
                  isAccountMenuOpen
                    ? "user-account-popover open"
                    : "user-account-popover"
                }
                inert={!isAccountMenuOpen}
              >
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setIsAccountMenuOpen(false)}
                >
                  Profile
                </Link>
                <button onClick={logout} type="button">
                  Log out
                </button>
              </div>
            </div>
          </header>
          <div className="user-page">{children}</div>
        </section>

        <nav
          className="user-bottom-nav"
          aria-label="Mobile workspace navigation"
        >
          {pageLinks.map((link) => (
            <Link
              aria-current={activePage === link.key ? "page" : undefined}
              className={activePage === link.key ? "active" : ""}
              href={link.href}
              key={link.key}
            >
              <Icon>{link.icon}</Icon>
              <span>
                {link.label === "My Invitations" ? "Saved" : link.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="user-toast-region" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div
              className={
                toast.tone === "error"
                  ? "user-toast user-toast-error"
                  : "user-toast"
              }
              key={toast.id}
            >
              <span className="user-toast-dot" />
              <p>{toast.message}</p>
              <button
                aria-label="Close notification"
                onClick={() =>
                  setToasts((current) =>
                    current.filter((item) => item.id !== toast.id),
                  )
                }
                type="button"
              >
                x
              </button>
            </div>
          ))}
        </div>
      </main>
    </UserWorkspaceContext.Provider>
  );
}

function PendingUserShell({ activePage }: { activePage: WorkspacePage }) {
  return (
    <main className="user-shell">
      <aside className="user-sidebar user-sidebar-pending" aria-hidden="true">
        <Link className="user-logo" href="/events" tabIndex={-1}>
          <BrandLogo compact />
        </Link>
        <nav className="user-nav">
          {pageLinks.map((link) => (
            <span
              className={
                activePage === link.key
                  ? "user-nav-link active"
                  : "user-nav-link"
              }
              key={link.key}
            >
              <Icon>{link.icon}</Icon>
              <span>{link.label}</span>
            </span>
          ))}
        </nav>
        <div className="user-sidebar-note">
          <span>✍</span>
          <p>Draft, check, send</p>
        </div>
      </aside>

      <section className="user-main">
        <header className="user-topbar">
          <Link className="user-mobile-logo" href="/events" tabIndex={-1}>
            <BrandLogo compact />
          </Link>
          <div className="user-workspace-context">
            <span>Your invitation desk</span>
            <strong>
              {pageLinks.find((link) => link.key === activePage)?.label}
            </strong>
          </div>
          <div className="user-session-buffer" aria-hidden="true" />
        </header>
        <div className="user-page">
          <section className="user-panel user-panel-pending" aria-hidden="true">
            <span />
            <span />
            <span />
          </section>
        </div>
      </section>

      <nav className="user-bottom-nav" aria-hidden="true">
        {pageLinks.map((link) => (
          <span
            className={activePage === link.key ? "active" : ""}
            key={link.key}
          >
            <Icon>{link.icon}</Icon>
            <span>
              {link.label === "My Invitations" ? "Saved" : link.label}
            </span>
          </span>
        ))}
      </nav>
    </main>
  );
}

export function UserWorkspace({
  children,
}: {
  activePage: WorkspacePage;
  children: (context: UserWorkspaceContextValue) => ReactNode;
}) {
  const context = useContext(UserWorkspaceContext);
  if (!context) {
    return null;
  }
  return <>{children(context)}</>;
}

function workspacePage(pathname: string): WorkspacePage | null {
  if (pathname === "/events" || pathname.startsWith("/events/")) {
    return "events";
  }
  if (pathname === "/designs") return "designs";
  if (pathname === "/my-designs") return "myDesigns";
  if (pathname === "/profile") return "profile";
  return null;
}

export function ProfileForm({
  authHeaders,
  refreshUser,
  showToast,
  user,
}: {
  authHeaders: Record<string, string>;
  refreshUser: () => Promise<AuthUser | null>;
  showToast: (message: string, tone?: Toast["tone"]) => void;
  user: AuthUser;
}) {
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingEmail, setIsConfirmingEmail] = useState(false);

  useEffect(() => {
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await apiRequest<{
        user: AuthUser;
        emailChangePending?: boolean;
        message?: string;
      }>("/auth/profile", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ name, email, phone, currentPassword }),
      });
      saveAuthSession(
        localStorage.getItem("nimto_session") ?? "",
        response.user,
      );
      await refreshUser();
      setCurrentPassword("");
      if (response.emailChangePending) {
        setPendingEmail(email.trim().toLowerCase());
        showToast(response.message ?? "Verification code sent.");
      } else {
        showToast("Profile updated.");
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Profile update failed.",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsConfirmingEmail(true);
    try {
      const response = await apiRequest<{ message: string }>(
        "/auth/profile/email/confirm",
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ email: pendingEmail, code: emailCode }),
        },
      );
      clearAuthSession();
      showToast(response.message);
      window.location.assign("/auth?mode=login");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Email confirmation failed.",
        "error",
      );
    } finally {
      setIsConfirmingEmail(false);
    }
  }

  return (
    <section className="profile-page">
      <header className="profile-identity-card">
        <span className="profile-avatar" aria-hidden="true">
          {user.name.trim().charAt(0).toUpperCase() || "U"}
        </span>
        <div>
          <p className="user-kicker">My profile</p>
          <h1>{user.name}</h1>
          <p>{user.email}</p>
        </div>
        <span
          className={
            user.emailVerifiedAt
              ? "profile-verified"
              : "profile-verified pending"
          }
        >
          {user.emailVerifiedAt ? "Verified account" : "Verification pending"}
        </span>
      </header>

      <div className="profile-content-grid">
        <form className="user-panel profile-form" onSubmit={submit}>
          <div className="profile-section-heading">
            <div>
              <p className="user-kicker">Personal information</p>
              <h2>Account details</h2>
            </div>
            <span>Keep your contact details current</span>
          </div>
          <div className="profile-fields-grid">
            <label className="user-field">
              <span>Full name</span>
              <input
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </label>
            <label className="user-field">
              <span>Phone number</span>
              <input
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Add phone number"
                value={phone}
              />
            </label>
            <label className="user-field profile-email-field">
              <span>Email address</span>
              <input
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            {email.trim().toLowerCase() !== user.email.toLowerCase() ? (
              <label className="user-field profile-email-field">
                <span>Current password</span>
                <input
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </label>
            ) : null}
          </div>
          <div className="profile-form-actions">
            <span>Changes apply across your myNimto account.</span>
            <button
              className="user-primary-button"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>

        {pendingEmail ? (
          <form className="user-panel profile-form" onSubmit={confirmEmail}>
            <div className="profile-section-heading">
              <div>
                <p className="user-kicker">Confirm new email</p>
                <h2>Enter the code sent to {pendingEmail}</h2>
              </div>
            </div>
            <label className="user-field">
              <span>6-digit verification code</span>
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) =>
                  setEmailCode(event.target.value.replace(/\D/g, ""))
                }
                pattern="[0-9]{6}"
                required
                value={emailCode}
              />
            </label>
            <div className="profile-form-actions">
              <span>You will sign in again after the email changes.</span>
              <button
                className="user-primary-button"
                disabled={isConfirmingEmail}
                type="submit"
              >
                {isConfirmingEmail ? "Confirming..." : "Confirm email"}
              </button>
            </div>
          </form>
        ) : null}

        <aside className="user-panel profile-account-card">
          <p className="user-kicker">Account</p>
          <h2>Profile status</h2>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{user.emailVerifiedAt ? "Verified" : "Pending"}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  year: "numeric",
                }).format(new Date(user.createdAt))}
              </dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>{user.status?.toLowerCase() || "active"}</dd>
            </div>
          </dl>
          <p>
            Your account details are used only for managing invitations and
            communication.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function Icon({ children }: { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

function isAuthFailure(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  );
}
