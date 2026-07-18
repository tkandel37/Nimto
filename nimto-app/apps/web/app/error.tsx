"use client";

import { ErrorExperience } from "./error-experience";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorExperience
      code="500"
      eyebrow="A small interruption"
      title="Something did not load"
      message="We could not finish this request right now. Please try again, or return to a safe page."
      onRetry={reset}
      referenceId={error.digest}
    />
  );
}
