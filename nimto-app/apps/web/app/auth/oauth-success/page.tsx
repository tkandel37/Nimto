"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { apiRequest, AuthUser } from "@/lib/api";
import {
  clearAuthSession,
  saveAuthSession,
  saveAuthToken,
} from "@/lib/auth-session";

function OAuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Completing sign in...");
  const effectiveStatus = token ? status : "error";
  const effectiveMessage = token
    ? message
    : "Authentication failed. No token received.";

  useEffect(() => {
    if (!token) {
      return;
    }

    // Save token and fetch user details
    saveAuthToken(token);

    apiRequest<{ user: AuthUser }>("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => {
        saveAuthSession(token, response.user);
        router.replace(isAdminUser(response.user) ? "/dashboard" : "/events");
      })
      .catch(() => {
        clearAuthSession();
        setStatus("error");
        setMessage("Failed to verify your session. Please try again.");
      });
  }, [token, router]);

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl text-center">
      {effectiveStatus === "loading" && (
        <>
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 border-4 border-leaf border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h1 className="text-xl font-black text-ink mb-2">Almost there!</h1>
          <p className="text-ink/60">{effectiveMessage}</p>
        </>
      )}

      {effectiveStatus === "error" && (
        <>
          <div className="flex justify-center mb-6 text-rose">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-ink mb-2">Sign in failed</h1>
          <p className="text-ink/60 mb-6">{effectiveMessage}</p>
          <a href="/auth?mode=login" className="inline-block bg-ink text-white px-6 py-3 rounded-xl font-bold hover:bg-ink/90 transition-colors">
            Back to Login
          </a>
        </>
      )}
    </div>
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
