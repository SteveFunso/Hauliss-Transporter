import { api, type ApiResponse } from "./client";

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  full_name: string;
  phone_number: string;
  status: string;
  email_verified: boolean;
  company_name: string;
  account_type: string;
  profile_photo_url: string;
  transporter_id?: string;
  vehicle_type?: string;
  created_at: string;
  updated_at?: string;
};

export type UserStats = {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  drivers: number;
  clients: number;
  admins: number;
};

export type UserListParams = {
  page?: number;
  limit?: number;
  status?: string;
  role?: string;
  search?: string;
};

export const getUsers = (params: UserListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.role && params.role !== "all") qs.set("role", params.role);
  if (params.search) qs.set("search", params.search);
  return api.get<ApiResponse<AdminUser[]>>(`/api/admin/users?${qs}`);
};

/**
 * GET /api/admin/users/:id — the full user record. The auth service returns it
 * flat today; tolerate the standard {data} envelope as well.
 */
export const getUser = async (id: string): Promise<AdminUser> => {
  const res = await api.get<ApiResponse<AdminUser> | AdminUser>(`/api/admin/users/${id}`);
  const user = (res as any)?.data ?? res;
  if (!user || typeof user !== "object" || !user.id) throw new Error("User not found");
  return user as AdminUser;
};

export const updateUser = (id: string, data: Partial<AdminUser>) =>
  api.patch<{ message: string }>(`/api/admin/users/${id}`, data);

export const getUserStats = () =>
  api.get<UserStats>("/api/admin/users/stats");

export type CreateUserInput = {
  email: string;
  full_name: string;
  phone_number?: string;
  role?: string;
  /**
   * Optional. When omitted the server generates a temporary password, emails a
   * welcome message and returns the password once in `temporary_password`.
   */
  password?: string;
  company_name?: string;
  transporter_id?: string;
  vehicle_type?: string;
};

export type CreatedUser = {
  id: string;
  email: string;
  role: string;
  /** Only present when the server generated the password (none was supplied). */
  temporary_password?: string;
  message?: string;
};

/** POST /api/admin/users — 409 (with a message) when the email is already registered. */
export const createUser = async (data: CreateUserInput): Promise<CreatedUser> => {
  const res = await api.post<ApiResponse<CreatedUser> | CreatedUser>("/api/admin/users", data);
  return ((res as any)?.data ?? res) as CreatedUser;
};
