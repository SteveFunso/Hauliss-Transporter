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

const getAuthToken = (): string | null => {
  return localStorage.getItem("hauliss_access_token");
};

const getRefreshTokenValue = (): string | null => {
  return localStorage.getItem("hauliss_refresh_token");
};

async function refreshAccessToken(): Promise<string | null> {
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
    localStorage.setItem("hauliss_access_token", tokens.access_token);
    if (tokens.refresh_token) localStorage.setItem("hauliss_refresh_token", tokens.refresh_token);
    return tokens.access_token;
  } catch {
    return null;
  }
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

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(method, path, body, false);
    }
    // Clear auth state and redirect to login
    localStorage.removeItem("hauliss_access_token");
    localStorage.removeItem("hauliss_refresh_token");
    localStorage.removeItem("hauliss_user");
    window.dispatchEvent(new Event("auth:logout"));
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Request failed: ${res.status}`);
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
