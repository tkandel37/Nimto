"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { BrandLogo } from "../../brand-logo";

function ResetPasswordContent() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setToken(hash.get("token") ?? "");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Reset token is missing.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest<{ message: string }>(
        "/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({ token, password }),
        },
      );

      setMessage(response.message);
      window.setTimeout(() => {
        router.replace("/auth?mode=login");
      }, 1200);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to reset password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="preview-panel">
        <div className="invitation-preview">
          <div className="flex h-full flex-col justify-between border border-ink/15 p-8">
            <Link
              href="/"
              className="site-brand-link"
              aria-label="myNimto home"
            >
              <BrandLogo />
            </Link>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
                Secure access
              </p>
              <h1 className="mt-5 text-5xl font-black leading-tight text-ink">
                Choose a new password
              </h1>
              <p className="mt-5 max-w-sm text-lg leading-8 text-ink/70">
                Set a fresh password for your account and then sign back in.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="form-card">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-leaf">
            New password
          </p>
          <h1 className="mt-4 text-4xl font-black text-ink">Reset password</h1>
          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="field">
              <span className="text-sm font-bold text-ink">New password</span>
              <input
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="12+ chars with upper, lower, number & symbol"
                required
                type="password"
                value={password}
              />
            </label>
            <label className="field">
              <span className="text-sm font-bold text-ink">
                Confirm password
              </span>
              <input
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
                required
                type="password"
                value={confirmPassword}
              />
            </label>
            {message ? (
              <p className="rounded-xl border border-leaf/20 bg-leaf/10 p-3 text-sm font-bold text-leaf">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-xl border border-rose/20 bg-rose/10 p-3 text-sm font-bold text-rose">
                {error}
              </p>
            ) : null}
            <button
              className="primary-button"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Update password"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-ink/70">
            Back to{" "}
            <Link
              href="/auth?mode=login"
              className="font-bold text-leaf underline-offset-4 hover:underline"
            >
              login
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center">
          <p className="font-bold text-ink">Loading reset form...</p>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
