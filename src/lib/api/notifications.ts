import { api, type ApiResponse } from "./client";

export type AdminNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  timestamp_ms: number;
};

export const getNotifications = (params: { page?: number; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return api.get<ApiResponse<AdminNotification[]>>(`/api/admin/notifications?${qs}`);
};

export const createNotification = (data: { user_id: string; title: string; body: string; type?: string }) =>
  api.post<{ id: string; message: string }>("/api/admin/notifications", data);

export const getUnreadCount = () =>
  api.get<{ unread_count: number }>("/api/notifications/unread-count");
