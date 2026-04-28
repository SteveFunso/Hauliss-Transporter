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

export async function loginAdmin(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role: "admin" }),
  });

  const json: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || "Invalid credentials");
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
