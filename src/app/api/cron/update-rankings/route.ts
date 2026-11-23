import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  fetchEventMatches,
  type Match,
} from "@/lib/robotEvents";
import {
  calculateNewElo,
  type TeamRating,
} from "@/lib/eloRating";
import { CURRENT_SEASON_ID, fetchAllPages } from "@/lib/robotEventsClient";

const SEASON_ID = CURRENT_SEASON_ID;

/**
 * Fetch events that started in the last N days.
 * This keeps the request count small enough for a 60s function.
 */
async function fetchRecentEventIds(daysBack: number): Promise<number[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceStr = since.toISOString();
  const now = Date.now();

  const events = await fetchAllPages<{ id: number; start?: string }>(`/seasons/${SEASON_ID}/events?start=${sinceStr}`, { ttlMs: 60_000 });
  return events.filter((event) => event.start && Date.parse(event.start) >= Date.parse(sinceStr) && Date.parse(event.start) <= now).map((event) => event.id);
}

/** Fetch all skills entries for one event */
async function fetchEventSkills(eventId: number): Promise<any[]> {
  return fetchAllPages<any>(`/events/${eventId}/skills`, { ttlMs: 60_000 });
}

/**
 * Process and store match data for recent events.
 * Computes team-specific ratings from match results.
 */
