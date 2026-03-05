import { NextRequest, NextResponse } from "next/server";
import { fetchTeam, fetchSkills, fetchAwards } from "@/lib/robotEvents";
import { calculateStrength } from "@/lib/strengthAlgorithm";

export async function GET(req: NextRequest) {
  const number = req.nextUrl.searchParams.get("number");

  if (!number || !/^[a-zA-Z0-9]+$/.test(number.trim())) {
    return NextResponse.json(
      { error: "Invalid team number. Must be alphanumeric." },
      { status: 400 }
    );
  }

  try {
    const team = await fetchTeam(number.trim());
    const [skills, awards] = await Promise.all([
      fetchSkills(team.id, team.number),
      fetchAwards(team.id),
    ]);
    const strength = calculateStrength(skills, awards);

    return NextResponse.json({ team, skills, awards, strength });
  } catch (err: any) {
    if (err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }
    if (err.message === "RATE_LIMITED") {
      return NextResponse.json(
        { error: "API rate limit reached. Please try again later." },
        { status: 429 }
      );
    }
    console.error("Team API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch team data." },
      { status: 500 }
    );
  }
}
