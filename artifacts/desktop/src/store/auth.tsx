import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Provider = "google" | "github";

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
  signIn: (provider: Provider) => Promise<void>;
  signOut: () => void;
}

const STORAGE_KEY = "cs_auth_user";

const MOCK_USERS: Record<Provider, AuthUser> = {
  google: {
    id: "google_demo_001",
    name: "Алексей Смирнов",
    email: "alex@gmail.com",
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=AS&backgroundColor=f97316&textColor=ffffff",
    provider: "google",
  },
  github: {
    id: "github_demo_001",
    name: "alex_dev",
    email: "alex@users.noreply.github.com",
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=AD&backgroundColor=18181b&textColor=f97316",
    provider: "github",
  },
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored) as AuthUser);
      }
    } catch {
    }
    setLoading(false);
  }, []);

  const signIn = async (provider: Provider) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    const u = MOCK_USERS[provider];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
    setLoading(false);
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
