import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// QA 2026-09: seeded/placeholder photo hosts (picsum etc.) must not be shown as real avatars.
const PLACEHOLDER_HOSTS = ["picsum.photos", "placehold.co", "placeholder.com", "dummyimage.com", "via.placeholder.com", "placekitten.com"];
export function realPhotoUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  try { const h = new URL(url).hostname; return PLACEHOLDER_HOSTS.some((p) => h.endsWith(p)) ? undefined : url; } catch { return undefined; }
}
