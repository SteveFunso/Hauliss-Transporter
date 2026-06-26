import { api, type ApiResponse } from "./client";

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

export type FleetStats = {
  total: number;
  online: number;
  offline: number;
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

export const getFleetAvailability = (params: FleetListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.is_online) qs.set("is_online", params.is_online);
  return api.get<ApiResponse<FleetDriver[]>>(`/api/admin/fleet/availability?${qs}`);
};

export const getFleetStats = () =>
  api.get<FleetStats>("/api/admin/fleet/stats");

export const getTruckTypes = async (): Promise<TruckType[]> => {
  const res = await api.get<{ data: { data: TruckType[] } }>("/api/booking/truck-types");
  return res?.data?.data ?? [];
};

export const createTruck = (data: {
  plate_number: string;
  vehicle_type: string;
  driver_name?: string;
  driver_id?: string;
}) => api.post<{ id: string; plate_number: string; message: string }>("/api/admin/fleet/trucks", data);

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
