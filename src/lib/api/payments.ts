import { api, type ApiResponse } from "./client";

// Both endpoints are scoped server-side to the caller's company. All amounts
// are minor units (kobo): divide by 100 for naira.

export type AdminPayment = {
  id: string;
  booking_id: string;
  quote_id: string;
  provider: string;
  amount_minor_units: number | string;
  currency: string;
  status: string;
  tx_ref: string;
  created_at: string;
};

export type PaymentStats = {
  total: number;
  /** Sum of amount_minor_units across paid payments (minor units). */
  total_amount: number;
  pending: number;
  completed: number;
  failed: number;
};

export type PaymentListParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Minor units → major (naira). Tolerates string amounts from NUMERIC columns.
 * (Named distinctly from dashboard.ts's minorToMajor: both modules are
 * star-re-exported from lib/api/index.ts.)
 */
export const paymentMinorToMajor = (minor: number | string | null | undefined): number =>
  toNumber(minor) / 100;

export const getPayments = async (params: PaymentListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  const res = await api.get<ApiResponse<AdminPayment[]>>(`/api/admin/payments?${qs}`);
  return {
    ...res,
    data: (Array.isArray(res?.data) ? res.data : []).map((r) => ({
      ...r,
      amount_minor_units: toNumber(r.amount_minor_units),
    })),
  };
};

export const getPaymentStats = async (): Promise<PaymentStats> => {
  const res = await api.get<PaymentStats | ApiResponse<PaymentStats>>("/api/admin/payments/stats");
  const s: any = (res as any)?.data ?? res ?? {};
  return {
    total: toNumber(s.total),
    total_amount: toNumber(s.total_amount ?? s.total_amount_minor_units),
    pending: toNumber(s.pending),
    completed: toNumber(s.completed),
    failed: toNumber(s.failed),
  };
};

// `manual` records a refund that was returned outside Flutterwave (no gateway call).
export const processRefund = (id: string, options?: { manual: boolean; note?: string }) =>
  api.post<{ message: string; manual?: boolean; flutterwave_refund_id?: string | null }>(
    `/api/admin/payments/${id}/refund`,
    options
  );
