import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { predictMatch, type TeamRating } from "@/lib/eloRating";

export async function GET(req: NextRequest) {
  const teamsParam = req.nextUrl.searchParams.get("teams");

  if (!teamsParam) {
    return NextResponse.json(
      { error: "Provide comma-separated team numbers: ?teams=1234A,5678B,1111C,2222D" },
      { status: 400 }
    );
  }

  const teamNumbers = teamsParam
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  if (teamNumbers.length < 4) {
    return NextResponse.json(
      { error: "Provide at least 4 teams (2 per alliance)" },
      { status: 400 }
    );
  }

  if (teamNumbers.length > 6) {
    return NextResponse.json(
      { error: "Maximum 6 teams (3 per alliance)" },
      { status: 400 }
    );
  }

  // Validate team numbers are alphanumeric
  for (const team of teamNumbers) {
    if (!/^[a-zA-Z0-9]+$/.test(team)) {
      return NextResponse.json(
        { error: `Invalid team number: ${team}` },
        { status: 400 }
      );
    }
  }

  try {
    // Fetch team ratings from Firestore
    const ratings: TeamRating[] = [];
    for (const teamNumber of teamNumbers) {
      try {
        const doc = await db.collection("team_ratings_204").doc(teamNumber).get();
        if (!doc.exists) {
          return NextResponse.json(
            { error: `Team ${teamNumber} not found in ratings database` },
            { status: 404 }
          );
        }
        ratings.push(doc.data() as TeamRating);
      } catch (err) {
        console.error(`Error fetching team ${teamNumber}:`, err);
        return NextResponse.json(
          { error: `Failed to fetch team ${teamNumber}` },
          { status: 500 }
        );
      }
    }

    // Split into two alliances
    const allianceA = ratings.slice(0, teamNumbers.length / 2);
    const allianceB = ratings.slice(teamNumbers.length / 2);

    if (allianceA.length === 0 || allianceB.length === 0) {
      return NextResponse.json(
        { error: "Could not split teams into valid alliances" },
        { status: 400 }
      );
    }

    // Predict match
    const prediction = predictMatch(allianceA, allianceB);
    const lowConfidence = prediction.alliance_a.confidence < 0.2 || prediction.alliance_b.confidence < 0.2;

    // Format response
    const teamNamesA = allianceA.map((r) => r.team_number).join(", ");
    const teamNamesB = allianceB.map((r) => r.team_number).join(", ");

    return NextResponse.json({
      prediction_timestamp: new Date().toISOString(),
      source: "VEXGOAT estimate",
      note: lowConfidence ? "Insufficient completed matches for a reliable prediction" : null,
      alliance_a: {
        teams: teamNamesA,
        team_details: allianceA.map((r) => ({
          number: r.team_number,
          elo_rating: r.elo_rating,
          auton_rating: r.auton_rating,
          driver_rating: r.driver_rating,
          endgame_rating: r.endgame_rating,
          win_rate:
            r.matches_played > 0
              ? ((r.wins / r.matches_played) * 100).toFixed(1) + "%"
              : "N/A",
        })),
        win_probability_pct: (prediction.alliance_a.win_probability * 100).toFixed(1),
        expected_score: prediction.alliance_a.expected_score_range,
        key_advantage: prediction.alliance_a.key_advantage,
        confidence: (prediction.alliance_a.confidence * 100).toFixed(0) + "%",
      },
      alliance_b: {
        teams: teamNamesB,
        team_details: allianceB.map((r) => ({
          number: r.team_number,
          elo_rating: r.elo_rating,
          auton_rating: r.auton_rating,
          driver_rating: r.driver_rating,
          endgame_rating: r.endgame_rating,
          win_rate:
            r.matches_played > 0
              ? ((r.wins / r.matches_played) * 100).toFixed(1) + "%"
              : "N/A",
        })),
        win_probability_pct: (prediction.alliance_b.win_probability * 100).toFixed(1),
        expected_score: prediction.alliance_b.expected_score_range,
        key_advantage: prediction.alliance_b.key_advantage,
        confidence: (prediction.alliance_b.confidence * 100).toFixed(0) + "%",
      },
      summary: {
        winner: lowConfidence || prediction.alliance_a.win_probability === 0.5 ? "Unknown" : prediction.alliance_a.win_probability > 0.5 ? "Alliance A" : "Alliance B",
        winner_probability_pct: (
          Math.max(prediction.alliance_a.win_probability, prediction.alliance_b.win_probability) *
          100
        ).toFixed(1),
        expected_point_margin: null,
      },
    });
  } catch (err: unknown) {
    console.error("Predict match error:", err);
    return NextResponse.json(
      { error: "Failed to predict match", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
