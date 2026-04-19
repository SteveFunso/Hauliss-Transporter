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

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Login failed" }));
    throw new Error(error.message || "Invalid credentials");
  }

  return res.json();
}

export function logout() {
  localStorage.removeItem("hauliss_access_token");
  localStorage.removeItem("hauliss_refresh_token");
  localStorage.removeItem("hauliss_user");
}
