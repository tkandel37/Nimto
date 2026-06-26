"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    token ? "Verifying your email..." : "Enter the 6-digit code we emailed you.",
  );
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    token ? "loading" : "idle",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<{ message?: string }>(`/auth/verify-email?token=${token}`)
      .then((response) => {
        setStatus("success");
        setMessage(response.message || "Email successfully verified.");
        window.setTimeout(() => {
          router.replace("/auth?mode=login");
        }, 1200);
      })
      .catch((caughtError) => {
        setStatus("error");
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Verification failed.",
        );
      });
  }, [router, token]);

  const isTokenMode = Boolean(token);
  const helperCopy = useMemo(() => {
    if (status === "success") {
      return "Your email is verified. Redirecting you to login...";
    }

    if (isTokenMode) {
      return error || message;
    }

    return message;
  }, [error, isTokenMode, message, status]);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setStatus("idle");
    setIsSubmitting(true);

    try {
      const response = await apiRequest<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({
          email,
          code,
        }),
      });

      setStatus("success");
      setMessage(response.message);
      window.setTimeout(() => {
        router.replace("/auth?mode=login");
      }, 1200);
    } catch (caughtError) {
      setStatus("error");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Verification failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setMessage("");
    setStatus("idle");
    setIsResending(true);

    try {
      const response = await apiRequest<{ message: string }>(
        "/auth/verify-email/resend",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );

      setMessage(response.message);
    } catch (caughtError) {
      setStatus("error");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not resend the code.",
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="preview-panel">
        <div className="invitation-preview">
          <div className="flex h-full flex-col justify-between border border-ink/15 p-8">
            <Link
              href="/"
              className="text-sm font-black uppercase tracking-[0.35em] text-rose"
            >
              myNimto
            </Link>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-leaf">
                Email confirmation
              </p>
              <h1 className="mt-5 text-5xl font-black leading-tight text-ink">
                Finish setting up your account
              </h1>
              <p className="mt-5 max-w-sm text-lg leading-8 text-ink/70">
                Enter the one-time code we sent to your inbox to unlock your
                myNimto account.
              </p>
            </div>
            <div className="rounded-3xl border border-ink/10 bg-white/80 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-leaf">
                Quick reminder
              </p>
              <p className="mt-3 text-sm leading-7 text-ink/70">
                Codes expire in 15 minutes and each resend replaces the old one.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="form-card">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-leaf">
            Verify email
          </p>
          <h1 className="mt-4 text-4xl font-black text-ink">Confirm account</h1>
          <p className="mt-4 text-sm leading-7 text-ink/70">{helperCopy}</p>

          {isTokenMode ? (
            <div className="mt-8">
              {status === "loading" ? (
                <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white p-4 text-sm font-bold text-ink/70">
                  <div className="h-5 w-5 rounded-full border-2 border-leaf border-t-transparent animate-spin"></div>
                  Verifying...
                </div>
              ) : null}
              {status === "error" ? (
                <Link
                  href="/auth/verify"
                  className="mt-4 inline-block font-bold text-leaf underline-offset-4 hover:underline"
                >
                  Enter a code instead
                </Link>
              ) : null}
            </div>
          ) : (
            <form className="mt-8 grid gap-5" onSubmit={handleVerify}>
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
              <label className="field">
                <span className="text-sm font-bold text-ink">Verification code</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  name="code"
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  required
                  type="text"
                  value={code}
                />
              </label>
              {status === "success" ? (
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
                {isSubmitting ? "Verifying..." : "Verify email"}
              </button>
            </form>
          )}

          {!isTokenMode ? (
            <div className="mt-5 text-center text-sm text-ink/70">
              Didn&apos;t get it?{" "}
              <button
                className="font-bold text-leaf underline-offset-4 hover:underline"
                disabled={isResending || !email}
                onClick={handleResend}
                type="button"
              >
                {isResending ? "Resending..." : "Send a new code"}
              </button>
            </div>
          ) : null}

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

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center">
          <p className="font-bold text-ink">Loading verification...</p>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
