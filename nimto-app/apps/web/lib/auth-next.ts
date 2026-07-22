const AUTH_NEXT_KEY = "nimto_auth_next";

export function safeAuthNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "";
  try {
    const parsed = new URL(value, "https://mynimto.local");
    if (parsed.origin !== "https://mynimto.local") return "";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}

export function rememberAuthNext(value: string | null | undefined) {
  const safe = safeAuthNext(value);
  if (typeof window === "undefined") return safe;
  if (safe) sessionStorage.setItem(AUTH_NEXT_KEY, safe);
  else sessionStorage.removeItem(AUTH_NEXT_KEY);
  return safe;
}

export function readAndClearAuthNext() {
  if (typeof window === "undefined") return "";
  const safe = safeAuthNext(sessionStorage.getItem(AUTH_NEXT_KEY));
  sessionStorage.removeItem(AUTH_NEXT_KEY);
  return safe;
}
