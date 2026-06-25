import { api } from "./client";

// The server returns most scalar settings wrapped in a {value, description, ...}
// envelope. Reads must unwrap `.value`; writes stay flat (the server accepts
// flat strings/numbers on PUT).
export type SettingValue<T> = { value: T; description?: string; currency?: string };

export type PlatformSettings = {
  platform_name: SettingValue<string>;
  platform_email: SettingValue<string>;
  platform_phone: SettingValue<string>;
  timezone: SettingValue<string>;
  currency: SettingValue<string> & { minor_units_per_major?: number };
  commission_rate: number;
  platform_commission_rate?: SettingValue<number> & { type?: string };
  payout_frequency: string;
  min_payout: SettingValue<number>;
  payout_fee: SettingValue<number>;
  surge_multiplier: number;
  flutterwave_enabled?: boolean;
  integrations?: Record<string, boolean>;
  role_permissions?: Record<string, Record<string, boolean>>;
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

// Writes use a flat shape (the server unwraps/accepts flat scalars on PUT),
// distinct from the {value} envelopes returned on GET.
export type PlatformSettingsUpdate = Partial<{
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
  flutterwave_enabled: boolean;
  integrations: Record<string, boolean>;
  role_permissions: Record<string, Record<string, boolean>>;
  notifications: { email: boolean; push: boolean; sms: boolean };
  security: { two_factor: boolean; session_timeout: number; password_expiry: number };
}>;

export const updateSettings = (data: PlatformSettingsUpdate) =>
  api.put<{ message: string }>("/api/admin/settings", data);
