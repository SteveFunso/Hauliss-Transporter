import { api, type ApiResponse } from "./client";

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

export const getPayments = async (params: PaymentListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  const res = await api.get<ApiResponse<AdminPayment[]>>(`/api/admin/payments?${qs}`);
  return {
    ...res,
    data: (res.data ?? []).map((r) => {
      const amount = Number(r.amount_minor_units);
      return {
        ...r,
        amount_minor_units: Number.isFinite(amount) ? amount : 0,
      };
    }),
  };
};

export const getPaymentStats = () =>
  api.get<PaymentStats>("/api/admin/payments/stats");

export const processRefund = (id: string) =>
  api.post<{ message: string }>(`/api/admin/payments/${id}/refund`);
