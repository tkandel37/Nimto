"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest, ApiError, AuthUser } from "@/lib/api";
import {
  AUTH_SESSION_MARKER,
  clearAuthSession,
  readAuthSession,
  saveAuthSession,
} from "@/lib/auth-session";

type AccountLinkState = {
  href: string;
  label: string;
};

let currentUserRequest: Promise<AuthUser> | null = null;

function fetchCurrentUser() {
  currentUserRequest ??= apiRequest<{ user: AuthUser }>("/auth/me")
    .then((response) => response.user)
    .finally(() => {
      currentUserRequest = null;
    });
  return currentUserRequest;
}

export function AuthAwareAccountLink({
  className,
  loggedOutLabel = "Log in",
}: {
  className: string;
  loggedOutLabel?: string;
}) {
  const [link, setLink] = useState<AccountLinkState>({
    href: "/auth?mode=login",
    label: loggedOutLabel,
  });

  useEffect(() => {
    let isActive = true;
    let refreshId = 0;

    function showUser(user: AuthUser) {
      setLink(
        isAdminUser(user)
          ? { href: "/dashboard", label: "Dashboard" }
          : { href: "/events", label: "My workspace" },
      );
    }

    function showCachedSession() {
      const session = readAuthSession();
      if (session) {
        showUser(session.user);
      } else {
        setLink({ href: "/auth?mode=login", label: loggedOutLabel });
      }
    }

    async function refreshSession() {
      const currentRefresh = ++refreshId;
      showCachedSession();

      try {
        const user = await fetchCurrentUser();
        if (!isActive || currentRefresh !== refreshId) return;
        saveAuthSession(AUTH_SESSION_MARKER, user);
        showUser(user);
      } catch (error) {
        if (!isActive || currentRefresh !== refreshId) return;
        if (error instanceof ApiError && error.status === 401) {
          clearAuthSession();
          setLink({ href: "/auth?mode=login", label: loggedOutLabel });
        }
      }
    }

    function refreshVisibleSession() {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    }

    showCachedSession();
    void refreshSession();
    window.addEventListener("pageshow", refreshVisibleSession);
    window.addEventListener("focus", refreshVisibleSession);
    window.addEventListener("storage", refreshVisibleSession);
    document.addEventListener("visibilitychange", refreshVisibleSession);

    return () => {
      isActive = false;
      window.removeEventListener("pageshow", refreshVisibleSession);
      window.removeEventListener("focus", refreshVisibleSession);
      window.removeEventListener("storage", refreshVisibleSession);
      document.removeEventListener("visibilitychange", refreshVisibleSession);
    };
  }, [loggedOutLabel]);

  return (
    <Link className={className} href={link.href}>
      {link.label}
    </Link>
  );
}

function isAdminUser(user: AuthUser) {
  return Boolean(
    user.permissions?.includes("*") ||
    user.permissions?.some((permission) =>
      [
        "template:",
        "design:",
        "content:",
        "blog:",
        "staff:",
        "category:",
        "subcategory:",
      ].some((prefix) => permission.startsWith(prefix)),
    ),
  );
}
