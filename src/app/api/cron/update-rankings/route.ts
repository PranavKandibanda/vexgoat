import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";

const BASE_URL = "https://www.robotevents.com/api/v2";
const SEASON_ID = 197; // Push Back 2025-2026

function headers() {
  const key = process.env.ROBOT_EVENTS_API_KEY;
  if (!key) throw new Error("ROBOT_EVENTS_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, Accept: "application/json" };
}

async function apiFetch<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: headers() });
    if (res.status === 429) {
      const wait = Math.pow(2, attempt + 1) * 1000;
      console.log(`Rate limited, waiting ${wait / 1000}s (attempt ${attempt + 1}/5)`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json() as Promise<T>;
  }
  throw new Error("API error 429: rate limited after 5 retries");
}

/**
 * Fetch events that started in the last N days.
 * This keeps the request count small enough for a 60s function.
 */
async function fetchRecentEventIds(daysBack: number): Promise<number[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceStr = since.toISOString().split("T")[0]; // YYYY-MM-DD

  const ids: number[] = [];
  let page = 1;
  while (true) {
    const data: any = await apiFetch(
      `${BASE_URL}/seasons/${SEASON_ID}/events?start=${sinceStr}&per_page=100&page=${page}`
    );
    if (!data.data?.length) break;
    for (const e of data.data) ids.push(e.id);
    if (data.meta?.current_page >= data.meta?.last_page) break;
    page++;
    if (page > 10) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return ids;
}

/** Fetch all skills entries for one event */
async function fetchEventSkills(eventId: number): Promise<any[]> {
  const items: any[] = [];
  let page = 1;
  while (true) {
    const data: any = await apiFetch(
      `${BASE_URL}/events/${eventId}/skills?per_page=100&page=${page}`
    );
    if (!data.data?.length) break;
    items.push(...data.data);
    if (data.meta?.current_page >= data.meta?.last_page) break;
    page++;
    if (page > 20) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  return items;
}

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting incremental skills ranking update...");

    // 1. Fetch only events from the last 3 days
    const eventIds = await fetchRecentEventIds(3);
    console.log(`Found ${eventIds.length} recent events`);

    if (eventIds.length === 0) {
      return NextResponse.json({ success: true, message: "No recent events to process" });
    }

    // 2. Load existing rankings from Firestore
    const existingDocs = await db.collection("skills_rankings").get();
    const teamBests = new Map<
      string,
      { teamNumber: string; teamId: number; driver: number; programming: number }
    >();
    for (const doc of existingDocs.docs) {
      if (doc.id === "_meta") continue;
      const d = doc.data();
      teamBests.set(doc.id, {
        teamNumber: d.teamNumber,
        teamId: d.teamId,
        driver: d.driver,
        programming: d.programming,
      });
    }
    console.log(`Loaded ${teamBests.size} existing teams from Firestore`);

    // 3. Process recent events and merge new data
    for (let i = 0; i < eventIds.length; i++) {
      const entries = await fetchEventSkills(eventIds[i]);

      for (const entry of entries) {
        const teamNumber: string = entry.team?.name ?? "";
        const teamId: number = entry.team?.id ?? 0;
        if (!teamNumber || !teamId) continue;

        const existing = teamBests.get(teamNumber) ?? {
          teamNumber,
          teamId,
          driver: 0,
          programming: 0,
        };

        const score: number = entry.score ?? 0;
        if (entry.type === "driver" && score > existing.driver) {
          existing.driver = score;
        }
        if (entry.type === "programming" && score > existing.programming) {
          existing.programming = score;
        }

        teamBests.set(teamNumber, existing);
      }

      if (i < eventIds.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // 4. Re-rank all teams
    const sorted = [...teamBests.values()]
      .map((t) => ({ ...t, combined: t.driver + t.programming }))
      .filter((t) => t.combined > 0)
      .sort((a, b) => b.combined - a.combined);

    let rank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].combined < sorted[i - 1].combined) {
        rank = i + 1;
      }
      (sorted[i] as any).rank = rank;
    }

    console.log(`Ranked ${sorted.length} teams`);

    // 5. Write updated rankings to Firestore
    const updatedAt = new Date().toISOString();
    for (let i = 0; i < sorted.length; i += 500) {
      const batch = db.batch();
      for (const team of sorted.slice(i, i + 500)) {
        const ref = db.collection("skills_rankings").doc(team.teamNumber);
        batch.set(ref, {
          rank: (team as any).rank,
          teamNumber: team.teamNumber,
          teamId: team.teamId,
          driver: team.driver,
          programming: team.programming,
          combined: team.combined,
          updatedAt,
        });
      }
      await batch.commit();
    }

    await db.collection("skills_rankings").doc("_meta").set({
      lastUpdated: updatedAt,
      totalTeams: sorted.length,
      recentEventsProcessed: eventIds.length,
      seasonId: SEASON_ID,
    });

    console.log("Incremental update complete!");

    return NextResponse.json({
      success: true,
      recentEvents: eventIds.length,
      totalTeams: sorted.length,
      updatedAt,
    });
  } catch (err: any) {
    console.error("Cron update-rankings error:", err);
    return NextResponse.json(
      { error: "Failed to update rankings", details: err.message },
      { status: 500 }
    );
  }
}
