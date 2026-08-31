import { api } from "./client";

// BUG-006: data layer for the real Compliance page (the nav item previously
// re-rendered the Reports component).

export type DriverCompliance = {
  driver_id: string;
  full_name: string | null;
  phone_number: string | null;
  total: number;
  verified: number;
  pending: number;
  rejected: number;
  expired: number;
  expiring_30d: number;
  compliant: boolean;
};

export type ComplianceSummary = {
  total_drivers: number;
  fully_compliant: number;
  with_pending: number;
  with_rejected: number;
  with_expiring: number;
  with_expired: number;
};

export const getDriverCompliance = () =>
  api.get<{ summary: ComplianceSummary; drivers: DriverCompliance[] }>(
    "/api/admin/driver-compliance"
  );
