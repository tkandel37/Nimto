"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

import { Suspense } from "react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const effectiveStatus = token ? status : "error";
  const effectiveMessage = token ? message : "Verification token is missing.";

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<{ message?: string }>(`/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus("success");
        setMessage(res.message || "Email successfully verified!");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message || "Verification failed. The token may be invalid or expired.");
      });
  }, [token]);

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
      <h1 className="text-2xl font-black mb-4">Email Verification</h1>
      
      {effectiveStatus === "loading" && (
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-leaf border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">{effectiveMessage}</p>
        </div>
      )}

      {effectiveStatus === "success" && (
        <div>
          <div className="text-green-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-600 mb-8">{effectiveMessage}</p>
          <Link href="/auth?mode=login" className="inline-block bg-leaf text-white px-6 py-3 rounded-lg font-bold hover:bg-leaf/90 transition-colors">
            Continue to Login
          </Link>
        </div>
      )}

      {effectiveStatus === "error" && (
        <div>
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-gray-600 mb-8">{effectiveMessage}</p>
          <Link href="/auth?mode=login" className="text-leaf hover:underline font-bold">
            Return to Login
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 p-4">
      <Suspense fallback={
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
          <p className="text-gray-600">Loading verification...</p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </main>
  );
}
