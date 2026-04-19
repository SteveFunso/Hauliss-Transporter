import { api, type ApiResponse } from "./client";

export type AdminBooking = {
  id: string;
  user_id: string;
  status: string;
  truck_type_id: string;
  company_id: string;
  quote_id: string;
  payment_id: string;
  cargo: {
    category: string;
    weight: string;
    size: string;
    description: string;
  };
  pickup: {
    address: string;
    lat: number;
    lng: number;
    contact_name: string;
    contact_phone: string;
  } | null;
  dropoff: {
    address: string;
    lat: number;
    lng: number;
    contact_name: string;
    contact_phone: string;
  } | null;
  created_at: string;
  updated_at: string;
};

export type BookingStats = {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
};

export type BookingListParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

export const getBookings = (params: BookingListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  return api.get<ApiResponse<AdminBooking[]>>(`/api/admin/bookings?${qs}`);
};

export const getBooking = (id: string) =>
  api.get<AdminBooking>(`/api/admin/bookings/${id}`);

export const updateBookingStatus = (id: string, status: string) =>
  api.patch<{ message: string }>(`/api/admin/bookings/${id}`, { status });

export const getBookingStats = () =>
  api.get<BookingStats>("/api/admin/bookings/stats");
