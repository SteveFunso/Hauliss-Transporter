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

export const getUser = (id: string) =>
  api.get<AdminUser>(`/api/admin/users/${id}`);

export const updateUser = (id: string, data: Partial<AdminUser>) =>
  api.patch<{ message: string }>(`/api/admin/users/${id}`, data);

export const getUserStats = () =>
  api.get<UserStats>("/api/admin/users/stats");

export const createUser = (data: {
  email: string;
  password: string;
  full_name: string;
  phone_number?: string;
  role?: string;
  company_name?: string;
}) => api.post<{ id: string; message: string }>("/api/admin/users", data);
