import { NextRequest, NextResponse } from "next/server";
import { fetchTeam, fetchSkills, fetchAwards, fetchTeamMatchHistory, fetchTeamRankings } from "@/lib/robotEvents";
import { calculateStrength } from "@/lib/strengthAlgorithm";
import { CURRENT_SEASON_ID, PREVIOUS_SEASON_ID, VexApiError } from "@/lib/robotEventsClient";
import { summarizeTeamMatches, summarizeTeamRankings } from "@/lib/competitionData";

export async function GET(req: NextRequest) {
  const number = req.nextUrl.searchParams.get("number");

  if (!number || !/^[a-zA-Z0-9]+$/.test(number.trim())) {
    return NextResponse.json(
      { error: "Invalid team number. Must be alphanumeric." },
      { status: 400 }
    );
  }
  const season = Number(req.nextUrl.searchParams.get("season") ?? CURRENT_SEASON_ID);
  if (![CURRENT_SEASON_ID, PREVIOUS_SEASON_ID].includes(season)) return NextResponse.json({ error: "Invalid season." }, { status: 400 });

  try {
    const team = await fetchTeam(number.trim());
    const [skills, awards, matches, rankings] = await Promise.all([
      fetchSkills(team.id, team.number, season),
      fetchAwards(team.id, season),
      fetchTeamMatchHistory(team.id, undefined, season),
      fetchTeamRankings(team.id, season),
    ]);
    const strength = season === PREVIOUS_SEASON_ID ? calculateStrength(skills, awards) : null;
    const record = summarizeTeamMatches(matches);

    return NextResponse.json({ team, skills, awards, strength, matches, record, rankings, qualification: summarizeTeamRankings(rankings), season });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }
    if (err instanceof VexApiError && (err.status === 429 || err.status === 401 || err.status === 403)) {
      return NextResponse.json(
        { error: err.status === 429 ? "API rate limit reached. Please try again later." : "VEX Events API authentication failed." },
        { status: err.status }
      );
    }
    console.error("Team API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch team data." },
      { status: 500 }
    );
  }
}
