const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export type LoginResponse = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  role: string;
  profile: {
    full_name: string;
    email: string;
    phone_number: string;
    profile_photo_url: string;
    account_type: string;
  };
  message: string;
};

const GENERIC_CREDENTIALS_ERROR = "Invalid email or password";
const UNAVAILABLE_ERROR = "Sign-in is temporarily unavailable. Please try again.";

export async function loginAdmin(
  email: string,
  password: string
): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role: "admin" }),
    });
  } catch {
    // Network failure / DNS / CORS — nothing the user typed caused this.
    throw new Error(UNAVAILABLE_ERROR);
  }

  const json: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    // QA TP-AUTH-04: never reveal whether the email exists — every credential
    // failure (bad password, unknown account, malformed request) reads the same.
    if (res.status === 400 || res.status === 401 || res.status === 404) {
      throw new Error(GENERIC_CREDENTIALS_ERROR);
    }
    // 403 carries a real, user-facing reason: suspended account, wrong portal
    // for this role, etc.
    if (res.status === 403) {
      throw new Error(json?.message || "You are not allowed to sign in to this portal.");
    }
    if (res.status >= 500) {
      throw new Error(UNAVAILABLE_ERROR);
    }
    throw new Error(json?.message || GENERIC_CREDENTIALS_ERROR);
  }

  // Backend wraps mobile-facing responses in the standard envelope:
  //   { status_code, message, data: { user_id, access_token, profile, ... } }
  // Older code paths returned the LoginResponse flat. Accept either so the
  // client survives the rollover (and any future flip-flops).
  const payload = (json && json.data) ? json.data : json;
  if (!payload || !payload.access_token || !payload.profile) {
    throw new Error(json?.message || "Unexpected login response");
  }
  return payload as LoginResponse;
}

export function logout() {
  localStorage.removeItem("hauliss_access_token");
  localStorage.removeItem("hauliss_refresh_token");
  localStorage.removeItem("hauliss_user");
}

// ---------------------------------------------------------------------------
// Current-user + account endpoints (auth service). Both go through the shared
// client so a dead token triggers the normal refresh → forced-logout path.
// ---------------------------------------------------------------------------
import { api } from "./client";

export type MeResponse = {
  user_id: string;
  email: string;
  full_name: string;
  phone_number: string;
  role: string;
  status: string;
  transporter_id: string | null;
  company_name: string | null;
  profile_photo_url: string;
  company: {
    id: string;
    company_name: string;
    status: string;
    verification_status: string;
  } | null;
};

/** GET /api/auth/me — validates the session server-side and returns the caller. */
export async function getMe(): Promise<MeResponse> {
  const res = await api.get<{ data?: MeResponse } | MeResponse>("/api/auth/me");
  const payload = (res as any)?.data ?? res;
  if (!payload || !payload.user_id) throw new Error("Session is no longer valid");
  return payload as MeResponse;
}

/** POST /api/auth/change-password — the server verifies the current password. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  await api.post("/api/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}
