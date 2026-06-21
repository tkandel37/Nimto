"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
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
  const isGoogleEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "false";

  useEffect(() => {
    setMode(searchParams.get("mode") === "login" ? "login" : "register");
  }, [searchParams]);

  useEffect(() => {
    const token = localStorage.getItem("nimto_token");
    if (!token) return;

    let isActive = true;
    apiRequest<{ user: AuthResponse["user"] }>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!isActive) return;
        localStorage.setItem("nimto_user", JSON.stringify(response.user));
        router.replace(isAdminUser(response.user) ? "/dashboard" : "/events");
      })
      .catch(() => {
        if (!isActive) return;
        localStorage.removeItem("nimto_token");
        localStorage.removeItem("nimto_user");
      });

    return () => {
      isActive = false;
    };
  }, [router]);

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
      router.replace(isAdminUser(response.user) ? "/dashboard" : "/events");
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
    const nextMode = mode === "register" ? "login" : "register";
    setMode(nextMode);
    router.replace(`/auth?mode=${nextMode}`, { scroll: false });
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
                autoComplete="email"
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
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
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
          
          {isGoogleEnabled ? (
            <>
              <div className="mt-6 flex items-center justify-between">
                <span className="w-1/5 border-b border-ink/10 lg:w-1/4"></span>
                <span className="text-center text-xs font-bold uppercase tracking-widest text-ink/40">
                  or continue with
                </span>
                <span className="w-1/5 border-b border-ink/10 lg:w-1/4"></span>
              </div>

              <div className="mt-6">
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/auth/google`}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-ink/15 bg-white px-5 py-4 font-bold text-ink transition-colors hover:bg-paper"
                >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
                  Google
                </a>
              </div>
            </>
          ) : null}

          <p className="mt-8 text-center text-sm text-ink/70">
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

function isAdminUser(user: AuthResponse["user"]) {
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
