import { api } from "./client";

// QA TP-SET-01 / TP-AUTH-12 / TP-PRC-06: the transporter portal's Settings page
// is company self-service, backed by GET/PATCH /api/admin/company (scoped
// server-side to the caller's company). Platform-wide settings
// (/api/admin/settings) are no longer read or written from this portal.

export type CompanyNotificationSettings = {
  email: boolean;
  push: boolean;
  sms: boolean;
  booking_updates: boolean;
  driver_alerts: boolean;
  payment_notifications: boolean;
};

export type CompanySecuritySettings = {
  two_factor: boolean;
};

export type CompanyBankSettings = {
  bank_name: string;
  account_number: string;
  account_name: string;
};

/** { [role]: { [permission]: boolean } } */
export type RolePermissions = Record<string, Record<string, boolean>>;

export type CompanySettings = {
  notifications?: Partial<CompanyNotificationSettings>;
  security?: Partial<CompanySecuritySettings>;
  bank?: Partial<CompanyBankSettings>;
  role_permissions?: RolePermissions;
};

export type Company = {
  id: string;
  company_name: string;
  trading_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  registration_number: string | null;
  tax_id: string | null;
  logo_url: string | null;
  transporter_id: string | null;
  status: string;
  verification_status: string;
  /** Percent (e.g. 10 = 10%), set by Hauliss. Read-only for company admins. */
  commission_rate: number | null;
  settings: CompanySettings;
};

export type CompanyProfileUpdate = Partial<
  Pick<
    Company,
    | "company_name"
    | "trading_name"
    | "contact_email"
    | "contact_phone"
    | "address"
    | "city"
    | "state"
    | "registration_number"
    | "tax_id"
    | "logo_url"
  >
>;

// PATCH body: any subset of the profile fields plus a partial `settings`
// object. The server deep-merges `settings`, so callers send only what changed.
export type CompanyUpdate = CompanyProfileUpdate & { settings?: CompanySettings };

export const NO_COMPANY_MESSAGE = "No transport company is linked to this account";

/**
 * True when an error thrown by getCompany()/updateCompany() means the signed-in
 * admin has no company (the server answers 404 with NO_COMPANY_MESSAGE). The
 * shared client surfaces only the message, so this matches on it.
 */
export const isNoCompanyError = (message?: string | null): boolean => {
  const m = String(message || "").toLowerCase();
  return m.includes("no transport company") || m.includes("request failed: 404");
};

const normalizeCompany = (c: any): Company => {
  const rate = c?.commission_rate;
  const parsedRate = rate === null || rate === undefined || rate === "" ? NaN : Number(rate);
  return {
    ...c,
    commission_rate: Number.isFinite(parsedRate) ? parsedRate : null,
    settings: c?.settings && typeof c.settings === "object" ? c.settings : {},
  };
};

const looksLikeCompany = (c: any): boolean =>
  !!c && typeof c === "object" && ("company_name" in c || "id" in c);

/** GET /api/admin/company — the caller's company (envelope or flat). */
export const getCompany = async (): Promise<Company> => {
  const res = await api.get<any>("/api/admin/company");
  const c = res?.data ?? res;
  if (!looksLikeCompany(c)) throw new Error("Unexpected company response");
  return normalizeCompany(c);
};

/**
 * PATCH /api/admin/company — returns the updated company. If the server ever
 * answers with a bare message instead of the company, re-read it so callers
 * always get the persisted state.
 */
export const updateCompany = async (patch: CompanyUpdate): Promise<Company> => {
  const res = await api.patch<any>("/api/admin/company", patch);
  const c = res?.data ?? res;
  if (looksLikeCompany(c)) return normalizeCompany(c);
  return getCompany();
};
