import { api, type ApiResponse } from "./client";

export type AdminDispute = {
  id: string;
  trip_id: string;
  issue_type: string;
  description: string;
  evidence_url: string;
  status: string;
  submitted_at: number | string;
};

export type DisputeListParams = {
  page?: number;
  limit?: number;
  status?: string;
};

export const getDisputes = (params: DisputeListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status && params.status !== "all") qs.set("status", params.status);
  return api.get<ApiResponse<AdminDispute[]>>(`/api/admin/disputes?${qs}`);
};

export const updateDispute = (id: string, data: { status?: string; response?: string }) =>
  api.patch<{ message: string }>(`/api/admin/disputes/${id}`, data);

export const createDispute = (data: {
  trip_id?: string;
  issue_type: string;
  description: string;
  evidence_url?: string;
}) => api.post<{ dispute_id: string; message: string }>("/api/admin/disputes", data);
