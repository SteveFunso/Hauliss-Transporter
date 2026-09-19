import { api, type ApiResponse } from "./client";

// Live availability rows (one per driver): position, online flag, plate.
export type FleetDriver = {
  driver_id: string;
  is_online: boolean;
  vehicle_type: string;
  lat: number | string;
  lng: number | string;
  driver_name: string;
  truck_plate_number: string;
  rating: number | string;
  total_trips: number;
  minutes_away: number | null;
  updated_at: string;
};

// The trucks REGISTER (QA round 2): the source of truth for Fleet Management.
export type TruckStatus = "active" | "maintenance" | "retired";
export type Truck = {
  id: string;
  plate_number: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  capacity_tons: number | null;
  fuel_type: string | null;
  tank_capacity_litres: number | null;
  fuel_efficiency_km_per_litre: number | null;
  company_id: string | null;
  transporter_id: string | null;
  assigned_driver_id: string | null;
  assigned_driver_name: string | null;
  is_online: boolean;
  status: TruckStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FleetStats = {
  total: number;
  online: number;
  offline: number;
  maintenance?: number;
  retired?: number;
  drivers_total?: number;
  drivers_online?: number;
};

export type TruckType = {
  id: string;
  name: string;
  image_url: string;
  capacity: string;
  base_price: number;
  description: string;
  features: string[];
  min_price: number;
  max_price: number;
  rating: number;
  is_available: boolean;
};

export type FleetListParams = {
  page?: number;
  limit?: number;
  is_online?: string;
};

export type TruckListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: TruckStatus | string;
  unassigned?: boolean;
};

export const getFleetAvailability = (params: FleetListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.is_online) qs.set("is_online", params.is_online);
  return api.get<ApiResponse<FleetDriver[]>>(`/api/admin/fleet/availability?${qs}`);
};

export const getFleetStats = () =>
  api.get<FleetStats>("/api/admin/fleet/stats");

export const getTrucks = (params: TruckListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", String(params.status));
  if (params.unassigned) qs.set("unassigned", "true");
  return api.get<ApiResponse<Truck[]>>(`/api/admin/fleet/trucks?${qs}`);
};

export const getTruckTypes = async (): Promise<TruckType[]> => {
  const res = await api.get<{ data: { data: TruckType[] } }>("/api/booking/truck-types");
  return res?.data?.data ?? [];
};

export type TruckInput = {
  plate_number?: string;
  vehicle_type?: string;
  make?: string | null;
  model?: string | null;
  year?: number | string | null;
  capacity_tons?: number | string | null;
  fuel_type?: string | null;
  tank_capacity_litres?: number | string | null;
  fuel_efficiency_km_per_litre?: number | string | null;
  notes?: string | null;
  driver_id?: string | null;
  driver_name?: string;
  status?: TruckStatus;
};

export const createTruck = (data: TruckInput & { plate_number: string; vehicle_type: string }) =>
  api.post<Truck & { message: string }>("/api/admin/fleet/trucks", data);

// QA 2026-09: Edit used to POST (create) and 409 on the existing plate. Edits PATCH the truck by id.
export const updateTruck = (id: string, data: TruckInput) =>
  api.patch<Truck>(`/api/admin/fleet/trucks/${id}`, data);

export const setTruckStatus = (id: string, status: TruckStatus, notes?: string | null) =>
  api.patch<Truck>(`/api/admin/fleet/trucks/${id}`, notes !== undefined ? { status, notes } : { status });

export const assignTruckDriver = (id: string, driver_id: string | null) =>
  api.post<Truck & { message: string }>(`/api/admin/fleet/trucks/${id}/assign`, { driver_id });

export const deleteTruck = (id: string) =>
  api.delete<{ id: string; message: string }>(`/api/admin/fleet/trucks/${id}`);

export const updateTruckType = (id: string, data: Partial<TruckType>) =>
  api.patch<{ message: string }>(`/api/booking/truck-types/${id}`, data);

export const deleteTruckType = (id: string) =>
  api.delete<{ message: string }>(`/api/booking/truck-types/${id}`);

export const createTruckType = (data: {
  name: string;
  capacity: string;
  base_price: number;
  min_price: number;
  max_price: number;
  is_available?: boolean;
}) => api.post<{ id: string; message: string }>("/api/booking/truck-types", data);
