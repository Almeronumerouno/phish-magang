"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// ponytail: localStorage auth diganti DB-backed cookie session.
export interface SessionUser {
  username: string;
}

interface RegisterInput {
  username: string;
  password: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function getInitials(username: string): string {
  const prefix = username.split("@")[0] ?? "";
  const parts = prefix.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getEmailPrefix(username: string): string {
  return username.split("@")[0] ?? username;
}

function clearLegacyStorage(): void {
  try {
    localStorage.removeItem("rts_users");
    localStorage.removeItem("rts_session");
    sessionStorage.removeItem("rts_session");
  } catch {
    // abaikan: storage tidak tersedia
  }
}

async function throwIfError(res: Response): Promise<void> {
  if (res.ok) return;
  let message = "Request failed. Please try again.";
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error) message = data.error;
  } catch {
    // pakai pesan default
  }
  throw new Error(message);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    clearLegacyStorage();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            setUser({ username: data.username });
          } else {
            setUser(null);
          }
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    await throwIfError(res);
    const data = await res.json();
    setUser({ username: data.username });
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: input.username,
        password: input.password,
      }),
    });
    await throwIfError(res);
    const data = await res.json();
    setUser({ username: data.username });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
