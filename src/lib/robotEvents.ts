/**
 * VEX Events data helpers — all calls are server-side only.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from "./firebase";
import { CURRENT_SEASON_ID, PREVIOUS_SEASON_ID, PROGRAM_ID, fetchAllPages, fetchRobotEventsJson } from "./robotEventsClient";
import { bestSkillsPair } from "./competitionData";

const cachedFetch = <T,>(path: string) => fetchRobotEventsJson<T>(path, { revalidateSeconds: 600, ttlMs: 600_000 });
const seasonCache = (season: number) => season === CURRENT_SEASON_ID
  ? { revalidateSeconds: 120, ttlMs: 120_000 }
  : { revalidateSeconds: 3600, ttlMs: 3_600_000 };

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
    `/teams?number%5B%5D=${encodeURIComponent(teamNumber)}&program%5B%5D=${PROGRAM_ID}`
  );
  if (!data.data || data.data.length === 0) throw new Error("NOT_FOUND");
  const t = data.data.find((item: { number?: string }) => item.number?.toUpperCase() === teamNumber.toUpperCase());
  if (!t) throw new Error("NOT_FOUND");
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
  rank: number | null;
  event: string;
  date: string;
}

export interface SkillsSummary {
  driver: number | null;
  programming: number | null;
  total: number | null;
  worldRank: number | null;
  records: SkillsRecord[];
}

export async function fetchSkills(teamId: number, teamNumber: string, season?: number): Promise<SkillsSummary> {
  const seasonId = season ?? CURRENT_SEASON_ID;
  const runs = (await fetchAllPages<any>(
    `/teams/${teamId}/skills?season%5B%5D=${seasonId}`, seasonCache(seasonId)
  )).filter((s: any) => (s.type === "driver" || s.type === "programming") && Number.isFinite(s.score));
  const records: SkillsRecord[] = runs.map((s: any) => ({
    type: s.type === "driver" ? "driver" : "programming",
    score: s.score,
    rank: s.rank ?? null,
    event: s.event?.name ?? "Unknown Event",
    date: s.event?.start ?? "",
  }));

  const bestPair = bestSkillsPair(runs);

  // Look up world skills ranking from Firestore (populated by daily cron)
  let worldRank: number | null = null;
  if (seasonId === PREVIOUS_SEASON_ID) try {
    const collection = "skills_rankings";
    const [doc, metadata] = await Promise.all([db.collection(collection).doc(teamNumber).get(), db.collection(collection).doc("_meta").get()]);
    if (doc.exists && metadata.data()?.seasonId === seasonId) {
      worldRank = doc.data()?.rank ?? null;
    }
  } catch {
    // Firestore unavailable — fall back to null
  }

  return {
    driver: bestPair.driver,
    programming: bestPair.programming,
    total: bestPair.total,
    worldRank,
    records,
  };
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
  const seasonId = season ?? CURRENT_SEASON_ID;
  const items = await fetchAllPages<any>(
    `/teams/${teamId}/awards?season%5B%5D=${seasonId}`, seasonCache(seasonId)
  );
  return items.map((a: any) => ({
      name: a.title ?? a.name ?? "Award",
      event: a.event?.name ?? "Unknown Event",
      date: a.event?.start ?? "",
      season: a.season?.name ?? "",
      category: categorizeAward(a.title ?? a.name ?? ""),
    }));
}

/* ========== Match Data Types ========== */

export interface MatchTeamScore {
  team_id: number;
  team_number: string;
  score: number;
}

export interface Match {
  id: number;
  event_id: number;
  match_number: number;
  name: string;
  scheduled?: string;
  started?: string;
  completed?: string;
  winner_alliance: "red" | "blue" | null;
  red_teams: MatchTeamScore[];
  blue_teams: MatchTeamScore[];
  red_score: number;
  blue_score: number;
}

export interface TeamMatchRecord {
  team_id: number;
  team_number: string;
  event_id: number;
  match_id: number;
  match_number: number;
  alliance: "red" | "blue";
  score: number;
  won: boolean;
  outcome: "win" | "loss" | "tie" | "unknown";
  round: string;
  date: string;
}

function matchAlliance(match: any, color: "red" | "blue") {
  const alliances = match.alliances ?? [];
  return alliances.some((alliance: any) => alliance.color)
    ? alliances.find((alliance: any) => alliance.color === color)
    : alliances[color === "red" ? 0 : 1];
}

export async function fetchEventMatches(eventId: number, season?: number): Promise<Match[]> {
  try {
    const event: any = await cachedFetch(`/events/${eventId}`);
    const eventSeason = (event.data ?? event).season?.id;
    if (!Number.isInteger(eventSeason)) throw new Error(`Missing season for event ${eventId}`);
    if (eventSeason !== (season ?? CURRENT_SEASON_ID)) return [];
    const items = await fetchEventMatchRows(eventId);
    return items
      .filter((m: any) => m.scored === true && Number.isFinite(matchAlliance(m, "red")?.score) && Number.isFinite(matchAlliance(m, "blue")?.score))
      .map((m: any) => ({
        id: m.id,
        event_id: m.event?.id ?? eventId,
        match_number: m.matchnum,
        name: m.name ?? `Match ${m.id}`,
        scheduled: m.scheduled,
        started: m.started,
        completed: m.started,
        winner_alliance: matchAlliance(m, "red").score > matchAlliance(m, "blue").score ? "red" : matchAlliance(m, "blue").score > matchAlliance(m, "red").score ? "blue" : null,
        red_teams: (matchAlliance(m, "red")?.teams ?? []).map((t: any) => ({
          team_id: t.team?.id ?? 0,
          team_number: t.team?.name ?? "",
          score: matchAlliance(m, "red").score,
        })),
        blue_teams: (matchAlliance(m, "blue")?.teams ?? []).map((t: any) => ({
          team_id: t.team?.id ?? 0,
          team_number: t.team?.name ?? "",
          score: matchAlliance(m, "blue").score,
        })),
        red_score: matchAlliance(m, "red").score,
        blue_score: matchAlliance(m, "blue").score,
      }));
  } catch (err) {
    console.error(`Error fetching matches for event ${eventId}:`, err);
    throw err;
  }
}

