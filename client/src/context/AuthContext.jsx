import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api, setToken as persistToken, getToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());

  const login = useCallback(async (email, password) => {
    const data = await api("/api/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!data?.token) {
      throw new Error("No token returned");
    }
    persistToken(data.token);
    setTokenState(data.token);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/admin/logout", {
        method: "POST",
      });
    } catch {
      // Proceed with local cleanup even if server logout fails.
    } finally {
      persistToken(null);
      setTokenState(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
