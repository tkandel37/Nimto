"use client";

import { ErrorExperience } from "./error-experience";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f6f2f6", color: "#2b222e" }}>
        <ErrorExperience
          code="500"
          eyebrow="myNimto is still here"
          title="We hit an unexpected problem"
          message="The page stopped safely. Try opening it again, or return home and continue from there."
          onRetry={reset}
          referenceId={error.digest}
        />
      </body>
    </html>
  );
}
