"use client";

import Link from "next/link";
import { BrandLogo } from "./brand-logo";

type ErrorExperienceProps = {
  code: string;
  eyebrow: string;
  title: string;
  message: string;
  referenceId?: string;
  onRetry?: () => void;
};

export function ErrorExperience({
  code,
  eyebrow,
  title,
  message,
  referenceId,
  onRetry,
}: ErrorExperienceProps) {
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="error-experience-shell">
      <span className="error-experience-orb error-experience-orb-one" />
      <span className="error-experience-orb error-experience-orb-two" />
      <section className="error-experience-card" aria-labelledby="error-title">
        <div className="error-experience-mark" aria-hidden="true">
          <span className="error-experience-ring" />
          <span className="error-experience-logo">
            <BrandLogo compact priority />
          </span>
        </div>

        <p className="error-experience-eyebrow">{eyebrow}</p>
        <p className="error-experience-code">{code}</p>
        <h1 id="error-title">{title}</h1>
        <p className="error-experience-message">{message}</p>

        <div className="error-experience-actions">
          {onRetry ? (
            <button
              className="error-experience-primary"
              onClick={onRetry}
              type="button"
            >
              Try again
            </button>
          ) : null}
          <button
            className="error-experience-secondary"
            onClick={goBack}
            type="button"
          >
            Go back
          </button>
          <Link className="error-experience-link" href="/">
            Return home
          </Link>
        </div>

        {referenceId ? (
          <p className="error-experience-reference">
            Reference <span>{referenceId}</span>
          </p>
        ) : null}
      </section>
    </main>
  );
}
