import { NextRequest, NextResponse } from "next/server";
import { fetchEventDivisions } from "@/lib/robotEvents";
import { VexApiError } from "@/lib/robotEventsClient";

export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get("event_id");
  if (!rawId || !/^\d+$/.test(rawId)) return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  try {
    const divisions = await fetchEventDivisions(Number(rawId));
    return NextResponse.json({ success: true, divisions, count: divisions.length });
  } catch (error) {
    if (error instanceof VexApiError && error.status === 404) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    console.error("Event divisions failed:", error);
    return NextResponse.json({ error: "Event divisions are temporarily unavailable" }, { status: 502 });
  }
}
