const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export type ApiResponse<T> = {
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export type ApiError = {
  message: string;
  errors?: any[];
};

/** Thrown for every non-2xx response so callers can branch on the HTTP status. */
export class HttpError extends Error {
  status: number;
  body: any;

  constructor(status: number, message: string, body?: any) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

const ACCESS_TOKEN_KEY = "hauliss_access_token";
const REFRESH_TOKEN_KEY = "hauliss_refresh_token";
const USER_KEY = "hauliss_user";

const getAuthToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

const getRefreshTokenValue = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/** Wipe every persisted session key (access + refresh tokens and the cached user). */
export function clearStoredSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = getRefreshTokenValue();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return null;

    // The refresh endpoint returns the standard envelope {status_code,message,data:{...}};
    // unwrap data before reading the tokens (reading data.access_token directly yields
    // undefined and force-logs-out the user on every access-token expiry).
    const body = await res.json();
    const tokens = body?.data ?? body;
    if (!tokens?.access_token) return null;
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    if (tokens.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    return tokens.access_token;
  } catch {
    return null;
  }
}

// Single-flight refresh: when several requests hit 401 at the same moment
// (e.g. the dashboard's parallel fetches after the access token expires) they
// all await ONE refresh call instead of racing each other — a race here rotates
// the refresh token multiple times and logs the user out spuriously.
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performTokenRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function forceLogout(): never {
  clearStoredSession();
  window.dispatchEvent(new Event("auth:logout"));
  throw new HttpError(401, "Session expired. Please log in again.");
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
  retry = true
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 401 only — a 403 is an authorisation answer for THIS resource, not a dead
  // session, so it must never log the user out.
  if (res.status === 401) {
    if (retry) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return request<T>(method, path, body, false);
      }
    }
    // No refresh token, the refresh failed, or the retried request was rejected
    // again with the fresh token (QA TP-AUTH-11: corrupted tokens) — the session
    // is unrecoverable, so clear it and bounce to the login screen.
    return forceLogout();
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new HttpError(res.status, error?.message || `Request failed: ${res.status}`, error);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  // A 2xx that is not JSON (an HTML error page from a proxy/CDN, an empty
  // stub) must not be handed to callers as if it were data.
  const contentType = res.headers.get("content-type") || "";
  if (!/json/i.test(contentType)) {
    throw new HttpError(res.status, `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T>(path: string, body?: any) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: any) => request<T>("PATCH", path, body),
  delete: <T>(path: string, body?: any) => request<T>("DELETE", path, body),
};
