import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { AuthResponse, AuthUser } from "@/lib/types";

const TOKEN_KEY = "nimto_mobile_session";

type AuthContextValue = {
  isReady: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const clearSession = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const loadUser = useCallback(async (sessionToken: string) => {
    const response = await apiRequest<{ user: AuthUser }>("/auth/me", {
      token: sessionToken,
    });
    setToken(sessionToken);
    setUser(response.user);
  }, []);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then(async (storedToken) => {
        if (storedToken) await loadUser(storedToken);
      })
      .catch(async (error) => {
        if (error instanceof ApiError && error.status === 401) {
          await clearSession();
        }
      })
      .finally(() => setIsReady(true));
  }, [clearSession, loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<AuthResponse>("/auth/mobile/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    await SecureStore.setItemAsync(TOKEN_KEY, response.token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    setToken(response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await apiRequest("/auth/logout", { method: "POST", token });
      } catch {
        // Always clear local credentials; server sessions expire independently.
      }
    }
    await clearSession();
    router.replace("/(tabs)/designs");
  }, [clearSession, token]);

  const refreshUser = useCallback(async () => {
    if (token) await loadUser(token);
  }, [loadUser, token]);

  const value = useMemo(
    () => ({ isReady, token, user, login, logout, refreshUser }),
    [isReady, token, user, login, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
