"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest, AuthResponse } from "@/lib/api";

type Mode = "login" | "register";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center">
          <p className="font-bold text-ink">Loading account form...</p>
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "login" ? "login" : "register";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copy = useMemo(
    () =>
      mode === "register"
        ? {
            title: "Create your account",
            button: "Register",
            helper: "Already have an account?",
            action: "Log in",
          }
        : {
            title: "Welcome back",
            button: "Log in",
            helper: "New to Nimto?",
            action: "Create account",
          },
    [mode],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload =
        mode === "register"
          ? { name, email, password }
          : { email, password };
      const response = await apiRequest<AuthResponse>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      localStorage.setItem("nimto_token", response.token);
      localStorage.setItem("nimto_user", JSON.stringify(response.user));
      router.push("/dashboard");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Authentication failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode() {
    setError("");
    setMode((current) => (current === "register" ? "login" : "register"));
  }

  return (
    <main className="auth-shell">
      <section className="preview-panel">
        <div className="invitation-preview">
          <div className="flex h-full flex-col justify-between border border-ink/15 p-8">
            <Link href="/" className="text-sm font-black uppercase tracking-[0.35em] text-rose">
              Nimto
            </Link>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
                Preview
              </p>
              <h1 className="mt-5 text-5xl font-black leading-tight text-ink">
                Aarav & Ishani
              </h1>
              <p className="mt-5 max-w-sm text-lg leading-8 text-ink/70">
                Join us for a wedding celebration. RSVP, directions, and guest
                details will live here soon.
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-ink/15 pt-5 text-sm font-bold text-ink/70">
              <span>Dec 15, 2026</span>
              <span>Kathmandu</span>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="form-card">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-leaf">
            Account
          </p>
          <h2 className="mt-4 text-4xl font-black text-ink">{copy.title}</h2>
          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <label className="field">
                <span className="text-sm font-bold text-ink">Name</span>
                <input
                  minLength={2}
                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your full name"
                  required
                  type="text"
                  value={name}
                />
              </label>
            ) : null}
            <label className="field">
              <span className="text-sm font-bold text-ink">Email</span>
              <input
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="field">
              <span className="text-sm font-bold text-ink">Password</span>
              <input
                minLength={6}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
                type="password"
                value={password}
              />
            </label>
            {error ? (
              <p className="rounded-xl border border-rose/20 bg-rose/10 p-3 text-sm font-bold text-rose">
                {error}
              </p>
            ) : null}
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Please wait..." : copy.button}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-ink/70">
            {copy.helper}{" "}
            <button
              className="font-bold text-leaf underline-offset-4 hover:underline"
              onClick={switchMode}
              type="button"
            >
              {copy.action}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
