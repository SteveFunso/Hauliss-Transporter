import { api } from "./client";

// QA TP-PRC-05/06: company admins see a READ-ONLY platform rate card. The
// commission, payout terms, base rates and surge rules are set by Hauliss; a
// transporter configures its own route prices under Service Routes.

export type PlatformBaseRate = {
  truck_type: string;
  base_fare_minor: number;
  per_km_minor: number;
  min_fare_minor: number;
  is_active: boolean;
};

export type PlatformSurgeRule = {
  name: string;
  multiplier: number;
  is_active: boolean;
};

export type PlatformRateCard = {
  /** Percent, e.g. 10 means 10%. */
  commission_rate: number;
  payout_frequency: string;
  /** Minor units (kobo). */
  min_payout_minor: number;
  /** Minor units (kobo). */
  payout_fee_minor: number;
  base_rates: PlatformBaseRate[];
  surge_rules: PlatformSurgeRule[];
};

const num = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const bool = (value: unknown, fallback: boolean): boolean =>
  value === null || value === undefined ? fallback : Boolean(value);

/** GET /api/admin/pricing — numeric fields may arrive as strings; coerce at the boundary. */
export const getPlatformRateCard = async (): Promise<PlatformRateCard> => {
  const res = await api.get<any>("/api/admin/pricing");
  const d = res?.data ?? res ?? {};
  return {
    commission_rate: num(d.commission_rate),
    payout_frequency: String(d.payout_frequency ?? ""),
    min_payout_minor: num(d.min_payout_minor),
    payout_fee_minor: num(d.payout_fee_minor),
    base_rates: Array.isArray(d.base_rates)
      ? d.base_rates.map((r: any): PlatformBaseRate => ({
          truck_type: String(r?.truck_type ?? ""),
          base_fare_minor: num(r?.base_fare_minor),
          per_km_minor: num(r?.per_km_minor),
          min_fare_minor: num(r?.min_fare_minor),
          is_active: bool(r?.is_active, true),
        }))
      : [],
    surge_rules: Array.isArray(d.surge_rules)
      ? d.surge_rules.map((s: any): PlatformSurgeRule => ({
          name: String(s?.name ?? ""),
          multiplier: num(s?.multiplier, 1),
          is_active: bool(s?.is_active, true),
        }))
      : [],
  };
};

// ---------------------------------------------------------------------------
// Transporter pricing (Pricing page): the company's own rate card per vehicle
// type — within the floors/ceilings Hauliss sets per type — and its add-on
// charges. Both are applied by the quote engine to every booking made with
// this company. Amounts are minor units (kobo).
// ---------------------------------------------------------------------------
export type RateField = "base_fare_minor" | "per_km_rate_minor" | "per_minute_rate_minor" | "minimum_fare_minor";
export type RateLimits = Record<RateField, { min: number | null; max: number | null }>;
export type RateValues = Record<RateField, number>;
export type CompanyRate = RateValues & { truck_type: string; is_active: boolean; updated_at?: string | null };
export type PricingVehicleType = {
  id: string;
  name: string;
  slug: string;
  platform: (RateValues & { is_active: boolean }) | null;
  limits: RateLimits | null;
  company: CompanyRate | null;
};
export type CompanyCharge = {
  id: string;
  name: string;
  description: string | null;
  charge_type: "fixed" | "percent";
  amount_minor: number;
  percent: number;
  truck_type: string | null;
  truck_type_name?: string | null;
  is_optional: boolean;
  is_active: boolean;
  disabled_by_platform: boolean;
  sort_order: number;
};
export type CompanyPricing = {
  company_id: string;
  commission_rate_percent: number;
  service_fee_minor: number;
  vat_rate_percent: number;
  vehicle_types: PricingVehicleType[];
  charges: CompanyCharge[];
};
export type FarePreview = {
  transport_fare_minor: number;
  charges_minor: number;
  charge_lines: Array<{ id: string; name: string; amount_minor: number; optional: boolean }>;
  transporter_charge_minor: number;
  service_charge_minor: number;
  commission_fee_minor: number;
  tax_fee_minor: number;
  total_minor: number;
  surge_multiplier: number;
  pricing_source: string;
  distance_km: number;
  duration_minutes: number;
  available_charges: Array<{ id: string; name: string; amount_minor: number }>;
};

const unwrap = <T,>(res: any): T => (res?.data ?? res) as T;

export const getCompanyPricing = () => api.get<any>("/api/booking/company/pricing").then((r) => unwrap<CompanyPricing>(r));

export const saveCompanyRate = (truckTypeId: string, body: RateValues & { is_active?: boolean }) =>
  api.put<any>(`/api/booking/company/pricing/${truckTypeId}`, body).then((r) => unwrap<CompanyRate>(r));

export const resetCompanyRate = (truckTypeId: string) => api.delete<any>(`/api/booking/company/pricing/${truckTypeId}`);

export const previewCompanyQuote = (params: { truck_type_id: string; distance_km: number; duration_minutes?: number; charge_ids?: string[] }) => {
  const qs = new URLSearchParams({ truck_type_id: params.truck_type_id, distance_km: String(params.distance_km) });
  if (params.duration_minutes) qs.set("duration_minutes", String(params.duration_minutes));
  if (params.charge_ids?.length) qs.set("charge_ids", params.charge_ids.join(","));
  return api.get<any>(`/api/booking/company/pricing/preview?${qs}`).then((r) => unwrap<FarePreview>(r));
};

export type ChargeInput = {
  name: string;
  description?: string | null;
  charge_type: "fixed" | "percent";
  amount_minor?: number;
  percent?: number;
  /** Catalogue vehicle type id; null/empty = all vehicle types. */
  truck_type_id?: string | null;
  is_optional: boolean;
  is_active?: boolean;
};
export const createCompanyCharge = (body: ChargeInput) =>
  api.post<any>("/api/booking/company/charges", body).then((r) => unwrap<CompanyCharge>(r));
export const updateCompanyCharge = (id: string, body: Partial<ChargeInput>) =>
  api.patch<any>(`/api/booking/company/charges/${id}`, body).then((r) => unwrap<CompanyCharge>(r));
export const deleteCompanyCharge = (id: string) => api.delete<any>(`/api/booking/company/charges/${id}`);
