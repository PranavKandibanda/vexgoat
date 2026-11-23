import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { calculateAllianceStrength, predictMatch, type TeamRating } from "@/lib/eloRating";
import { calculateAllianceSynergy, findBestPartners } from "@/lib/allianceSynergy";
import { fetchEventTeams } from "@/lib/eventFiltering";

export async function GET(req: NextRequest) {
  const teamParam = req.nextUrl.searchParams.get("team");
  const lockedPartnerParam = req.nextUrl.searchParams.get("locked_partner");
  const teamsParam = req.nextUrl.searchParams.get("teams");
  const findPartnersFor = req.nextUrl.searchParams.get("find_partners");
  const eventIdParam = req.nextUrl.searchParams.get("event_id");
  const eventId = eventIdParam && /^\d+$/.test(eventIdParam) ? parseInt(eventIdParam) : null;

  // New preferred mode: partner suggestions.
  if (teamParam) {
    if (lockedPartnerParam) {
      return handleFindThirdPartner(teamParam, lockedPartnerParam, eventId);
    }
    return handleFindPartners(teamParam, eventId);
  }

  // Legacy mode for compatibility.
  if (findPartnersFor) {
    return handleFindPartners(findPartnersFor, eventId);
  }

  // Otherwise, building alliance
  if (!teamsParam) {
    return NextResponse.json(
      {
        error:
          "Provide ?team=1234A for partner suggestions, ?team=1234A&locked_partner=5678B for third partner suggestions, or legacy ?teams=1234A,5678B,1111C,2222D for alliance comparison.",
      },
      { status: 400 }
    );
  }

  const teamNumbers = teamsParam
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  if (teamNumbers.length < 2 || teamNumbers.length > 6) {
    return NextResponse.json(
      { error: "Provide 2-6 team numbers (2-3 per alliance)" },
      { status: 400 }
    );
  }

  // Validate alphanumeric
  for (const team of teamNumbers) {
    if (!/^[a-zA-Z0-9]+$/.test(team)) {
      return NextResponse.json(
        { error: `Invalid team number: ${team}` },
        { status: 400 }
      );
    }
  }

  try {
    // Fetch all team ratings
    const ratings: TeamRating[] = [];
    for (const teamNumber of teamNumbers) {
      const doc = await db.collection("team_ratings_204").doc(teamNumber).get();
      if (!doc.exists) {
        return NextResponse.json(
          { error: `Team ${teamNumber} not found` },
          { status: 404 }
        );
      }
      ratings.push(doc.data() as TeamRating);
    }

    // Determine if 2v2, 3v3, 2v3, etc.
    const midpoint = Math.ceil(teamNumbers.length / 2);
    const allianceA = ratings.slice(0, midpoint);
    const allianceB = ratings.slice(midpoint);

    if (allianceA.length === 0 || allianceB.length === 0) {
      return NextResponse.json(
        { error: "Invalid alliance split" },
        { status: 400 }
      );
    }

    // Calculate alliance strength
    const strengthA = calculateAllianceStrength(allianceA);
    const strengthB = calculateAllianceStrength(allianceB);

    // Calculate synergy within each alliance
    const synergyA = calculateAllianceSynergy(allianceA);
    const synergyB = calculateAllianceSynergy(allianceB);

    // Predict match outcome
    const prediction = predictMatch(allianceA, allianceB);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      alliance_a: {
        teams: allianceA.map((r) => r.team_number).join(" + "),
        team_count: allianceA.length,
        total_alliance_rating: strengthA.total_strength,
        base_rating: strengthA.base_strength,
        auton_bonus: strengthA.auton_bonus,
        driver_bonus: strengthA.driver_bonus,
        endgame_bonus: strengthA.endgame_bonus,
        consistency_multiplier: strengthA.consistency_multiplier,
        internal_synergy_score: synergyA.synergy_score,
        internal_synergy_analysis: synergyA.detailed_analysis,
        internal_synergy_issues: synergyA.potential_issues,
        team_details: allianceA.map((r) => ({
          number: r.team_number,
          elo_rating: r.elo_rating,
          auton_rating: r.auton_rating,
          driver_rating: r.driver_rating,
          endgame_rating: r.endgame_rating,
          win_rate_pct:
            r.matches_played > 0
              ? ((r.wins / r.matches_played) * 100).toFixed(1) + "%"
              : "N/A",
        })),
      },
      alliance_b: {
        teams: allianceB.map((r) => r.team_number).join(" + "),
        team_count: allianceB.length,
        total_alliance_rating: strengthB.total_strength,
        base_rating: strengthB.base_strength,
        auton_bonus: strengthB.auton_bonus,
        driver_bonus: strengthB.driver_bonus,
        endgame_bonus: strengthB.endgame_bonus,
        consistency_multiplier: strengthB.consistency_multiplier,
        internal_synergy_score: synergyB.synergy_score,
        internal_synergy_analysis: synergyB.detailed_analysis,
        internal_synergy_issues: synergyB.potential_issues,
        team_details: allianceB.map((r) => ({
          number: r.team_number,
          elo_rating: r.elo_rating,
          auton_rating: r.auton_rating,
          driver_rating: r.driver_rating,
          endgame_rating: r.endgame_rating,
          win_rate_pct:
            r.matches_played > 0
              ? ((r.wins / r.matches_played) * 100).toFixed(1) + "%"
              : "N/A",
        })),
      },
      prediction: {
        winner: prediction.alliance_a.win_probability > 0.5 ? "Alliance A" : "Alliance B",
        alliance_a_win_probability_pct: (
          prediction.alliance_a.win_probability * 100
        ).toFixed(1),
        alliance_b_win_probability_pct: (
          prediction.alliance_b.win_probability * 100
        ).toFixed(1),
        alliance_a_expected_score: prediction.alliance_a.expected_score_range,
        alliance_b_expected_score: prediction.alliance_b.expected_score_range,
        alliance_a_key_advantage: prediction.alliance_a.key_advantage,
        alliance_b_key_advantage: prediction.alliance_b.key_advantage,
      },
    });
  } catch (err: unknown) {
    console.error("Alliance builder error:", err);
    return NextResponse.json(
      { error: "Failed to build alliance", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Find best partners for a team.
 */
async function handleFindPartners(teamNumber: string, eventId: number | null) {
  try {
    const normalized = teamNumber.trim().toUpperCase();

    // Validate team number
    if (!/^[a-zA-Z0-9]+$/.test(normalized)) {
      return NextResponse.json(
        { error: "Invalid team number" },
        { status: 400 }
      );
    }

    let availableTeams: string[];

    if (eventId) {
      const eventTeams = await fetchEventTeams(eventId);
      availableTeams = eventTeams.map((team) => team.team_number).filter(Boolean);
      if (availableTeams.length === 0) {
        return NextResponse.json(
          {
            error: `No teams found for event ${eventId}`,
            team_number: normalized,
            suggestions: [],
          },
          { status: 404 }
        );
      }
    } else {
      const allTeamsSnapshot = await db.collection("team_ratings_204").get();
      availableTeams = allTeamsSnapshot.docs
        .map((doc) => doc.id)
        .filter((id) => id !== "_meta");
    }

    if (!availableTeams.includes(normalized)) {
      return NextResponse.json(
        {
          error: eventId
            ? `Team ${normalized} is not registered for event ${eventId}`
            : `Team ${normalized} not found`,
          team_number: normalized,
          suggestions: [],
        },
        { status: 404 }
      );
    }

    // Find best partners
    const partners = await findBestPartners(
      db,
      normalized,
      availableTeams,
      3
    );

    if (partners.length === 0) {
      return NextResponse.json(
        {
          error: `No partners found for ${teamNumber}`,
          team_number: normalized,
          suggestions: [],
        },
        { status: 404 }
      );
    }

    const withDetails = await Promise.all(
      partners.map(async (partner) => {
        const doc = await db.collection("team_ratings_204").doc(partner.team_number).get();
        const rating = doc.exists ? (doc.data() as TeamRating) : null;
        return {
          team_number: partner.team_number,
          synergy_score: partner.synergy_score,
          rationale: partner.synergy_analysis.split("\n")[0] || "Strong role complementarity",
          elo_rating: rating?.elo_rating ?? 1500,
        };
      })
    );

    return NextResponse.json({
      success: true,
      mode: "second_partner",
      team_number: normalized,
      event_id: eventId,
      candidates: withDetails,
      best_partners: withDetails,
      suggested_partners: withDetails,
      note: eventId
        ? `These are the top 3 recommended alliance partners at event ${eventId} based on synergy score`
        : "These are the top 3 recommended alliance partners based on synergy score",
    });
  } catch (err: unknown) {
    console.error("Find partners error:", err);
    return NextResponse.json(
      { error: "Failed to find partners", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function handleFindThirdPartner(teamNumber: string, lockedPartner: string, eventId: number | null) {
  try {
    const teamA = teamNumber.trim().toUpperCase();
    const teamB = lockedPartner.trim().toUpperCase();

    if (!/^[a-zA-Z0-9]+$/.test(teamA) || !/^[a-zA-Z0-9]+$/.test(teamB)) {
      return NextResponse.json(
        { error: "Invalid team number" },
        { status: 400 }
      );
    }

    if (teamA === teamB) {
      return NextResponse.json(
        { error: "locked_partner must be different from team" },
        { status: 400 }
      );
    }

    let candidateIds: string[];

    if (eventId) {
      const eventTeams = await fetchEventTeams(eventId);
      candidateIds = eventTeams.map((team) => team.team_number).filter(Boolean);
      if (candidateIds.length === 0) {
        return NextResponse.json(
          { error: `No teams found for event ${eventId}` },
          { status: 404 }
        );
      }
    } else {
      const allTeamsSnapshot = await db.collection("team_ratings_204").get();
      candidateIds = allTeamsSnapshot.docs.map((doc) => doc.id).filter((id) => id !== "_meta");
    }

    const teamADoc = await db.collection("team_ratings_204").doc(teamA).get();
    const teamBDoc = await db.collection("team_ratings_204").doc(teamB).get();
    if (!teamADoc.exists || !teamBDoc.exists) {
      return NextResponse.json(
        { error: "One or both teams not found" },
        { status: 404 }
      );
    }

    if (eventId && (!candidateIds.includes(teamA) || !candidateIds.includes(teamB))) {
      return NextResponse.json(
        { error: `One or both teams are not registered for event ${eventId}` },
        { status: 404 }
      );
    }

    const teamARating = teamADoc.data() as TeamRating;
    const teamBRating = teamBDoc.data() as TeamRating;

    const filteredCandidateIds = candidateIds.filter((id) => id !== teamA && id !== teamB);

    const candidates = await Promise.all(
      filteredCandidateIds.map(async (candidateId) => {
        const doc = await db.collection("team_ratings_204").doc(candidateId).get();
        if (!doc.exists) return null;
        const candidateRating = doc.data() as TeamRating;
        const synergy = calculateAllianceSynergy([teamARating, teamBRating, candidateRating]);

        return {
          team_number: candidateId,
          synergy_score: synergy.synergy_score,
          rationale: synergy.detailed_analysis.split("\n")[0] || "Complements both teams",
          elo_rating: candidateRating.elo_rating,
        };
      })
    );

    const ranked = candidates
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.synergy_score - a.synergy_score)
      .slice(0, 3);

    return NextResponse.json({
      success: true,
      mode: "third_partner",
      team_number: teamA,
      locked_partner: teamB,
      event_id: eventId,
      candidates: ranked,
      note: eventId
        ? `These are the top 3 candidates at event ${eventId} to complete your alliance pair.`
        : "These are the top 3 candidates to complete your alliance pair.",
    });
  } catch (err: unknown) {
    console.error("Find third partner error:", err);
    return NextResponse.json(
      { error: "Failed to find third partner", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
