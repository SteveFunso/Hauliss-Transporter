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
    lat: string;
    lng: string;
    contact_name: string;
    contact_phone: string;
  } | null;
  dropoff: {
    address: string;
    lat: string;
    lng: string;
    contact_name: string;
    contact_phone: string;
  } | null;
  truck_type_name?: string;
  driver_name?: string;
  carrier_name?: string;
  schedule?: { pickup_date?: string; pickup_time?: string };
  created_at: string;
  updated_at: string;
};

export type BookingStats = {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  paid: number;
  confirmed: number;
  scheduled: number;
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

export const createBooking = (data: {
  pickup_address: string;
  dropoff_address: string;
  cargo_type: string;
  cargo_weight: string;
  truck_type: string;
  contact_name: string;
  contact_phone: string;
}) => api.post<any>("/api/admin/bookings", {
  pickup: { address: data.pickup_address, contact_name: data.contact_name, contact_phone: data.contact_phone },
  dropoff: { address: data.dropoff_address },
  cargo: { category: data.cargo_type, weight: data.cargo_weight },
  truck_type_id: data.truck_type,
});
