import { NextRequest, NextResponse } from "next/server";
import { fetchAllPages, VexApiError } from "@/lib/robotEventsClient";
import { fetchEventDivisions } from "@/lib/robotEvents";

interface Ranking { rank?: number; team?: { name?: string }; wins?: number; losses?: number; ties?: number }

export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get("event_id");
  if (!rawId || !/^\d+$/.test(rawId)) return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  const eventId = Number(rawId);
  try {
    const divisions = await fetchEventDivisions(eventId);
    const pages = await Promise.all(divisions.map((division) =>
      fetchAllPages<Ranking>(`/events/${eventId}/divisions/${division.id}/rankings`, { ttlMs: 120_000 })
    ));
    const rankings = pages.flatMap((rows, index) => rows.map((row) => ({
      division_id: divisions[index].id,
      rank: row.rank ?? null,
      team_number: row.team?.name ?? null,
      wins: row.wins ?? null, losses: row.losses ?? null, ties: row.ties ?? null,
    })));
    return NextResponse.json({ success: true, source: "official", event_id: eventId, rankings });
  } catch (error) {
    if (error instanceof VexApiError && error.status === 404) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    console.error("Event rankings failed:", error);
    return NextResponse.json({ error: "Event rankings are temporarily unavailable" }, { status: 502 });
  }
}
