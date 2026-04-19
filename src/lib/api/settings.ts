import { api } from "./client";

export type PlatformSettings = {
  platform_name: string;
  platform_email: string;
  platform_phone: string;
  timezone: string;
  currency: string;
  commission_rate: number;
  payout_frequency: string;
  min_payout: number;
  payout_fee: number;
  surge_multiplier: number;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  security: {
    two_factor: boolean;
    session_timeout: number;
    password_expiry: number;
  };
};

export const getSettings = () =>
  api.get<PlatformSettings>("/api/admin/settings");

export const updateSettings = (data: Partial<PlatformSettings>) =>
  api.put<{ message: string }>("/api/admin/settings", data);
