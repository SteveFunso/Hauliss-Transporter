import { api, type ApiResponse } from "./client";
import { getMe } from "./auth";

export type AdminDriver = {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  transporter_id: string;
  company_name: string;
  vehicle_type: string;
  status: string;
  profile_photo_url: string;
  created_at: string;
};

export type DriverDocument = {
  id: string;
  driver_id: string;
  type: string;
  title: string;
  subtitle: string;
  document_number: string;
  issued_date: string;
  expiry_date: string | null;
  status: string;
  rejection_reason?: string | null;
  image_url: string;
  created_at: string;
  updated_at: string;
};

export type DriverListParams = {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  vehicle_type?: string;
};

export const getDrivers = (params: DriverListParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  if (params.vehicle_type) qs.set("vehicle_type", params.vehicle_type);
  return api.get<ApiResponse<AdminDriver[]>>(`/api/admin/drivers?${qs}`);
};

export const getDriver = (id: string) =>
  api.get<AdminDriver>(`/api/admin/users/${id}`);

export const updateDriverStatus = (id: string, status: string) =>
  api.patch<{ message: string }>(`/api/admin/users/${id}`, { status });

export const updateDriver = (id: string, data: Partial<AdminDriver>) =>
  api.patch<{ message: string }>(`/api/admin/users/${id}`, data);

export const getDriverDocuments = (driverId: string) =>
  api.get<{ documents: DriverDocument[] }>(`/api/driver/documents?driver_id=${driverId}`);

// BUG-001/002: this portal previously had NO document-review call at all —
// "Verify Documents" was a display-only stub. Same endpoint the super-admin
// portal uses; `reason` is required by the backend when rejecting.
export const reviewDriverDocument = (documentId: string, status: 'verified' | 'rejected', reason?: string) =>
  api.patch<DriverDocument>(`/api/driver/documents/${documentId}`, reason ? { status, reason } : { status });

// QA 2026-09 (KPI consistency): the Drivers page previously showed USER stats
// ("active users") in the driver cards. This is the driver-scoped summary.
export type DriverStats = { total: number; active: number; pending_activation: number; blocked: number };
export const getDriverStats = () => api.get<DriverStats>("/api/admin/drivers/stats");

// Company admins add drivers through pre-registration: the driver row is
// created as "pending activation" and the driver finishes sign-up in the
// driver app (OTP → password → Transporter ID). transporter_id is optional —
// the API defaults it to the admin's own company.
export const preRegisterDriver = (data: {
  email: string;
  full_name: string;
  phone_number: string;
  vehicle_type?: string;
  license_number?: string;
  company_name?: string;
  transporter_id?: string;
}) => api.post<{ driver_id: string; status: string; message: string }>("/api/admin/drivers/pre-register", data);

// ---------------------------------------------------------------------------
// QA TP-DRV-06/07: admins can submit documents on a driver's behalf. Two-step
// flow: upload the file (multipart) → register it against the driver.
// ---------------------------------------------------------------------------
export const DRIVER_DOCUMENT_TYPES = [
  { value: "drivers_license", label: "Driver's License" },
  { value: "vehicle_registration", label: "Vehicle Registration" },
  { value: "insurance", label: "Vehicle Insurance" },
  { value: "roadworthiness", label: "Roadworthiness Certificate" },
  { value: "national_id", label: "National ID" },
  { value: "proof_of_address", label: "Proof of Address" },
  { value: "hackney_permit", label: "Hackney Permit" },
  { value: "other", label: "Other document" },
] as const;
export type DriverDocumentType = (typeof DRIVER_DOCUMENT_TYPES)[number]["value"];

/** File types the documents service accepts (JPEG, PNG, WebP, HEIC, GIF, PDF). */
export const DRIVER_DOCUMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.gif,.pdf";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Step 1: POST /api/upload/document (multipart/form-data, field `file`,
 * optional `file_type`) → { file_url, url, file_type }.
 *
 * The shared JSON client cannot send multipart bodies, so this uses fetch
 * directly. On a 401 it asks the shared client (via getMe) to refresh the
 * access token — or force the normal logout — and retries once.
 */
export async function uploadDriverDocumentFile(
  file: File,
  fileType?: string
): Promise<{ file_url: string; file_type?: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (fileType) form.append("file_type", fileType);
  const qs = fileType ? `?file_type=${encodeURIComponent(fileType)}` : "";

  const send = () => {
    const token = localStorage.getItem("hauliss_access_token");
    return fetch(`${API_BASE_URL}/api/upload/document${qs}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  };

  let res = await send();
  if (res.status === 401) {
    await getMe();
    res = await send();
  }

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Upload failed: ${res.status}`);

  const url = json?.file_url || json?.url || json?.data?.file_url || json?.data?.url;
  if (!url) throw new Error("Upload succeeded but no file URL was returned");
  return { file_url: String(url), file_type: json?.file_type ?? json?.data?.file_type };
}

/** Step 2: POST /api/driver/documents — registers the uploaded file for review. */
export const submitDriverDocument = (data: {
  driver_id: string;
  type: DriverDocumentType | string;
  image_url: string;
  /** YYYY-MM-DD */
  expiry_date?: string;
  document_number?: string;
}) => api.post<DriverDocument & { message?: string }>("/api/driver/documents", data);
