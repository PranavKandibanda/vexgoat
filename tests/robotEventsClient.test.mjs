import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchAllPages, fetchRobotEventsJson, VexApiError } from "../src/lib/robotEventsClient.ts";
import { calculateOverrideSkillsScore } from "../src/lib/overrideScoring.ts";
import { bestSkillsPair, eventStatus, normalizeEventMatch, summarizeTeamMatches, summarizeTeamRankings } from "../src/lib/competitionData.ts";

const live = JSON.parse(readFileSync(new URL("./fixtures/vex-events-live-2026-11-22.json", import.meta.url), "utf8"));

const originalFetch = globalThis.fetch;
const originalToken = process.env.VEX_EVENTS_API_TOKEN;
const originalLegacyToken = process.env.ROBOT_EVENTS_API_KEY;
process.env.VEX_EVENTS_API_TOKEN = "fixture-token";

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.VEX_EVENTS_API_TOKEN;
  else process.env.VEX_EVENTS_API_TOKEN = originalToken;
  if (originalLegacyToken === undefined) delete process.env.ROBOT_EVENTS_API_KEY;
  else process.env.ROBOT_EVENTS_API_KEY = originalLegacyToken;
});

test("requires a server token and accepts the existing variable name", async () => {
  delete process.env.VEX_EVENTS_API_TOKEN;
  delete process.env.ROBOT_EVENTS_API_KEY;
  await assert.rejects(fetchRobotEventsJson("/teams?fixture=no-token"), /not set/);
  process.env.ROBOT_EVENTS_API_KEY = "existing-fixture-token";
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer existing-fixture-token");
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };
  assert.deepEqual(await fetchRobotEventsJson("/teams?fixture=existing-token"), { data: [] });
  delete process.env.ROBOT_EVENTS_API_KEY;
  process.env.VEX_EVENTS_API_TOKEN = "fixture-token";
});

test("adds server bearer token, follows all pages, and deduplicates concurrent reads", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const page = Number(new URL(url).searchParams.get("page"));
    return new Response(JSON.stringify({ data: [{ id: page }], meta: { current_page: page, last_page: 2 } }), { status: 200 });
  };
  const [first, second] = await Promise.all([
    fetchAllPages("/seasons/204/events?fixture=parallel"),
    fetchAllPages("/seasons/204/events?fixture=parallel"),
  ]);
  assert.deepEqual(first, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(second, first);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ url, options }) => url.startsWith("https://events.vex.com/api/v2/") && options.headers.Authorization === "Bearer fixture-token"));
});

test("401 is surfaced without retry and 429 is retried", async () => {
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; return new Response("{}", { status: 401 }); };
  await assert.rejects(fetchRobotEventsJson("/teams?fixture=auth"), (error) => error instanceof VexApiError && error.status === 401);
  assert.equal(attempts, 1);
  attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return attempts === 1
      ? new Response("{}", { status: 429, headers: { "retry-after": "0" } })
      : new Response(JSON.stringify({ data: [] }), { status: 200 });
  };
  assert.deepEqual(await fetchRobotEventsJson("/teams?fixture=rate"), { data: [] });
  assert.equal(attempts, 2);
});

test("rejects missing pagination metadata and unsafe absolute URLs", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [{ id: 1 }] }), { status: 200 });
  await assert.rejects(fetchAllPages("/teams?fixture=badmeta"), /Missing pagination metadata/);
  await assert.rejects(fetchRobotEventsJson("https://example.com/steal"), /Expected an API path/);
});

test("Override RSC3 scoring uses scored halves and Midfield only", () => {
  assert.equal(calculateOverrideSkillsScore(3, 2, true), 43);
  assert.throws(() => calculateOverrideSkillsScore(-1, 0, false));
});

test("event dates distinguish upcoming, completed historical, and postponed events", () => {
  const now = Date.parse("2026-11-22T12:00:00Z");
  assert.equal(eventStatus({ start: "2026-12-01", end: "2026-12-02" }, now), "upcoming");
  assert.equal(eventStatus({ start: "2025-11-01", end: "2025-11-02" }, now), "completed");
  assert.equal(eventStatus({ start: "2026-12-01", end: "2026-12-02", status: "Postponed" }, now), "postponed");
  assert.equal(eventStatus({ start: "2026-11-22", end: "2026-11-22", ongoing: true }, now), "ongoing");
  assert.equal(eventStatus({ start: "2026-12-01" }, now), "date pending");
});

