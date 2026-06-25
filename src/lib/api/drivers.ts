import { api, type ApiResponse } from "./client";

export type AdminDriver = {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  transporter_id: string;
  company_name: string;
  vehicle_type: string;
  status: string;
  profile_photo_url: string;
  created_at: string;
};

export type DriverDocument = {
  id: string;
  driver_id: string;
  type: string;
  title: string;
  subtitle: string;
  document_number: string;
  issued_date: string;
  expiry_date: string | null;
  status: string;
  image_url: string;
  created_at: string;
  updated_at: string;
};

export type DriverListParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

export const getDrivers = (params: DriverListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  return api.get<ApiResponse<AdminDriver[]>>(`/api/admin/drivers?${qs}`);
};

export const getDriver = (id: string) =>
  api.get<AdminDriver>(`/api/admin/users/${id}`);

export const updateDriverStatus = (id: string, status: string) =>
  api.patch<{ message: string }>(`/api/admin/users/${id}`, { status });

export const updateDriver = (id: string, data: Partial<AdminDriver>) =>
  api.patch<{ message: string }>(`/api/admin/users/${id}`, data);

export const getDriverDocuments = (driverId: string) =>
  api.get<{ documents: DriverDocument[] }>(`/api/driver/documents?driver_id=${driverId}`);
