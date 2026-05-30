"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { apiRequest, AuthUser } from "@/lib/api";

function OAuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Authentication failed. No token received.");
      return;
    }

    // Save token and fetch user details
    localStorage.setItem("nimto_token", token);

    apiRequest<{ user: AuthUser }>("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        localStorage.setItem("nimto_user", JSON.stringify(response.user));
        router.replace("/dashboard");
      })
      .catch(() => {
        localStorage.removeItem("nimto_token");
        setStatus("error");
        setMessage("Failed to verify your session. Please try again.");
      });
  }, [searchParams, router]);

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl text-center">
      {status === "loading" && (
        <>
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 border-4 border-leaf border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h1 className="text-xl font-black text-ink mb-2">Almost there!</h1>
          <p className="text-ink/60">{message}</p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="flex justify-center mb-6 text-rose">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-ink mb-2">Sign in failed</h1>
          <p className="text-ink/60 mb-6">{message}</p>
          <a href="/auth?mode=login" className="inline-block bg-ink text-white px-6 py-3 rounded-xl font-bold hover:bg-ink/90 transition-colors">
            Back to Login
          </a>
        </>
      )}
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper">
      <Suspense fallback={
        <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl text-center">
          <p className="text-ink/60">Loading...</p>
        </div>
      }>
        <OAuthSuccessContent />
      </Suspense>
    </main>
  );
}
