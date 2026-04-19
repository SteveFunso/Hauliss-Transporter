import { api } from "./client";

export type DashboardStats = {
  total_users: number;
  total_drivers: number;
  total_trucks: number;
  active_bookings: number;
  completed_trips: number;
  total_revenue: number;
  avg_rating: number;
  active_drivers: number;
  revenue_change: number;
  bookings_change: number;
  users_change: number;
  drivers_change: number;
};

export type ChartDataPoint = {
  name: string;
  revenue?: number;
  trips?: number;
  value?: number;
  color?: string;
};

export type ReportData = {
  data: ChartDataPoint[];
};

export const getDashboardStats = () =>
  api.get<DashboardStats>("/api/admin/stats");

export const getRevenueChart = (period = "monthly") =>
  api.get<ReportData>(`/api/admin/reports/revenue?period=${period}`);

export const getBookingStatusChart = () =>
  api.get<ReportData>("/api/admin/reports/booking-status");

export const getFleetChart = () =>
  api.get<ReportData>("/api/admin/reports/fleet");

export const getDriverPerformanceChart = () =>
  api.get<ReportData>("/api/admin/reports/drivers");

export const getReport = (type: string, period = "monthly") =>
  api.get<ReportData>(`/api/admin/reports/${type}?period=${period}`);
