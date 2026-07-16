"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, AuthUser } from "@/lib/api";
import {
  AUTH_SESSION_MARKER,
  clearAuthSession,
  saveAuthSession,
} from "@/lib/auth-session";

export default function OAuthSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    apiRequest<{ user: AuthUser }>("/auth/me")
      .then((response) => {
        saveAuthSession(AUTH_SESSION_MARKER, response.user);
        router.replace(isAdminUser(response.user) ? "/dashboard" : "/events");
      })
      .catch(() => {
        clearAuthSession();
        setStatus("error");
      });
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-paper">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-xl">
        {status === "loading" ? (
          <>
            <div className="mb-6 flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-leaf border-t-transparent" />
            </div>
            <h1 className="mb-2 text-xl font-black text-ink">Almost there!</h1>
            <p className="text-ink/60">Completing sign in...</p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-black text-ink">Sign in failed</h1>
            <p className="mb-6 text-ink/60">
              We could not verify your session. Please try again.
            </p>
            <a
              href="/auth?mode=login"
              className="inline-block rounded-xl bg-ink px-6 py-3 font-bold text-white transition-colors hover:bg-ink/90"
            >
              Back to Login
            </a>
          </>
        )}
      </div>
    </main>
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
