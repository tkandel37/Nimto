"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, AuthUser } from "@/lib/api";
import {
  AUTH_SESSION_MARKER,
  clearAuthSession,
  saveAuthSession,
} from "@/lib/auth-session";
import { BrandLogo } from "../../brand-logo";

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
    <main className="oauth-completion-shell">
      <div className="oauth-completion-card">
        {status === "loading" ? (
          <div className="oauth-signin-state" role="status" aria-live="polite">
            <div className="oauth-signin-visual" aria-hidden="true">
              <span className="oauth-signin-orbit" />
              <span className="oauth-signin-spark oauth-signin-spark-one" />
              <span className="oauth-signin-spark oauth-signin-spark-two" />
              <span className="oauth-signin-spark oauth-signin-spark-three" />
              <div className="oauth-signin-logo-card">
                <BrandLogo className="oauth-signin-brand" priority />
              </div>
            </div>
            <p className="oauth-signin-kicker">myNimto login</p>
            <h1>Signing you in</h1>
            <p className="oauth-signin-copy">
              Opening the door to your invitations…
            </p>
            <div className="oauth-signin-progress" aria-hidden="true">
              <span />
            </div>
          </div>
        ) : (
          <div className="oauth-signin-error">
            <BrandLogo className="oauth-error-brand" priority />
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
          </div>
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
