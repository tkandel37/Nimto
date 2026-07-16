const DEVELOPMENT_SECRET_MARKERS = [
  "replace-with",
  "change-me",
  "changeme",
  "local-development",
  "example",
];

function value(config: Record<string, unknown>, key: string) {
  const candidate = config[key];
  return typeof candidate === "string" ? candidate.trim() : "";
}

function validHttpOrigin(candidate: string, allowHttp: boolean) {
  try {
    const url = new URL(candidate);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (
      !url.username &&
      !url.password &&
      !url.pathname.replace(/\/$/, "") &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" ||
        ((allowHttp || loopback) && url.protocol === "http:"))
    );
  } catch {
    return false;
  }
}

function validOAuthCallback(candidate: string, allowHttp: boolean) {
  try {
    const url = new URL(candidate);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" ||
        ((allowHttp || loopback) && url.protocol === "http:"))
    );
  } catch {
    return false;
  }
}

export function validateEnvironment(config: Record<string, unknown>) {
  const production = value(config, "NODE_ENV") === "production";
  const jwtSecret = value(config, "JWT_SECRET");
  const frontendOrigins = value(config, "FRONTEND_URL")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required.");
  }

  if (
    production &&
    (jwtSecret.length < 32 ||
      DEVELOPMENT_SECRET_MARKERS.some((marker) =>
        jwtSecret.toLowerCase().includes(marker),
      ))
  ) {
    throw new Error(
      "JWT_SECRET must be a unique random production secret of at least 32 characters.",
    );
  }

  if (!frontendOrigins.length) {
    throw new Error("FRONTEND_URL must contain at least one allowed origin.");
  }

  if (frontendOrigins.some((origin) => !validHttpOrigin(origin, !production))) {
    throw new Error(
      "FRONTEND_URL must contain only exact HTTPS origins (HTTP is allowed only in development or on loopback).",
    );
  }

  const googleValues = [
    value(config, "GOOGLE_CLIENT_ID"),
    value(config, "GOOGLE_CLIENT_SECRET"),
    value(config, "GOOGLE_CALLBACK_URL"),
  ];
  const configuredGoogleValues = googleValues.filter(Boolean).length;
  if (
    configuredGoogleValues > 0 &&
    configuredGoogleValues < googleValues.length
  ) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL must be configured together.",
    );
  }

  if (googleValues[2] && !validOAuthCallback(googleValues[2], !production)) {
    throw new Error(
      "GOOGLE_CALLBACK_URL must be a valid HTTPS callback without credentials, query, or fragment.",
    );
  }

  const sameSite = value(config, "AUTH_COOKIE_SAME_SITE").toLowerCase();
  if (sameSite && !["lax", "none"].includes(sameSite)) {
    throw new Error("AUTH_COOKIE_SAME_SITE must be either lax or none.");
  }

  return config;
}
