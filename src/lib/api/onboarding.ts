// Public KYC + signup API used by the transporter portal Sign-up flow.
// No auth required — these are pre-account endpoints.

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "";

async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
  return json as T;
}

async function publicPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
  return json as T;
}

export type KycDocType =
  | "document"
  | "number"
  | "date"
  | "certificate"
  | "photo";

export type KycRequirement = {
  id: string;
  user_type: string;
  category: string;
  name: string;
  description: string | null;
  doc_type: KycDocType;
  is_mandatory: boolean;
  regulator: string | null;
  sort_order: number;
  is_active: boolean;
  meta: Record<string, unknown>;
};

export const fetchTransporterKycRequirements = () =>
  publicGet<{ data: KycRequirement[] }>(
    "/api/kyc-requirements?user_type=transporter_company"
  ).then((r) => r.data || []);

export type KycSubmission = {
  requirement_id: string;
  name: string;
  value: string; // file URL, identifier number, or ISO date
};

export type SignupPayload = {
  email: string;
  contact_phone?: string;
  contact_person_name?: string;
  company_name: string;
  trading_name?: string;
  registration_number?: string;
  tax_id?: string;
  address?: string;
  city?: string;
  state?: string;
  kyc_submissions: KycSubmission[];
};

export type SignupResult = {
  application_id: string;
  status: string;
  message: string;
};

export const submitTransporterSignup = (payload: SignupPayload) =>
  publicPost<SignupResult>("/api/transporter/signup", payload);

// Document upload for the KYC signup flow. This calls the dedicated
// public /api/upload/kyc endpoint on the documents service — *unlike* the
// authenticated /api/upload/document endpoint, it does NOT require a
// Bearer token (applicants don't have one yet — that's why they're applying).
// Returns the public URL of the uploaded placeholder.
export async function uploadKycFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("file_type", "kyc");
  const res = await fetch(`${API_BASE_URL}/api/upload/kyc`, {
    method: "POST",
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Upload failed (${res.status})`);
  // Backend returns { url, file_url, file_type } — accept either shape.
  return json?.url || json?.file_url || json?.data?.url || "";
}
