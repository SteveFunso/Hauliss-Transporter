import { api, type ApiResponse } from "./client";

export type CompanyRoute = {
  id: string;
  name: string;
  origin_address: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_address: string;
  dest_lat?: number;
  dest_lng?: number;
  distance_km: number;
  estimated_duration_mins: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CoverageArea = {
  id: string;
  area_name: string;
  zone_type: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  radius_km: number;
  is_active: boolean;
  created_at: string;
};

export type RoutePricing = {
  id: string;
  route_id: string;
  truck_type: string;
  pricing_type: string;
  base_fare_minor: number;
  per_km_rate_minor: number;
  per_stop_rate_minor: number;
  flat_rate_minor: number;
  is_active: boolean;
};

export type RouteListParams = {
  page?: number;
  limit?: number;
  is_active?: string;
};

export type CoverageAreaListParams = {
  page?: number;
  limit?: number;
};

export const getRoutes = (params: RouteListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.is_active) qs.set("is_active", params.is_active);
  return api.get<ApiResponse<CompanyRoute[]>>(`/api/admin/routes?${qs}`);
};

export const createRoute = (data: {
  name: string;
  origin_address: string;
  destination_address: string;
  distance_km: number;
  estimated_duration_mins: number;
}) => api.post<CompanyRoute>("/api/admin/routes", data);

export const updateRoute = (
  id: string,
  data: Partial<{
    name: string;
    origin_address: string;
    destination_address: string;
    distance_km: number;
    estimated_duration_mins: number;
    is_active: boolean;
  }>
) => api.put<CompanyRoute>(`/api/admin/routes/${id}`, data);

export const deleteRoute = (id: string) =>
  api.delete<{ message: string }>(`/api/admin/routes/${id}`);

export const getCoverageAreas = (params: CoverageAreaListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return api.get<ApiResponse<CoverageArea[]>>(`/api/admin/coverage-areas?${qs}`);
};

export const createCoverageArea = (data: {
  area_name: string;
  city: string;
  state: string;
  zone_type: string;
  radius_km: number;
}) => api.post<CoverageArea>("/api/admin/coverage-areas", data);

export const deleteCoverageArea = (id: string) =>
  api.delete<{ message: string }>(`/api/admin/coverage-areas/${id}`);

export const getRoutePricing = (routeId: string) =>
  api.get<ApiResponse<RoutePricing[]>>(`/api/admin/routes/${routeId}/pricing`);

export const upsertRoutePricing = (data: {
  route_id: string;
  truck_type: string;
  pricing_type: string;
  base_fare_minor: number;
  per_km_rate_minor: number;
  per_stop_rate_minor: number;
  flat_rate_minor: number;
}) => api.post<RoutePricing>(`/api/admin/routes/${data.route_id}/pricing`, data);
