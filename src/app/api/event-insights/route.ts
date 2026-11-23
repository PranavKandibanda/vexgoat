import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { calculateEventELO, getEventInsights, fetchEventTeams, fetchTeamRatingsForTeams } from "@/lib/eventFiltering";
import { predictMatch, type TeamRating } from "@/lib/eloRating";
import { fetchEventMatchRows } from "@/lib/robotEvents";
import { normalizeEventMatch } from "@/lib/competitionData";

async function fetchScheduledMatches(eventId: number): Promise<
  Array<{
    match_id: number;
    match_name: string;
    scheduled_at: string;
    red_teams: string[];
    blue_teams: string[];
  }>
> {
  const items = await fetchEventMatchRows(eventId);

  return items
    .filter((m) => !m.started && m.scored !== true)
    .map((m) => normalizeEventMatch(m))
    .map(({ match_id, match_name, scheduled_at, red_teams, blue_teams }) => ({
      match_id, match_name, scheduled_at: scheduled_at ?? "", red_teams, blue_teams,
    }));
}

export async function GET(req: NextRequest) {
  const eventIdParam = req.nextUrl.searchParams.get("event_id");

  if (!eventIdParam || !/^\d+$/.test(eventIdParam)) {
    return NextResponse.json(
      { error: "Provide a valid event ID: ?event_id=12345" },
      { status: 400 }
    );
  }

  const eventId = parseInt(eventIdParam);

  try {
    // Fetch teams attending this event
    const eventTeams = await fetchEventTeams(eventId);
    if (eventTeams.length === 0) {
      return NextResponse.json(
        { error: `No teams found for event ${eventId}` },
        { status: 404 }
      );
    }

    const eventTeamNumbers = eventTeams.map((t) => t.team_number);
    const allTeamRatings = await fetchTeamRatingsForTeams(db, eventTeamNumbers);

    // Get event insights
    const insights = await getEventInsights(
      db,
      eventId,
      eventTeamNumbers,
      allTeamRatings
    );

    const eventRankingsMap = await calculateEventELO(db, eventId, allTeamRatings);
    const teamStats = eventTeamNumbers
      .map((teamNumber) => {
        const eventRow = eventRankingsMap.get(teamNumber);
        const globalRow = allTeamRatings.get(teamNumber);
        if (!eventRow) return null;
        return {
          rank: eventRow.rank,
          team_number: teamNumber,
          event_matches: eventRow.event_matches,
          event_wins: eventRow.event_wins,
          event_win_rate_pct: ((eventRow.event_win_rate || 0) * 100).toFixed(1),
          elo_rating: globalRow?.elo_rating ?? null,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => a.rank - b.rank);

    const scheduled = await fetchScheduledMatches(eventId);
    const scheduledMatches = scheduled.map((match) => {
      const redRatings = match.red_teams
        .map((teamNumber) => allTeamRatings.get(teamNumber))
        .filter((r): r is TeamRating => !!r);
      const blueRatings = match.blue_teams
        .map((teamNumber) => allTeamRatings.get(teamNumber))
        .filter((r): r is TeamRating => !!r);

      if (redRatings.length !== match.red_teams.length || blueRatings.length !== match.blue_teams.length || redRatings.length === 0 || blueRatings.length === 0) {
        return {
          ...match,
          predicted_winner: "unknown",
          win_probability_pct: null,
          note: "Insufficient rating data",
        };
      }

      const prediction = predictMatch(redRatings, blueRatings);
      if (prediction.alliance_a.confidence < 0.2 || prediction.alliance_b.confidence < 0.2) {
        return { ...match, predicted_winner: "unknown", win_probability_pct: null, note: "Low confidence: insufficient completed matches" };
      }
      const redPct = prediction.alliance_a.win_probability * 100;
      const bluePct = prediction.alliance_b.win_probability * 100;

      return {
        ...match,
        predicted_winner: redPct >= bluePct ? "red" : "blue",
        win_probability_pct: Math.max(redPct, bluePct).toFixed(1),
        note:
          redPct >= bluePct
            ? `Red advantage: ${prediction.alliance_a.key_advantage}`
            : `Blue advantage: ${prediction.alliance_b.key_advantage}`,
      };
    });

    return NextResponse.json({
      success: true,
      event_id: eventId,
      total_teams_at_event: insights.total_teams_at_event,
      top_10_teams: insights.top_10_teams.map((t) => ({
        rank: t.rank,
        team_number: t.team_number,
        elo_rating: t.elo_rating,
        event_matches: t.event_matches,
        event_wins: t.event_wins,
        event_win_rate_pct: ((t.event_win_rate || 0) * 100).toFixed(1),
      })),
      best_autonomous_teams: insights.best_autonomous_teams.map((t) => ({
        team_number: t.team_number,
        auton_rating: t.auton_rating,
        elo_rating: t.elo_rating,
      })),
      best_defensive_teams: insights.best_defensive_teams.map((t) => ({
        team_number: t.team_number,
        endgame_rating: t.endgame_rating,
        elo_rating: t.elo_rating,
      })),
      most_improved_teams: insights.most_improved_teams.map((t) => ({
        team_number: t.team_number,
        event_win_rate_pct: ((t.event_win_rate || 0) * 100).toFixed(1),
        event_matches: t.event_matches,
      })),
      team_stats: teamStats,
      scheduled_matches: scheduledMatches,
      ratings_source: "VEXGOAT estimate",
    });
  } catch (err: unknown) {
    console.error("Event insights error:", err);
    return NextResponse.json(
      { error: "Failed to fetch event insights", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
