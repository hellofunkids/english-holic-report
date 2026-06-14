const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
export const API_BASE = raw.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
