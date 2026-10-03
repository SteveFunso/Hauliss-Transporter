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
