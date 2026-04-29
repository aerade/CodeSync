import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { desktop } from "@/lib/desktopBridge";
import { getApiBase } from "@/lib/apiConfig";

export type Provider = "google" | "github" | "email";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  provider: Provider;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (provider: "google" | "github") => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmailCode: (email: string, code: string) => Promise<void>;
  requestEmailCode: (email: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const STORAGE_KEY = "cs_auth_user";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pendingSignIn = useRef(false);

  // Restore persisted session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored) as AuthUser);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // Listen for OAuth deep-link callback sent by Electron main process
  useEffect(() => {
    const unsub = desktop().onOAuthCallback(async ({ token, error: cbError }) => {
      if (!pendingSignIn.current) return;
      pendingSignIn.current = false;

      if (cbError) {
        setError(cbError);
        setLoading(false);
        return;
      }

      if (!token) {
        setError("OAuth завершился без токена");
        setLoading(false);
        return;
      }

      try {
        const base = await getApiBase();
        const res = await fetch(`${base}/api/desktop-auth/exchange?token=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error(`Exchange failed: ${res.status}`);
        const data = await res.json() as { user: AuthUser };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
        setUser(data.user);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка авторизации");
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const signIn = async (provider: "google" | "github") => {
    setLoading(true);
    setError(null);
    pendingSignIn.current = true;

    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/desktop-auth/start?provider=${provider}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      const { url } = await res.json() as { url: string };
      desktop().shell.openExternal(url);
      // Loading remains true until onOAuthCallback fires
    } catch (err) {
      pendingSignIn.current = false;
      setError(err instanceof Error ? err.message : "Не удалось начать авторизацию");
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/desktop-auth/email/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      setUser(data.user!);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const requestEmailCode = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/desktop-auth/email/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код");
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmailCode = async (email: string, code: string) => {
    setLoading(true);
    setError(null);
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/desktop-auth/email/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json() as { user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      setUser(data.user!);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка верификации кода");
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const base = await getApiBase();
      const res = await fetch(`${base}/api/desktop-auth/email/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Server returned ${res.status}`);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      setUser(data.user!);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, error,
      signIn, signInWithEmail, signInWithEmailCode, requestEmailCode, register,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
