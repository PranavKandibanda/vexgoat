/**
 * RobotEvents API client — all calls are server-side only.
 */

const BASE_URL = "https://www.robotevents.com/api/v2";

function headers() {
  const key = process.env.ROBOT_EVENTS_API_KEY;
  if (!key) throw new Error("ROBOT_EVENTS_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
}

/* ---------- simple in-memory cache ---------- */
const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function cachedFetch<T>(url: string): Promise<T> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.ts < CACHE_TTL) return hit.data as T;

  const res = await fetch(url, { headers: headers(), next: { revalidate: 600 } });
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (res.status === 429) throw new Error("RATE_LIMITED");
  if (!res.ok) throw new Error(`API error ${res.status}`);

  const json = await res.json();
  cache.set(url, { ts: now, data: json });
  return json as T;
}

/* ---------- paginate helper ---------- */
async function paginateAll<T>(url: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const separator = url.includes("?") ? "&" : "?";
    const data: any = await cachedFetch(`${url}${separator}page=${page}&per_page=100`);
    if (data.data && Array.isArray(data.data)) {
      items.push(...data.data);
      hasMore = data.meta?.current_page < data.meta?.last_page;
    } else {
      hasMore = false;
    }
    page++;
    if (page > 20) break; // safety valve
  }
  return items;
}

/* ========== Public API Functions ========== */

export interface TeamInfo {
  id: number;
  number: string;
  team_name: string;
  organization: string;
  location: {
    city: string;
    region: string;
    country: string;
  };
  grade: string;
  program: { code: string };
}

export async function fetchTeam(teamNumber: string): Promise<TeamInfo> {
  const data: any = await cachedFetch(
    `${BASE_URL}/teams?number%5B%5D=${encodeURIComponent(teamNumber)}&program%5B%5D=1`
  );
  if (!data.data || data.data.length === 0) throw new Error("NOT_FOUND");
  const t = data.data[0];
  return {
    id: t.id,
    number: t.number,
    team_name: t.team_name,
    organization: t.organization,
    location: {
      city: t.location?.city ?? "",
      region: t.location?.region ?? "",
      country: t.location?.country ?? "",
    },
    grade: t.grade ?? "Unknown",
    program: { code: t.program?.code ?? "VRC" },
  };
}

export interface SkillsRecord {
  type: "driver" | "programming";
  score: number;
  rank: number;
  event: string;
  date: string;
}

export interface SkillsSummary {
  driver: number;
  programming: number;
  total: number;
  worldRank: number | null;
  records: SkillsRecord[];
}

export async function fetchSkills(teamId: number, season?: number): Promise<SkillsSummary> {
  // Use the current season (197 = Push Back / 2025-2026)
  const seasonId = season ?? 197;
  const data: any = await cachedFetch(
    `${BASE_URL}/teams/${teamId}/skills?season%5B%5D=${seasonId}`
  );

  const records: SkillsRecord[] = (data.data ?? []).map((s: any) => ({
    type: s.type === "driver" ? "driver" : "programming",
    score: s.score,
    rank: s.rank ?? 0,
    event: s.event?.name ?? "Unknown Event",
    date: s.event?.start ?? "",
  }));

  let bestDriver = 0;
  let bestProgramming = 0;

  for (const r of records) {
    if (r.type === "driver" && r.score > bestDriver) {
      bestDriver = r.score;
    }
    if (r.type === "programming" && r.score > bestProgramming) {
      bestProgramming = r.score;
    }
  }

  // Fetch actual world skills ranking from the rankings endpoint
  const worldRank = await fetchWorldSkillsRank(teamId, seasonId);

  return {
    driver: bestDriver,
    programming: bestProgramming,
    total: bestDriver + bestProgramming,
    worldRank,
    records,
  };
}

/**
 * Fetch the team's world skills ranking from the /skills/rankings endpoint.
 * This returns the actual global ranking, not the per-event rank.
 */
async function fetchWorldSkillsRank(teamId: number, seasonId: number): Promise<number | null> {
  try {
    // The rankings endpoint returns teams sorted by combined skills score.
    // We paginate through to find the team's position.
    // First try a direct lookup — many API versions support team[] filter on rankings.
    const data: any = await cachedFetch(
      `${BASE_URL}/skills/rankings?season%5B%5D=${seasonId}&team%5B%5D=${teamId}`
    );
    if (data.data && data.data.length > 0) {
      return data.data[0].rank ?? null;
    }
  } catch {
    // Rankings endpoint may not support team filter — fall back gracefully
  }

  // Fallback: search through paginated world rankings for this team
  try {
    let page = 1;
    while (page <= 50) {
      const data: any = await cachedFetch(
        `${BASE_URL}/skills/rankings?season%5B%5D=${seasonId}&page=${page}&per_page=50`
      );
      if (!data.data || data.data.length === 0) break;
      for (const entry of data.data) {
        if (entry.team?.id === teamId) {
          return entry.rank ?? null;
        }
      }
      if (data.meta?.current_page >= data.meta?.last_page) break;
      page++;
    }
  } catch {
    // If rankings not available, return null
  }

  return null;
}

export interface Award {
  name: string;
  event: string;
  date: string;
  season: string;
  category: "Excellence" | "Tournament Champion" | "Skills Champion" | "Design/Judged" | "Other";
}

function categorizeAward(name: string): Award["category"] {
  const n = name.toLowerCase();
  if (n.includes("excellence")) return "Excellence";
  if (n.includes("tournament champion") || n.includes("tournament winner")) return "Tournament Champion";
  if (n.includes("skills champion") || n.includes("robot skills")) return "Skills Champion";
  if (
    n.includes("design") ||
    n.includes("judges") ||
    n.includes("judge") ||
    n.includes("think") ||
    n.includes("innovate") ||
    n.includes("build") ||
    n.includes("create") ||
    n.includes("amaze")
  )
    return "Design/Judged";
  return "Other";
}

export async function fetchAwards(teamId: number, season?: number): Promise<Award[]> {
  const seasonId = season ?? 197;
  const items = await paginateAll<any>(
    `${BASE_URL}/teams/${teamId}/awards?season%5B%5D=${seasonId}`
  );
  return items
    .filter((a: any) => {
      // Extra safety: only include awards from July 2025 onward (Push Back season start)
      const date = a.event?.start ?? "";
      if (date) {
        return new Date(date) >= new Date("2025-07-01");
      }
      return true; // keep if no date available
    })
    .map((a: any) => ({
      name: a.title ?? a.name ?? "Award",
      event: a.event?.name ?? "Unknown Event",
      date: a.event?.start ?? "",
      season: a.season?.name ?? "",
      category: categorizeAward(a.title ?? a.name ?? ""),
    }));
}

export async function fetchTopSkills(season?: number): Promise<number> {
  const seasonId = season ?? 197;
  try {
    const data: any = await cachedFetch(
      `${BASE_URL}/skills?season%5B%5D=${seasonId}&per_page=1&page=1`
    );
    if (data.data && data.data.length > 0) {
      return data.data[0].score ?? 400;
    }
  } catch {
    // fallback
  }
  return 400; // reasonable fallback max
}
