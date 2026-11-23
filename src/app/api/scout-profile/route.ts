import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { generateTeamProfile } from "@/lib/teamProfiles";
import type { TeamRating } from "@/lib/eloRating";

export async function GET(req: NextRequest) {
  const number = req.nextUrl.searchParams.get("number");

  if (!number || !/^[a-zA-Z0-9]+$/.test(number.trim())) {
    return NextResponse.json(
      { error: "Invalid team number. Must be alphanumeric." },
      { status: 400 }
    );
  }

  try {
    // Fetch team rating from Firestore
    const teamNumber = number.trim().toUpperCase();
    const ratingDoc = await db.collection("team_ratings_204").doc(teamNumber).get();

    if (!ratingDoc.exists) {
      return NextResponse.json(
        { error: `Team ${teamNumber} not found in scouting database` },
        { status: 404 }
      );
    }

    const teamRating = ratingDoc.data() as TeamRating;

    // Generate full profile
    const profile = generateTeamProfile(teamRating);

    return NextResponse.json({
      success: true,
      team_number: teamNumber,
      profile,
      detailed_metrics: {
        elo_rating: teamRating.elo_rating,
        auton_rating: teamRating.auton_rating,
        driver_rating: teamRating.driver_rating,
        endgame_rating: teamRating.endgame_rating,
        matches_played: teamRating.matches_played,
        total_wins: teamRating.wins,
        win_rate_pct:
          teamRating.matches_played > 0
            ? ((teamRating.wins / teamRating.matches_played) * 100).toFixed(1)
            : "N/A",
        consistency_index: teamRating.consistency_index,
        last_updated: teamRating.updated_at,
      },
    });
  } catch (err: unknown) {
    console.error("Scout profile error:", err);
    return NextResponse.json(
      { error: "Failed to fetch scout profile", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
