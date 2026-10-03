import { api, type ApiResponse } from "./client";

export type AdminNotification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  /** Set by the DB-backed service. */
  timestamp_ms?: number;
  /** Set by the in-memory fallback (ISO string). */
  timestamp?: string;
  created_at?: string;
};

export const getNotifications = (params: { page?: number; limit?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return api.get<ApiResponse<AdminNotification[]>>(`/api/admin/notifications?${qs}`);
};

/**
 * Notifications for the header bell. The list endpoint answers either
 * `{ data: [...] }` (notifications service directly) or the standard envelope
 * `{ status_code, message, data: { data: [...], pagination } }` when wrapped
 * by the gateway — accept both and always hand back a plain array.
 */
export async function fetchRecentNotifications(limit = 8): Promise<AdminNotification[]> {
  const res: any = await getNotifications({ limit });
  const inner = res?.data;
  const list = Array.isArray(inner)
    ? inner
    : Array.isArray(inner?.data)
      ? inner.data
      : Array.isArray(res)
        ? res
        : [];
  return list.filter((n: any) => n && typeof n === "object") as AdminNotification[];
}

/** Epoch millis for a notification regardless of which timestamp field the server set. */
export function notificationTime(n: AdminNotification): number | null {
  if (typeof n.timestamp_ms === "number" && Number.isFinite(n.timestamp_ms)) return n.timestamp_ms;
  const iso = n.timestamp || n.created_at;
  if (iso) {
    const t = Date.parse(iso);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

export const createNotification = (data: { user_id: string; title: string; body: string; type?: string }) =>
  api.post<{ id: string; message: string }>("/api/admin/notifications", data);

export const getUnreadCount = () =>
  api.get<{ unread_count: number }>("/api/notifications/unread-count");
