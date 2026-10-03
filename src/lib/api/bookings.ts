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
  driver_id?: string | null;
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
  /** Coordinates from the address picker (sent when the address was chosen from a suggestion). */
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
}) => {
  const coords = (lat?: number, lng?: number) =>
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, latitude: lat, longitude: lng } : {};
  return api.post<any>("/api/admin/bookings", {
    pickup: {
      address: data.pickup_address,
      contact_name: data.contact_name,
      contact_phone: data.contact_phone,
      ...coords(data.pickup_lat, data.pickup_lng),
    },
    dropoff: { address: data.dropoff_address, ...coords(data.dropoff_lat, data.dropoff_lng) },
    cargo: { category: data.cargo_type, weight: data.cargo_weight },
    truck_type_id: data.truck_type,
  });
};

// QA 2026-09: generic PATCH used by the Edit Booking dialog (status / truck_type_id / driver_id).
export const updateBooking = (id: string, data: Record<string, string | null>) =>
  api.patch<{ message: string; id: string }>(`/api/admin/bookings/${id}`, data);

// ---------------------------------------------------------------------------
// Assign-driver picker (QA TP-BKG-04). POST /api/booking/drivers is served by
// the dispatch service: given company_id it returns the company's FULL roster
// (auth) flagged with live availability, sorted online-and-free first.
// ---------------------------------------------------------------------------
export type AssignableDriver = {
  id: string;
  name: string;
  image_url?: string;
  truck_type?: string;
  truck_plate_number?: string;
  rating?: number;
  total_trips?: number;
  minutes_away?: number;
  is_online?: boolean;
  is_available?: boolean;
  on_job?: boolean;
  /** Auth account status: active | pending | inactive | suspended | banned (null when unknown). */
  account_status?: string | null;
};

export type AssignableDriversResult = {
  drivers: AssignableDriver[];
  transporter_id?: string;
  /** Server-side explanation for an empty roster (e.g. company has no Transporter ID yet). */
  message?: string;
};

export const getAssignableDrivers = async (
  bookingId: string,
  companyId?: string | null
): Promise<AssignableDriversResult> => {
  const body: Record<string, string> = { booking_id: bookingId };
  if (companyId) body.company_id = companyId;
  const res: any = await api.post<any>("/api/booking/drivers", body);
  // Flat `{drivers, transporter_id}` from dispatch, or the same wrapped in `data`.
  const payload = res && typeof res === "object" && res.data && typeof res.data === "object" && !Array.isArray(res.data)
    ? res.data
    : res;
  const drivers: AssignableDriver[] = Array.isArray(payload?.drivers)
    ? payload.drivers.filter((d: any) => d && d.id).map((d: any) => ({
        ...d,
        id: String(d.id),
        name: String(d.name || d.full_name || "Driver"),
        rating: d.rating !== undefined && d.rating !== null ? Number(d.rating) : undefined,
      }))
    : [];
  return {
    drivers,
    transporter_id: payload?.transporter_id ? String(payload.transporter_id) : undefined,
    message: typeof payload?.message === "string" && drivers.length === 0 ? payload.message : undefined,
  };
};
