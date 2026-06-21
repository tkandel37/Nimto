import type { AuthUser } from "./api";

export type StoredAuthSession = {
  token: string;
  user: AuthUser;
};

let memorySession: StoredAuthSession | null = null;
let verifiedAt = 0;

export function readAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") return memorySession;

  const token = localStorage.getItem("nimto_token") ?? "";
  const savedUser = localStorage.getItem("nimto_user");
  if (!token || !savedUser) {
    memorySession = null;
    verifiedAt = 0;
    return null;
  }
  if (memorySession?.token === token) return memorySession;

  try {
    memorySession = {
      token,
      user: JSON.parse(savedUser) as AuthUser,
    };
    return memorySession;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function saveAuthSession(token: string, user: AuthUser, verified = true) {
  memorySession = { token, user };
  verifiedAt = verified ? Date.now() : 0;
  if (typeof window === "undefined") return;
  localStorage.setItem("nimto_token", token);
  localStorage.setItem("nimto_user", JSON.stringify(user));
}

export function saveAuthToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("nimto_token", token);
  }
}

export function clearAuthSession() {
  memorySession = null;
  verifiedAt = 0;
  if (typeof window === "undefined") return;
  localStorage.removeItem("nimto_token");
  localStorage.removeItem("nimto_user");
}

export function isSessionFresh(maxAgeMs = 5 * 60_000) {
  return Boolean(memorySession && Date.now() - verifiedAt < maxAgeMs);
}
