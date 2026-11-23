/**
 * Event Filtering and Event-Specific Insights.
 *
 * Handles fetching events, teams at events, and computing event-scoped rankings.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { TeamRating } from "@/lib/eloRating";
import { CURRENT_SEASON_ID, fetchAllPages } from "@/lib/robotEventsClient";

export interface Event {
  id: number;
  name: string;
  start: string;
  end: string;
  location: string;
  team_count: number;
}

export interface EventTeam {
  team_number: string;
  team_id: number;
  team_name: string;
}

export interface EventRanking {
  rank: number;
  team_number: string;
  elo_rating: number;
  event_wins: number;
  event_matches: number;
  event_win_rate: number;
}

const FIRESTORE_GETALL_BATCH_SIZE = 250;

/**
 * Fetch active/upcoming events for the current season.
 */
export async function fetchActiveEvents(): Promise<Event[]> {
  try {
    const rows = await fetchAllPages<any>(`/seasons/${CURRENT_SEASON_ID}/events`, { revalidateSeconds: 600, ttlMs: 300_000 });
    const events: Event[] = rows
      .filter((e: any) => {
        // Include upcoming and in-progress events
        const start = new Date(e.start);
        const end = new Date(e.end);
        const now = new Date();
        return Number.isFinite(start.getTime()) && (!Number.isFinite(end.getTime()) || now.getTime() <= end.getTime() + 86400000);
      })
      .map((e: any) => ({
        id: e.id,
        name: e.name,
        start: e.start,
        end: e.end,
        location: `${e.location?.city || ""}, ${e.location?.region || ""}`,
        team_count: e.team_count || 0,
      }));

    return events;
  } catch (err) {
    console.error("Error fetching events:", err);
    return [];
  }
}

/**
 * Fetch all teams attending a specific event.
 */
export async function fetchEventTeams(eventId: number, divisionId?: string): Promise<EventTeam[]> {
  try {
    // shortcut: the documented event teams endpoint has no division filter; use event-wide participants until division rosters are available.
    void divisionId;
    const rows = await fetchAllPages<any>(
      `/events/${eventId}/teams`,
      { revalidateSeconds: 600, ttlMs: 120_000 }
    );
    const teams: EventTeam[] = rows.map((t: any) => ({
      team_number: t.number,
      team_id: t.id,
      team_name: t.team_name || "",
    }));

    return teams;
  } catch (err) {
    console.error(`Error fetching teams for event ${eventId}:`, err);
    throw err;
  }
}

/**
 * Fetch ratings for only the requested teams.
 * This avoids full collection scans that can exhaust Firestore quota.
 */
export async function fetchTeamRatingsForTeams(
  db: any,
  teamNumbers: string[]
): Promise<Map<string, TeamRating>> {
  const ratings = new Map<string, TeamRating>();
  const uniqueTeams = Array.from(new Set(teamNumbers)).filter(Boolean);

  if (uniqueTeams.length === 0) {
    return ratings;
  }

  for (let i = 0; i < uniqueTeams.length; i += FIRESTORE_GETALL_BATCH_SIZE) {
    const chunk = uniqueTeams.slice(i, i + FIRESTORE_GETALL_BATCH_SIZE);
    const refs = chunk.map((teamNumber) => db.collection("team_ratings_204").doc(teamNumber));
    const docs = await db.getAll(...refs);

    for (const doc of docs) {
      if (!doc.exists || doc.id === "_meta" || doc.data()?.seasonId !== CURRENT_SEASON_ID) continue;
      ratings.set(doc.id, doc.data() as TeamRating);
    }
  }

  return ratings;
}

/**
 * Calculate event-specific ELO rankings.
 * Recalculates team ratings using only matches from the specified event.
 */
export async function calculateEventELO(
  db: any, // Firestore instance
  eventId: number,
  allTeamRatings: Map<string, TeamRating>
): Promise<Map<string, EventRanking>> {
  const eventRatings = new Map<string, EventRanking>();

  try {
    // Fetch all matches for this event from Firestore
    const matchesSnapshot = await db
      .collection("matches_204")
      .where("event_id", "==", eventId)
      .get();

    // Initialize event ratings from global ratings
    for (const [teamNumber] of allTeamRatings) {
      eventRatings.set(teamNumber, {
        rank: 0,
        team_number: teamNumber,
        elo_rating: 1500, // Start at base for event-only calc
        event_wins: 0,
        event_matches: 0,
        event_win_rate: 0,
      });
    }

    // Process each match
    for (const matchDoc of matchesSnapshot.docs) {
      const match = matchDoc.data();
      const redWon = match.winner_alliance === "red";
      const blueWon = match.winner_alliance === "blue";

      // Update red teams
      for (const redTeam of match.red_teams || []) {
        const teamKey = redTeam.team_number;
        const rating = eventRatings.get(teamKey);
        if (rating) {
          rating.event_matches++;
          if (redWon) {
            rating.event_wins++;
          }
        }
      }

      // Update blue teams
      for (const blueTeam of match.blue_teams || []) {
        const teamKey = blueTeam.team_number;
        const rating = eventRatings.get(teamKey);
        if (rating) {
          rating.event_matches++;
          if (blueWon) {
            rating.event_wins++;
          }
        }
      }
    }

    // Calculate win rates and rank
    const ratings = Array.from(eventRatings.values());
    ratings.forEach((r) => {
      r.event_win_rate = r.event_matches > 0 ? r.event_wins / r.event_matches : 0;
    });

    // Sort by event win rate, then by global ELO
    ratings.sort((a, b) => {
      if (b.event_win_rate !== a.event_win_rate) {
        return b.event_win_rate - a.event_win_rate;
      }
      const globalA = allTeamRatings.get(a.team_number)?.elo_rating || 1500;
      const globalB = allTeamRatings.get(b.team_number)?.elo_rating || 1500;
      return globalB - globalA;
    });

    // Assign ranks
    ratings.forEach((r, i) => {
      r.rank = i + 1;
      eventRatings.set(r.team_number, r);
    });

    return eventRatings;
  } catch (err) {
    console.error("Error calculating event ELO:", err);
    return eventRatings;
  }
}

/**
 * Find best teams at an event by component.
 */
export async function getEventInsights(
  db: any,
  eventId: number,
  eventTeamNumbers: string[],
  allTeamRatings: Map<string, TeamRating>
) {
  // Filter team ratings to only event participants
  const eventRatings = new Map<string, TeamRating>();
  for (const teamNumber of eventTeamNumbers) {
    const rating = allTeamRatings.get(teamNumber);
    if (rating) {
      eventRatings.set(teamNumber, rating);
    }
  }

  // Get event-specific rankings
  const eventELO = await calculateEventELO(db, eventId, eventRatings);

  // Top 10 teams
  const topTeams = Array.from(eventELO.values())
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10);

  // Best autonomous teams
  const bestAuton = Array.from(eventRatings.values())
    .sort((a, b) => b.auton_rating - a.auton_rating)
    .slice(0, 5);

  // Best defensive teams (endgame)
  const bestDefensive = Array.from(eventRatings.values())
    .sort((a, b) => b.endgame_rating - a.endgame_rating)
    .slice(0, 5);

  // Most improved (most wins relative to low starting rating)
  const mostImproved = Array.from(eventELO.values())
    .filter((r) => r.event_matches > 0)
    .sort((a, b) => b.event_win_rate - a.event_win_rate)
    .slice(0, 5);

  return {
    top_10_teams: topTeams,
    best_autonomous_teams: bestAuton,
    best_defensive_teams: bestDefensive,
    most_improved_teams: mostImproved,
    total_teams_at_event: eventRatings.size,
  };
}