test("normalizes completed and partly published matches without inventing scores", () => {
  const base = { id: 10, name: "Q1", alliances: [
    { color: "blue", score: 45, teams: [{ team: { number: "2B" } }] },
    { color: "red", score: 50, teams: [{ team: { number: "1A" } }] },
  ] };
  const complete = normalizeEventMatch({ ...base, started: "2026-11-22T11:00:00Z", scored: true });
  assert.deepEqual([complete.red_teams, complete.blue_teams, complete.red_score, complete.blue_score, complete.status], [["1A"], ["2B"], 50, 45, "completed"]);
  const partial = normalizeEventMatch({ ...base, started: "2026-11-22T11:00:00Z", alliances: [{ color: "red", score: 50 }] });
  assert.equal(partial.blue_score, null);
  assert.equal(partial.status, "results pending");
  assert.deepEqual(partial.blue_teams, []);
  const scheduled = normalizeEventMatch({ ...base, alliances: base.alliances.map((alliance) => ({ ...alliance, score: 0 })) });
  assert.equal(scheduled.red_score, null);
  assert.equal(scheduled.blue_score, null);
});

test("recorded VEX Events rows use current match, ranking, skill, and award schemas", () => {
  assert.equal(live.season204.id, 204);
  assert.equal(live.event204.season.id, 204);
  assert.equal(eventStatus(live.upcomingEvent, Date.parse("2026-11-22T12:00:00Z")), "upcoming");
  const match = normalizeEventMatch(live.match204);
  assert.equal(match.status, "provisional");
  assert.equal(match.red_score, 29);
  assert.equal(match.blue_score, 14);
  assert.ok(match.red_teams.includes("23401D"));
  assert.equal(live.ranking204.team.name, "84134H");
  assert.equal(live.skill204.type, "driver");
  assert.ok(live.award204.teamWinners.some((winner) => winner.team.name));
  assert.equal(live.historicalMatch.event.id, 59975);
});

test("qualification summary uses official ranking rows and keeps absent data missing", () => {
  const ranking = live.ranking204;
  const row = {
    eventId: ranking.event.id, event: ranking.event.name, division: ranking.division.name,
    rank: ranking.rank, wins: ranking.wins, losses: ranking.losses, ties: ranking.ties,
    averageScore: ranking.average_points, highScore: ranking.high_score,
  };
  const summary = summarizeTeamRankings([row]);
  assert.deepEqual([summary.wins, summary.losses, summary.ties, summary.highScore], [2, 5, 0, 46]);
  assert.equal(summarizeTeamRankings([]).matchesPlayed, null);
});

test("team season summary handles several results and no results", () => {
  assert.deepEqual(summarizeTeamMatches([]), { matchesPlayed: 0, wins: 0, losses: 0, ties: 0, unresolved: 0, averageScore: null, highScore: null, events: 0 });
  const records = [
    { event_id: 1, score: 100, outcome: "win" }, { event_id: 1, score: 80, outcome: "loss" },
    { event_id: 2, score: 90, outcome: "tie" }, { event_id: 3, score: 110, outcome: "win" },
  ];
  assert.deepEqual(summarizeTeamMatches(records), { matchesPlayed: 4, wins: 2, losses: 1, ties: 1, unresolved: 0, averageScore: 95, highScore: 110, events: 3 });
});

test("combined skills use one event pair and keep missing scores unavailable", () => {
  const runs = [
    { event: { id: 1 }, type: "driver", score: 150 },
    { event: { id: 1 }, type: "programming", score: 40 },
    { event: { id: 2 }, type: "driver", score: 100 },
    { event: { id: 2 }, type: "programming", score: 120 },
  ];
  assert.deepEqual(bestSkillsPair(runs), { driver: 100, programming: 120, total: 220 });
  assert.deepEqual(bestSkillsPair([{ event: { id: 1 }, type: "driver", score: 0 }]), { driver: 0, programming: null, total: null });
  assert.deepEqual(bestSkillsPair([{ type: "driver", score: 50 }, { type: "programming", score: 40 }]), { driver: 50, programming: 40, total: null });
});
