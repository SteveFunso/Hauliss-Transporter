import { api } from "./client";

export type DashboardStats = {
  total_users: number;
  total_drivers: number;
  total_trucks: number;
  active_bookings: number;
  completed_trips: number;
  /** Kobo (minor units) — divide by 100 before display. */
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
  /** Revenue buckets are in kobo (minor units) — see minorToMajor. */
  revenue?: number;
  trips?: number;
  value?: number;
  color?: string;
};

export type ReportData = {
  data: ChartDataPoint[];
};

/**
 * Money from the admin service is in kobo (`total_minor`/`amount_minor`);
 * convert to naira for display. QA TP-WAL-01: the dashboard used to render
 * kobo as naira and disagreed with the Wallet page by 100x.
 */
export const minorToMajor = (minor: number | string | null | undefined): number => {
  const n = Number(minor);
  return Number.isFinite(n) ? n / 100 : 0;
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
