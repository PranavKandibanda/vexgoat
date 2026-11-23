import { NextRequest, NextResponse } from "next/server";
import { CURRENT_SEASON_ID, PREVIOUS_SEASON_ID, fetchAllPages } from "@/lib/robotEventsClient";
import { eventStatus } from "@/lib/competitionData";

interface EventRow {
  id: number;
  sku?: string;
  name?: string;
  start?: string;
  end?: string;
  location?: { city?: string; region?: string; country?: string };
  team_count?: number;
  status?: string;
  ongoing?: boolean;
}

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const season = Number(req.nextUrl.searchParams.get("season") ?? CURRENT_SEASON_ID);
  if (![CURRENT_SEASON_ID, PREVIOUS_SEASON_ID].includes(season)) {
    return NextResponse.json({ error: "Invalid season" }, { status: 400 });
  }
  try {
    const now = Date.now();
    // shortcut: the initial list omits events that began over 30 days ago; widen if long-running events become common.
    const recentDate = `${new Date(now - 30 * 86_400_000).toISOString().slice(0, 10)}T00%3A00%3A00Z`;
    const path = query ? `/seasons/${season}/events` : `/seasons/${season}/events?start=${recentDate}`;
    const events = await fetchAllPages<EventRow>(path, { revalidateSeconds: 600, ttlMs: 600_000 });
    const matching = events.filter((event) => query
      ? [event.name, event.sku, event.id, event.location?.city, event.location?.region]
          .some((value) => String(value ?? "").toLowerCase().includes(query))
      : event.ongoing === true || (event.end && Date.parse(event.end) >= now));
    if (!query) matching.sort((a, b) => Date.parse(a.start ?? "") - Date.parse(b.start ?? ""));
    const results = matching.slice(0, 20).map((event) => ({
      id: event.id,
      name: event.name ?? `Event ${event.id}`,
      start: event.start ?? null,
      end: event.end ?? null,
      location: [event.location?.city, event.location?.region, event.location?.country].filter(Boolean).join(", "),
      team_count: event.team_count ?? null,
      status: eventStatus(event, now),
    }));
    return NextResponse.json({ success: true, query, season, total: results.length, events: results });
  } catch (error) {
    console.error("Event search failed:", error);
    return NextResponse.json({ error: "Event search is temporarily unavailable." }, { status: 502 });
  }
}
