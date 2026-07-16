import type { AuthUser } from "./api";

export const AUTH_SESSION_MARKER = "cookie";

export type StoredAuthSession = {
  token: string;
  user: AuthUser;
};

let memorySession: StoredAuthSession | null = null;
let verifiedAt = 0;
const SENSITIVE_STORAGE_PREFIXES = [
  "nimto_dashboard_cache:",
  "nimto_event_design_draft_",
  "nimto_design_draft_",
];

function clearSensitiveCachedData(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (
      key &&
      SENSITIVE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      storage.removeItem(key);
    }
  }
}

export function purgeLegacyPersistentAuthData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("nimto_token");
  localStorage.removeItem("nimto_user");
  clearSensitiveCachedData(localStorage);
}

export function readAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") return memorySession;

  // Remove bearer tokens and sensitive caches written by older releases.
  purgeLegacyPersistentAuthData();
  const marker = localStorage.getItem("nimto_session") ?? "";
  const savedUser = sessionStorage.getItem("nimto_user");
  if (marker !== AUTH_SESSION_MARKER || !savedUser) {
    memorySession = null;
    verifiedAt = 0;
    return null;
  }
  if (memorySession) return memorySession;

  try {
    memorySession = {
      token: AUTH_SESSION_MARKER,
      user: JSON.parse(savedUser) as AuthUser,
    };
    return memorySession;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function saveAuthSession(
  _token: string,
  user: AuthUser,
  verified = true,
) {
  memorySession = { token: AUTH_SESSION_MARKER, user };
  verifiedAt = verified ? Date.now() : 0;
  if (typeof window === "undefined") return;
  purgeLegacyPersistentAuthData();
  localStorage.setItem("nimto_session", AUTH_SESSION_MARKER);
  sessionStorage.setItem("nimto_user", JSON.stringify(user));
}

export function clearAuthSession() {
  memorySession = null;
  verifiedAt = 0;
  if (typeof window === "undefined") return;
  localStorage.removeItem("nimto_token");
  localStorage.removeItem("nimto_session");
  localStorage.removeItem("nimto_user");
  sessionStorage.removeItem("nimto_user");
  clearSensitiveCachedData(localStorage);
  clearSensitiveCachedData(sessionStorage);
}

export function isSessionFresh(maxAgeMs = 5 * 60_000) {
  return Boolean(memorySession && Date.now() - verifiedAt < maxAgeMs);
}