export async function fetchTeamMatchHistory(
  teamId: number,
  eventId?: number,
  season?: number
): Promise<TeamMatchRecord[]> {
  const seasonId = season ?? CURRENT_SEASON_ID;
  try {
    const url = eventId
      ? `/teams/${teamId}/matches?event%5B%5D=${eventId}&season%5B%5D=${seasonId}`
      : `/teams/${teamId}/matches?season%5B%5D=${seasonId}`;

    const items = await fetchAllPages<any>(url, seasonCache(seasonId));
    return items
      .filter((m: any) => m.scored === true && Number.isFinite(matchAlliance(m, "red")?.score) && Number.isFinite(matchAlliance(m, "blue")?.score))
      .flatMap((m: any) => {
        const records: TeamMatchRecord[] = [];
        const redTeams = matchAlliance(m, "red")?.teams ?? [];
        const blueTeams = matchAlliance(m, "blue")?.teams ?? [];

        // Check if team is in red alliance
        const redTeam = redTeams.find((t: any) => t.team?.id === teamId);
        if (redTeam) {
          records.push({
            team_id: teamId,
            team_number: redTeam.team?.name ?? "",
            event_id: m.event?.id ?? 0,
            match_id: m.id,
            match_number: m.matchnum,
            alliance: "red",
            score: matchAlliance(m, "red").score,
            won: matchAlliance(m, "red").score > matchAlliance(m, "blue").score,
            outcome: matchAlliance(m, "red").score > matchAlliance(m, "blue").score ? "win" : matchAlliance(m, "red").score < matchAlliance(m, "blue").score ? "loss" : "tie",
            round: String(m.round ?? m.name ?? ""),
            date: m.started ?? m.scheduled ?? "",
          });
        }

        // Check if team is in blue alliance
        const blueTeam = blueTeams.find((t: any) => t.team?.id === teamId);
        if (blueTeam) {
          records.push({
            team_id: teamId,
            team_number: blueTeam.team?.name ?? "",
            event_id: m.event?.id ?? 0,
            match_id: m.id,
            match_number: m.matchnum,
            alliance: "blue",
            score: matchAlliance(m, "blue").score,
            won: matchAlliance(m, "blue").score > matchAlliance(m, "red").score,
            outcome: matchAlliance(m, "blue").score > matchAlliance(m, "red").score ? "win" : matchAlliance(m, "blue").score < matchAlliance(m, "red").score ? "loss" : "tie",
            round: String(m.round ?? m.name ?? ""),
            date: m.started ?? m.scheduled ?? "",
          });
        }

        return records;
      });
  } catch (err) {
    console.error(`Error fetching match history for team ${teamId}:`, err);
    throw err;
  }
}

export interface TeamEventRanking {
  eventId: number;
  event: string;
  division: string;
  rank: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  averageScore: number | null;
  highScore: number | null;
}

export async function fetchTeamRankings(teamId: number, season = CURRENT_SEASON_ID): Promise<TeamEventRanking[]> {
  const rows = await fetchAllPages<any>(`/teams/${teamId}/rankings?season%5B%5D=${season}`, seasonCache(season));
  return rows.map((row: any) => ({
    eventId: row.event?.id ?? 0,
    event: row.event?.name ?? "Event unavailable",
    division: row.division?.name ?? "Division unavailable",
    rank: Number.isFinite(row.rank) ? row.rank : null,
    wins: Number.isFinite(row.wins) ? row.wins : null,
    losses: Number.isFinite(row.losses) ? row.losses : null,
    ties: Number.isFinite(row.ties) ? row.ties : null,
    averageScore: Number.isFinite(row.average_points) ? row.average_points : null,
    highScore: Number.isFinite(row.high_score) ? row.high_score : null,
  }));
}

/* ========== Division Support ========== */

export interface Division {
  id: string;
  name: string;
  code?: string;
}

/** Fetch divisions published on the event detail. */
export async function fetchEventDivisions(eventId: number): Promise<Division[]> {
  try {
    const event: any = await cachedFetch(`/events/${eventId}`);
    const divisions = (event.data ?? event).divisions;
    if (Array.isArray(divisions) && divisions.length) {
      return divisions.map((d: any) => ({ id: String(d.id), name: d.name ?? `Division ${d.id}` }));
    }
    return [];
  } catch (err) {
    console.error(`Error fetching divisions for event ${eventId}:`, err);
    throw err;
  }
}

export async function fetchEventMatchRows(eventId: number, divisionId?: string): Promise<any[]> {
  const event: any = await cachedFetch(`/events/${eventId}`);
  const end = Date.parse((event.data ?? event).end ?? "");
  const cache = Number.isFinite(end) && end < Date.now() - 86_400_000
    ? { revalidateSeconds: 3600, ttlMs: 3_600_000 }
    : { revalidateSeconds: 60, ttlMs: 60_000 };
  const divisions = divisionId ? [{ id: divisionId }] : await fetchEventDivisions(eventId);
  const pages = await Promise.all(divisions.map((division) =>
    fetchAllPages<any>(`/events/${eventId}/divisions/${encodeURIComponent(division.id)}/matches`, cache)
  ));
  return pages.flat();
}
