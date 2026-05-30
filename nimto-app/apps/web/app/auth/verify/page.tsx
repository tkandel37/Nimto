"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    apiRequest(`/auth/verify-email?token=${token}`)
      .then((res: any) => {
        setStatus("success");
        setMessage(res.message || "Email successfully verified!");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message || "Verification failed. The token may be invalid or expired.");
      });
  }, [token]);

  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        <h1 className="text-2xl font-black mb-4">Email Verification</h1>
        
        {status === "loading" && (
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-leaf border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">{message}</p>
          </div>
        )}

        {status === "success" && (
          <div>
            <div className="text-green-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600 mb-8">{message}</p>
            <Link href="/auth?mode=login" className="inline-block bg-leaf text-white px-6 py-3 rounded-lg font-bold hover:bg-leaf/90 transition-colors">
              Continue to Login
            </Link>
          </div>
        )}

        {status === "error" && (
          <div>
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-gray-600 mb-8">{message}</p>
            <Link href="/auth?mode=login" className="text-leaf hover:underline font-bold">
              Return to Login
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
