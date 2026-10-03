import { api } from "./client";

// Server-side Google Places proxy (booking service, /api/booking/places/*).
// Every query is restricted to Nigeria on the server, so results are the same
// wherever the admin is sitting (QA TP-ROUTE-09). The Google key never reaches
// the browser.
//
// Contract (services/booking/src/index.ts + places.ts):
//   GET /api/booking/places/autocomplete?input=…&session_token=…
//     → { status_code, message, data: { predictions: PlacePrediction[] } }
//   GET /api/booking/places/details?place_id=…&session_token=…
//     → { status_code, message, data: { place_id, address, latitude, longitude, state, area, city } }
// `session_token` is any client-generated UUID reused for one search session
// (typing + one details call) so Google bills the session, not each keystroke.

export type PlacePrediction = {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
};

export type ResolvedPlace = {
  place_id: string | null;
  address: string;
  lat: number;
  lng: number;
  state: string | null;
  area: string | null;
  city: string | null;
};

const unwrap = (res: any): any =>
  res && typeof res === "object" && "data" in res ? res.data : res;

export async function autocompletePlaces(
  input: string,
  sessionToken?: string
): Promise<PlacePrediction[]> {
  const qs = new URLSearchParams({ input });
  if (sessionToken) qs.set("session_token", sessionToken);
  const res = await api.get<any>(`/api/booking/places/autocomplete?${qs}`);
  const payload = unwrap(res);
  const list: any[] = Array.isArray(payload?.predictions)
    ? payload.predictions
    : Array.isArray(payload)
      ? payload
      : [];
  return list
    .filter((p) => p && p.place_id)
    .map((p) => ({
      place_id: String(p.place_id),
      description: String(p.description || ""),
      main_text: String(p.main_text || p.description || ""),
      secondary_text: String(p.secondary_text || ""),
    }));
}

export async function placeDetails(
  placeId: string,
  sessionToken?: string
): Promise<ResolvedPlace> {
  const qs = new URLSearchParams({ place_id: placeId });
  if (sessionToken) qs.set("session_token", sessionToken);
  const res = await api.get<any>(`/api/booking/places/details?${qs}`);
  const p = unwrap(res);
  // The server returns latitude/longitude; accept lat/lng too in case the
  // shape is ever shortened.
  const lat = Number(p?.latitude ?? p?.lat);
  const lng = Number(p?.longitude ?? p?.lng);
  if (!p || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Could not resolve that address");
  }
  return {
    place_id: p.place_id ?? null,
    address: String(p.address || ""),
    lat,
    lng,
    state: p.state ?? null,
    area: p.area ?? null,
    city: p.city ?? null,
  };
}
