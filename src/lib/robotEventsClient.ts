const BASE_URL = (process.env.VEX_EVENTS_API_BASE_URL ?? "https://events.vex.com/api/v2").replace(/\/$/, "");

export const CURRENT_SEASON_ID = 204;
export const PREVIOUS_SEASON_ID = 197;
export const PROGRAM_ID = 1;

export interface ApiPage<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

export class VexApiError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`VEX Events API returned ${status} for ${path}`);
    this.status = status;
  }
}

const responseCache = new Map<string, { expires: number; payload: unknown }>();
const pending = new Map<string, Promise<unknown>>();

function retryDelay(response: Response | undefined, attempt: number): number {
  const value = response?.headers.get("retry-after");
  const seconds = value ? Number(value) : NaN;
  const date = value ? Date.parse(value) : NaN;
  return Math.min(10_000, Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1000
    : Number.isFinite(date) ? Math.max(0, date - Date.now()) : 500 * 2 ** attempt);
}

export async function fetchRobotEventsJson<T>(
  path: string,
  options: { revalidateSeconds?: number; ttlMs?: number; maxRetries?: number } = {}
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Expected an API path");
  const token = process.env.ROBOT_EVENTS_API_KEY ?? process.env.VEX_EVENTS_API_TOKEN;
  if (!token) throw new Error("ROBOT_EVENTS_API_KEY or VEX_EVENTS_API_TOKEN is not set");
  const ttlMs = options.ttlMs ?? 120_000;
  const url = `${BASE_URL}${path}`;
  const cached = responseCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.payload as T;
  const inFlight = pending.get(url);
  if (inFlight) return inFlight as Promise<T>;

  const request = (async () => {
    for (let attempt = 0; attempt <= (options.maxRetries ?? 3); attempt++) {
      let response: Response | undefined;
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
          next: { revalidate: options.revalidateSeconds ?? 300 },
        });
        if (response.ok) {
          const payload = await response.json() as T;
          responseCache.set(url, { expires: Date.now() + ttlMs, payload });
          return payload;
        }
        if (response.status !== 429 && response.status < 500) throw new VexApiError(response.status, path);
        if (attempt === (options.maxRetries ?? 3)) throw new VexApiError(response.status, path);
      } catch (error) {
        if (error instanceof VexApiError || attempt === (options.maxRetries ?? 3)) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
    }
    throw new Error(`VEX Events request failed for ${path}`);
  })();
  pending.set(url, request);
  try { return await request; } finally { pending.delete(url); }
}

export async function fetchAllPages<T>(path: string, options?: { revalidateSeconds?: number; ttlMs?: number }): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await fetchRobotEventsJson<ApiPage<T>>(`${path}${separator}per_page=250&page=${page}`, options);
    if (!Array.isArray(result.data)) throw new Error(`Invalid VEX Events page for ${path}`);
    items.push(...result.data);
    if (!result.meta || typeof result.meta.last_page !== "number" || typeof result.meta.current_page !== "number") {
      if (result.data.length === 0) return items;
      throw new Error(`Missing pagination metadata for ${path}`);
    }
    if (result.meta.current_page >= result.meta.last_page) return items;
  }
}
