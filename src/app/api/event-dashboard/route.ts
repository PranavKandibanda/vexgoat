import { NextRequest, NextResponse } from "next/server";
import { fetchAllPages, fetchRobotEventsJson, VexApiError } from "@/lib/robotEventsClient";
import { fetchEventDivisions, fetchEventMatchRows } from "@/lib/robotEvents";
import { normalizeEventMatch } from "@/lib/competitionData";

interface EventDetail {
  id: number;
  name?: string;
  sku?: string;
  start?: string;
  end?: string;
  status?: string;
  team_count?: number;
  location?: { city?: string; region?: string; country?: string };
}

type DashboardTab = "overview" | "matches" | "rankings" | "skills" | "awards" | "scout";

export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get("event_id");
  const divisionId = req.nextUrl.searchParams.get("division_id");
  const rawTab = req.nextUrl.searchParams.get("tab");
  const tab: DashboardTab = ["overview", "matches", "rankings", "skills", "awards", "scout"].includes(rawTab ?? "") ? rawTab as DashboardTab : "overview";
  if (!rawId || !/^\d+$/.test(rawId) || (divisionId && divisionId !== "all" && !/^\d+$/.test(divisionId))) {
    return NextResponse.json({ error: "Invalid event or division ID" }, { status: 400 });
  }
  const eventId = Number(rawId);
  try {
    const response = await fetchRobotEventsJson<EventDetail & { data?: EventDetail }>(`/events/${eventId}`, { ttlMs: 120_000 });
    const detail = response.data ?? response;
    const event = {
      id: eventId,
      name: detail.name ?? `Event ${eventId}`,
      sku: detail.sku ?? null,
      start: detail.start ?? null,
      end: detail.end ?? null,
      status: detail.status ?? null,
      location: [detail.location?.city, detail.location?.region, detail.location?.country].filter(Boolean).join(", "),
      team_count: detail.team_count ?? null,
    };
    const result: Record<string, unknown> = {
      success: true, tab, event,
      total_teams_at_event: event.team_count,
      teams: [], qualification_matches: [], qualification_leaderboard: [], skills_leaderboard: [], awards: [],
    };

    if (tab === "overview" || tab === "scout") {
      const teams = await fetchAllPages<{ id: number; number?: string; team_name?: string }>(`/events/${eventId}/teams`, { ttlMs: 120_000 });
      result.teams = teams.map((team) => ({ id: team.id, number: team.number, name: team.team_name ?? null }));
      result.total_teams_at_event = teams.length;
    }

    if (tab === "matches") {
      const matches = await fetchEventMatchRows(eventId, divisionId && divisionId !== "all" ? divisionId : undefined);
      result.qualification_matches = matches.map(normalizeEventMatch);
    }

    if (tab === "rankings") {
      const divisions = divisionId && divisionId !== "all" ? [{ id: divisionId }] : await fetchEventDivisions(eventId);
      const pages = await Promise.all(divisions.map((division) =>
        fetchAllPages<{ rank?: number; team?: { name?: string }; wins?: number; losses?: number; ties?: number }>(`/events/${eventId}/divisions/${division.id}/rankings`, { ttlMs: 120_000 })
      ));
      result.qualification_leaderboard = pages.flatMap((rows, index) => rows.map((row) => ({
        division_id: divisions[index].id, rank: row.rank ?? null, team_number: row.team?.name ?? null,
        wins: row.wins ?? null, losses: row.losses ?? null, ties: row.ties ?? null,
      })));
    }

    if (tab === "skills") {
      const runs = await fetchAllPages<{ type?: string; score?: number; team?: { name?: string } }>(`/events/${eventId}/skills`, { ttlMs: 120_000 });
      const byTeam = new Map<string, { team_number: string; driver: number | null; programming: number | null }>();
      for (const run of runs) {
        const number = run.team?.name;
        if (!number || !Number.isFinite(run.score) || (run.type !== "driver" && run.type !== "programming")) continue;
        const row = byTeam.get(number) ?? { team_number: number, driver: null, programming: null };
        row[run.type] = Math.max(row[run.type] ?? 0, run.score!);
        byTeam.set(number, row);
      }
      const rows = [...byTeam.values()].map((row) => ({ ...row, combined: row.driver !== null && row.programming !== null ? row.driver + row.programming : null }))
        .sort((a, b) => (b.combined ?? -1) - (a.combined ?? -1));
      result.skills_leaderboard = rows.map((row) => ({
        ...row, rank: row.combined === null ? null : rows.findIndex((other) => other.combined === row.combined) + 1,
      }));
    }

    if (tab === "awards") {
      const awards = await fetchAllPages<{ id: number; title?: string; teamWinners?: { team?: { name?: string } }[] }>(`/events/${eventId}/awards`, { ttlMs: 600_000 });
      result.awards = awards.map((award) => ({ id: award.id, name: award.title ?? "Award", team_number: (award.teamWinners ?? []).map((winner) => winner.team?.name).filter(Boolean).join(", ") || null }));
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof VexApiError && error.status === 404) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    console.error("Event dashboard failed:", error);
    return NextResponse.json({ error: "Event data is temporarily unavailable" }, { status: 502 });
  }
}