async function processMatches(eventIds: number[]): Promise<{
  matchesStored: number;
  teamRatingsUpdated: Map<string, TeamRating>;
  failedEvents: number[];
}> {
  const teamRatingsMap = new Map<string, TeamRating>();

  // Load existing ratings as baseline
  const existingRatings = await db.collection("team_ratings_204").get();
  const sameSeason = existingRatings.docs.find((doc) => doc.id === "_meta")?.data()?.seasonId === SEASON_ID;
  for (const doc of existingRatings.docs) {
    if (doc.id === "_meta" || !sameSeason || doc.data().seasonId !== SEASON_ID) continue;
    const data = doc.data() as TeamRating;
    teamRatingsMap.set(doc.id, data);
  }

  console.log(`Loaded ${teamRatingsMap.size} existing team ratings`);

  let totalMatches = 0;
  const failedEvents: number[] = [];

  // Process matches for each event
  for (const eventId of eventIds) {
    try {
      const matches = (await fetchEventMatches(eventId)).filter((match) => match.red_teams.length > 0 && match.blue_teams.length > 0 && match.red_teams.every((team) => team.team_number) && match.blue_teams.every((team) => team.team_number));
      console.log(`Event ${eventId}: fetched ${matches.length} matches`);

      const newMatches: Match[] = [];
      for (let index = 0; index < matches.length; index += 250) {
        const chunk = matches.slice(index, index + 250);
        const existing = await db.getAll(...chunk.map((match) => db.collection("matches_204").doc(`${eventId}_${match.id}`)));
        chunk.forEach((match, offset) => { if (!existing[offset].exists) newMatches.push(match); });
      }

      // Store matches in Firestore
      for (let index = 0; index < newMatches.length; index += 500) {
        const matchBatch = db.batch();
        for (const match of newMatches.slice(index, index + 500)) {
        const matchRef = db
          .collection("matches_204")
          .doc(`${eventId}_${match.id}`);
        matchBatch.set(matchRef, {
          event_id: match.event_id,
          match_id: match.id,
          match_number: match.match_number,
          winner_alliance: match.winner_alliance,
          red_teams: match.red_teams,
          blue_teams: match.blue_teams,
          red_score: match.red_score,
          blue_score: match.blue_score,
          completed: match.completed,
        });
        }
        await matchBatch.commit();
        totalMatches += Math.min(500, newMatches.length - index);
      }

      // Update team ratings based on match results
      for (const match of newMatches) {
        if (!match.winner_alliance) continue;
        const redWon = match.winner_alliance === "red";

        // Process red alliance
        for (const redTeam of match.red_teams) {
          const teamKey = redTeam.team_number;
          const teamRating =
            teamRatingsMap.get(teamKey) ||
            createDefaultRating(teamKey, redTeam.team_id);

          // Update ELO (vs average of blue team)
          const avgBluePower =
            match.blue_teams.reduce((sum, t) => sum + (teamRatingsMap.get(t.team_number)?.elo_rating || 1500), 0) /
            match.blue_teams.length;

          const newElo = calculateNewElo(
            teamRating.elo_rating,
            avgBluePower,
            redWon,
            Math.abs(match.red_score - match.blue_score)
          );

          teamRating.elo_rating = newElo;
          teamRating.matches_played++;
          if (redWon) teamRating.wins++;

          teamRatingsMap.set(teamKey, teamRating);
        }

        // Process blue alliance
        for (const blueTeam of match.blue_teams) {
          const teamKey = blueTeam.team_number;
          const teamRating =
            teamRatingsMap.get(teamKey) ||
            createDefaultRating(teamKey, blueTeam.team_id);

          const avgRedPower =
            match.red_teams.reduce((sum, t) => sum + (teamRatingsMap.get(t.team_number)?.elo_rating || 1500), 0) /
            match.red_teams.length;

          const newElo = calculateNewElo(
            teamRating.elo_rating,
            avgRedPower,
            !redWon,
            Math.abs(match.red_score - match.blue_score)
          );

          teamRating.elo_rating = newElo;
          teamRating.matches_played++;
          if (!redWon) teamRating.wins++;

          teamRatingsMap.set(teamKey, teamRating);
        }
      }
    } catch (err) {
      console.error(`Error processing matches for event ${eventId}:`, err);
      failedEvents.push(eventId);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return {
    matchesStored: totalMatches,
    teamRatingsUpdated: teamRatingsMap,
    failedEvents,
  };
}

/**
 * Create default rating for a new team.
 */
function createDefaultRating(teamNumber: string, teamId: number): TeamRating {
  return {
    team_number: teamNumber,
    team_id: teamId,
    elo_rating: 1500,
    auton_rating: 1500,
    driver_rating: 1500,
    endgame_rating: 1500,
    matches_played: 0,
    wins: 0,
    consistency_index: 50,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Store team ratings to Firestore.
 */
async function storeTeamRatings(
  teamRatings: Map<string, TeamRating>
): Promise<number> {
  const updatedAt = new Date().toISOString();
  let stored = 0;

  const ratings = Array.from(teamRatings.values());
  for (let i = 0; i < ratings.length; i += 500) {
    const batch = db.batch();
    for (const rating of ratings.slice(i, i + 500)) {
      const ref = db.collection("team_ratings_204").doc(rating.team_number);
      batch.set(ref, {
        ...rating,
        seasonId: SEASON_ID,
        updated_at: updatedAt,
      });
      stored++;
    }
    await batch.commit();
  }

  // Store metadata
  await db.collection("team_ratings_204").doc("_meta").set({
    lastUpdated: updatedAt,
    totalTeams: stored,
    seasonId: SEASON_ID,
  });

  return stored;
}

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting incremental rankings and match data update...");

    // 1. Fetch only events from the last 3 days
    const eventIds = await fetchRecentEventIds(3);
    console.log(`Found ${eventIds.length} recent events`);

    if (eventIds.length === 0) {
      return NextResponse.json({ success: true, message: "No recent events to process" });
    }

    // 2. Process matches and compute team ratings
    console.log("Processing matches...");
    const { matchesStored, teamRatingsUpdated, failedEvents } = await processMatches(eventIds);
    console.log(`Stored ${matchesStored} matches, updated ${teamRatingsUpdated.size} team ratings`);

    // 3. Store team ratings to Firestore
    console.log("Storing team ratings...");
    const ratingsStored = await storeTeamRatings(teamRatingsUpdated);
    console.log(`Stored ${ratingsStored} team ratings`);

    // 4. Load existing skills rankings from Firestore
    const existingDocs = await db.collection("skills_rankings_204").get();
    const skillsSameSeason = existingDocs.docs.find((doc) => doc.id === "_meta")?.data()?.seasonId === SEASON_ID;
    const teamBests = new Map<
      string,
      { teamNumber: string; teamId: number; driver: number | null; programming: number | null; eventScores: Record<string, { driver: number | null; programming: number | null }> }
    >();
    for (const doc of existingDocs.docs) {
      if (doc.id === "_meta" || !skillsSameSeason || doc.data().seasonId !== SEASON_ID) continue;
      const d = doc.data();
      teamBests.set(doc.id, {
        teamNumber: d.teamNumber,
        teamId: d.teamId,
        driver: d.driver ?? null,
        programming: d.programming ?? null,
        eventScores: d.eventScores ?? {},
      });
    }
    console.log(`Loaded ${teamBests.size} existing teams from Firestore`);

    // 5. Process recent events and merge new data (skills)
    for (let i = 0; i < eventIds.length; i++) {
      const entries = await fetchEventSkills(eventIds[i]);

      for (const entry of entries) {
        const teamNumber: string = entry.team?.number ?? entry.team?.name ?? "";
        const teamId: number = entry.team?.id ?? 0;
        if (!teamNumber || !teamId) continue;

        const existing = teamBests.get(teamNumber) ?? {
          teamNumber,
          teamId,
          driver: null,
          programming: null,
          eventScores: {},
        };

        if (!Number.isFinite(entry.score)) continue;
        const score: number = entry.score;
        const eventKey = String(eventIds[i]);
        const pair = existing.eventScores[eventKey] ?? { driver: null, programming: null };
        if (entry.type === "driver" && score > (pair.driver ?? -1)) {
          pair.driver = score;
        }
        if (entry.type === "programming" && score > (pair.programming ?? -1)) {
          pair.programming = score;
        }
        existing.eventScores[eventKey] = pair;
        const best = Object.values(existing.eventScores).filter((item) => item.driver !== null && item.programming !== null)
          .sort((a, b) => (b.driver! + b.programming!) - (a.driver! + a.programming!))[0];
        existing.driver = best?.driver ?? null;
        existing.programming = best?.programming ?? null;

        teamBests.set(teamNumber, existing);
      }

      if (i < eventIds.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // 6. Re-rank all teams
    const sorted = [...teamBests.values()]
      .map((t) => ({ ...t, combined: t.driver !== null && t.programming !== null ? t.driver + t.programming : null }))
      .filter((t) => t.combined !== null)
      .sort((a, b) => b.combined! - a.combined!);

    let rank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].combined! < sorted[i - 1].combined!) {
        rank = i + 1;
      }
      (sorted[i] as any).rank = rank;
    }

    console.log(`Ranked ${sorted.length} teams`);

    // 7. Write updated rankings to Firestore
    const updatedAt = new Date().toISOString();
    for (let i = 0; i < sorted.length; i += 500) {
      const batch = db.batch();
      for (const team of sorted.slice(i, i + 500)) {
        const ref = db.collection("skills_rankings_204").doc(team.teamNumber);
        batch.set(ref, {
          rank: (team as any).rank,
          teamNumber: team.teamNumber,
          teamId: team.teamId,
          driver: team.driver,
          programming: team.programming,
          combined: team.combined,
          eventScores: team.eventScores,
          seasonId: SEASON_ID,
          updatedAt,
        });
      }
      await batch.commit();
    }

    await db.collection("skills_rankings_204").doc("_meta").set({
      lastUpdated: updatedAt,
      totalTeams: sorted.length,
      recentEventsProcessed: eventIds.length,
      seasonId: SEASON_ID,
      matchesProcessed: matchesStored,
    });

    console.log("Incremental update complete!");

    return NextResponse.json({
      success: failedEvents.length === 0,
      recentEvents: eventIds.length,
      failedEvents,
      matchesProcessed: matchesStored,
      teamRatingsUpdated: teamRatingsUpdated.size,
      totalSkillsTeams: sorted.length,
      updatedAt,
    }, { status: failedEvents.length ? 207 : 200 });
  } catch (err: any) {
    console.error("Cron update-rankings error:", err);
    return NextResponse.json(
      { error: "Failed to update rankings", details: err.message },
      { status: 500 }
    );
  }
}
