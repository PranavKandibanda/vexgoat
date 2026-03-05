import { NextRequest, NextResponse } from "next/server";
import { fetchTeam, fetchSkills, fetchAwards } from "@/lib/robotEvents";
import { calculateStrength } from "@/lib/strengthAlgorithm";

export async function GET(req: NextRequest) {
  const numbers = req.nextUrl.searchParams.get("numbers"); // comma-separated, e.g. "1234A,5678B"

  if (!numbers) {
    return NextResponse.json({ error: "Provide comma-separated team numbers." }, { status: 400 });
  }

  const parts = numbers.split(",").map((n) => n.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 2) {
    return NextResponse.json({ error: "Provide exactly 2 team numbers." }, { status: 400 });
  }
  for (const p of parts) {
    if (!/^[a-zA-Z0-9]+$/.test(p)) {
      return NextResponse.json({ error: `Invalid team number: ${p}` }, { status: 400 });
    }
  }

  try {
    const results = await Promise.all(
      parts.map(async (num) => {
        const team = await fetchTeam(num);
        const [skills, awards] = await Promise.all([
          fetchSkills(team.id, team.number),
          fetchAwards(team.id),
        ]);
        const strength = calculateStrength(skills, awards);
        return { team, skills, awards, strength };
      })
    );
    return NextResponse.json({ teams: results });
  } catch (err: any) {
    if (err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "One or more teams not found." }, { status: 404 });
    }
    if (err.message === "RATE_LIMITED") {
      return NextResponse.json({ error: "Rate limited. Try again later." }, { status: 429 });
    }
    console.error("Compare API error:", err);
    return NextResponse.json({ error: "Failed to fetch comparison data." }, { status: 500 });
  }
}
