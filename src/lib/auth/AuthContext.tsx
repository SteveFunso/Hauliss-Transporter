import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { loginAdmin, logout as logoutApi, getMe, type LoginResponse, type MeResponse } from "../api/auth";
import { HttpError, clearStoredSession } from "../api/client";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  profilePhotoUrl: string;
  phoneNumber?: string;
  transporterId?: string | null;
  companyName?: string | null;
  companyId?: string | null;
  status?: string | null;
};

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /**
   * Re-fetch the current user from /api/auth/me and persist it. Returns the
   * refreshed user, or null when the endpoint could not be reached. `fallback`
   * is merged into the cached user in that case (e.g. the values just saved by
   * the profile form) so the UI never shows stale data after a successful save.
   */
  refreshUser: (fallback?: Partial<AuthUser>) => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const ACCESS_TOKEN_KEY = "hauliss_access_token";
const REFRESH_TOKEN_KEY = "hauliss_refresh_token";
const USER_KEY = "hauliss_user";

const persistUser = (user: AuthUser) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const readStoredUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.id ? (parsed as AuthUser) : null;
  } catch {
    return null;
  }
};

/** Merge the server's view of the caller (/api/auth/me) over the cached user. */
function withMe(base: AuthUser | null, me: MeResponse): AuthUser {
  return {
    id: me.user_id || base?.id || "",
    email: me.email || base?.email || "",
    fullName: me.full_name || base?.fullName || "",
    role: me.role || base?.role || "",
    profilePhotoUrl: me.profile_photo_url ?? base?.profilePhotoUrl ?? "",
    phoneNumber: me.phone_number ?? base?.phoneNumber ?? "",
    transporterId: me.transporter_id ?? base?.transporterId ?? null,
    companyName: me.company?.company_name ?? me.company_name ?? base?.companyName ?? null,
    companyId: me.company?.id ?? base?.companyId ?? null,
    status: me.status ?? base?.status ?? null,
  };
}

/**
 * A validation call can fail for two very different reasons: the SESSION was
 * rejected (401 after a failed refresh, 403 suspended, a payload without a
 * user) — or the endpoint itself was unreachable (network down, gateway 5xx,
 * service not deployed). Only the first one should throw the user out.
 */
function isEndpointUnavailable(err: unknown): boolean {
  if (err instanceof HttpError) return err.status === 404 || err.status >= 500;
  return err instanceof TypeError; // fetch() network failure
}

/** A token plus a parseable cached user — the only case worth validating. */
const hasStoredSession = (): boolean =>
  Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)) && readStoredUser() !== null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Only a stored session needs server-side validation before the app renders.
  const [isLoading, setIsLoading] = useState<boolean>(hasStoredSession);
  // Mirrors `user` for callbacks; every state write goes through commitUser.
  const userRef = useRef<AuthUser | null>(null);

  const commitUser = useCallback((next: AuthUser | null) => {
    userRef.current = next;
    setUser(next);
    if (next) persistUser(next);
  }, []);

  // Restore + validate the session on mount (QA TP-AUTH-11). The cached user
  // is NOT trusted until /api/auth/me confirms the token; the login screen is
  // shown while that is in flight (isLoading stays true).
  useEffect(() => {
    let cancelled = false;
    const saved = readStoredUser();

    if (!hasStoredSession() || !saved) {
      // Nothing to validate (isLoading already started false) — just make sure
      // no half-written session lingers.
      clearStoredSession();
      return;
    }

    getMe()
      .then((me) => {
        if (cancelled) return;
        commitUser(withMe(saved, me));
      })
      .catch((err) => {
        if (cancelled) return;
        if (isEndpointUnavailable(err) && localStorage.getItem(ACCESS_TOKEN_KEY)) {
          // Cannot validate right now — keep the cached session; every other
          // request still goes through the 401 → refresh → logout path.
          commitUser(saved);
          return;
        }
        clearStoredSession();
        commitUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [commitUser]);

  // Listen for forced logout from the API client (unrecoverable 401)
  useEffect(() => {
    const handleLogout = () => {
      commitUser(null);
      setIsLoading(false);
    };
    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, [commitUser]);

  const login = useCallback(async (email: string, password: string) => {
    const response: LoginResponse = await loginAdmin(email, password);

    const authUser: AuthUser = {
      id: response.user_id,
      email: response.profile.email,
      fullName: response.profile.full_name,
      role: response.role,
      profilePhotoUrl: response.profile.profile_photo_url,
      phoneNumber: response.profile.phone_number,
    };

    localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
    persistUser(authUser);

    // Enrich with company / transporter details; the login payload is enough
    // to proceed if this fails.
    let enriched = authUser;
    try {
      enriched = withMe(authUser, await getMe());
    } catch {
      // ignore — keep the login payload
    }
    if (!localStorage.getItem(ACCESS_TOKEN_KEY)) {
      // The client force-logged-out during enrichment (token rejected outright).
      throw new Error("Sign-in could not be completed. Please try again.");
    }
    commitUser(enriched);
  }, [commitUser]);

  const logout = useCallback(() => {
    logoutApi();
    commitUser(null);
  }, [commitUser]);

  const refreshUser = useCallback(async (fallback?: Partial<AuthUser>) => {
    const current = userRef.current;
    try {
      const next = withMe(current, await getMe());
      commitUser(next);
      return next;
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        // The client has already cleared storage and dispatched auth:logout.
        return null;
      }
      if (current && fallback) {
        const patched = { ...current, ...fallback };
        commitUser(patched);
        return patched;
      }
      return null;
    }
  }, [commitUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
