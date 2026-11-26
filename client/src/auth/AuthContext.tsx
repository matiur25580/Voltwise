import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type User = { id: string; name: string; email: string };
type Organization = { id: string; name?: string; slug?: string; role?: string };
type AuthResponse = { data: { accessToken: string; user?: User; organization?: Organization } };
type AuthContextValue = {
  accessToken: string | null;
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message ?? "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accept = async (body: AuthResponse) => {
    const token = body.data.accessToken;
    setAccessToken(token);
    const headers = { Authorization: `Bearer ${token}` };
    const [profileResponse, organizationResponse] = await Promise.all([
      fetch("/api/v1/auth/me", { headers }),
      fetch("/api/v1/organizations/current", { headers })
    ]);
    if (profileResponse.ok) {
      const profile = await profileResponse.json() as { data: { user: User; role: string } };
      setUser(profile.data.user);
      setOrganization((current) => ({ ...current, role: profile.data.role }));
    } else if (body.data.user) setUser(body.data.user);
    if (organizationResponse.ok) {
      const result = await organizationResponse.json() as { data: { organization: { id: string; name: string; slug: string } } };
      setOrganization((current) => ({ ...current, ...result.data.organization }));
    } else if (body.data.organization) setOrganization(body.data.organization);
  };

  const refresh = useCallback(async () => {
    const response = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
    if (!response.ok) throw new Error(await readError(response));
    const body = await response.json() as AuthResponse;
    await accept(body);
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().catch(() => {
      if (active) {
        setAccessToken(null);
        setUser(null);
        setOrganization(null);
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const authenticate = async (path: string, payload: unknown) => {
    setError(null);
    const response = await fetch(path, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" }, body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(await readError(response));
    await accept(await response.json() as AuthResponse);
  };

  const login = async (email: string, password: string) => {
    try { await authenticate("/api/v1/auth/login", { email, password }); }
    catch (cause) { const message = cause instanceof Error ? cause.message : "Unable to sign in."; setError(message); throw cause; }
  };

  const register = async (input: { name: string; email: string; password: string; organizationName: string }) => {
    try { await authenticate("/api/v1/auth/register", input); }
    catch (cause) { const message = cause instanceof Error ? cause.message : "Unable to create account."; setError(message); throw cause; }
  };

  const logout = async () => {
    try { await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" }); }
    finally { setAccessToken(null); setUser(null); setOrganization(null); setError(null); }
  };

  const apiFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(path, { ...init, headers, credentials: "include" });
  }, [accessToken]);

  const value = useMemo(() => ({
    accessToken, user, organization, loading, error, login, register, logout,
    apiFetch, clearError: () => setError(null)
  }), [accessToken, user, organization, loading, error, apiFetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
