"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";
import { BrandLogo } from "../../brand-logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await apiRequest<{ message: string }>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );

      setMessage(response.message);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to send reset email.",
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
                Account help
              </p>
              <h1 className="mt-5 text-5xl font-black leading-tight text-ink">
                Reset your password
              </h1>
              <p className="mt-5 max-w-sm text-lg leading-8 text-ink/70">
                Enter your account email and we&apos;ll send you a secure link
                to choose a new password.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="form-card">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-leaf">
            Password reset
          </p>
          <h1 className="mt-4 text-4xl font-black text-ink">
            Send reset link
          </h1>
          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="field">
              <span className="text-sm font-bold text-ink">Email</span>
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
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
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-ink/70">
            Remembered it?{" "}
            <Link
              href="/auth?mode=login"
              className="font-bold text-leaf underline-offset-4 hover:underline"
            >
              Return to login
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
