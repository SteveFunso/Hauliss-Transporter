import { api, type ApiResponse } from "./client";

export type FleetDriver = {
  driver_id: string;
  is_online: boolean;
  vehicle_type: string;
  lat: number;
  lng: number;
  driver_name: string;
  truck_plate_number: string;
  rating: number;
  total_trips: number;
  minutes_away: number;
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

export const getTruckTypes = () =>
  api.get<TruckType[]>("/api/booking/truck-types");

export const createTruck = (data: {
  plate_number: string;
  vehicle_type: string;
  driver_name?: string;
}) => api.post<{ id: string; plate_number: string; message: string }>("/api/admin/fleet/trucks", data);
