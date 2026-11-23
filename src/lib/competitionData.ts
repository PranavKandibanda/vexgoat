import type { TeamMatchRecord, TeamEventRanking } from "./robotEvents";

export function eventStatus(event: { start?: string; end?: string; status?: string; ongoing?: boolean }, now = Date.now()): string {
  if (event.status?.toLowerCase().includes("postpon")) return "postponed";
  if (event.ongoing === true) return "ongoing";
  const start = Date.parse(event.start ?? "");
  const end = Date.parse(event.end ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "date pending";
  return start > now ? "upcoming" : end < now ? "completed" : "ongoing";
}

export function normalizeEventMatch(match: {
  id: number; name?: string; matchnum?: number; round?: number; scheduled?: string; started?: string; scored?: boolean;
  alliances?: { color?: string; score?: number; teams?: { team?: { number?: string; name?: string } }[] }[];
}) {
  const colored = match.alliances?.some((alliance) => alliance.color);
  const red = colored ? match.alliances?.find((alliance) => alliance.color === "red") : match.alliances?.[0];
  const blue = colored ? match.alliances?.find((alliance) => alliance.color === "blue") : match.alliances?.[1];
  const hasResult = match.scored === true || !!match.started;
  const redScore = hasResult && Number.isFinite(red?.score) ? red!.score! : null;
  const blueScore = hasResult && Number.isFinite(blue?.score) ? blue!.score! : null;
  return {
    match_id: match.id,
    match_name: match.name ?? `Match ${match.id}`,
    match_number: String(match.matchnum ?? match.name ?? match.id),
    round: match.round ?? null,
    scheduled_at: match.scheduled ?? null,
    completed_at: null,
    red_teams: (red?.teams ?? []).map((team) => team.team?.number ?? team.team?.name).filter((number): number is string => !!number),
    blue_teams: (blue?.teams ?? []).map((team) => team.team?.number ?? team.team?.name).filter((number): number is string => !!number),
    red_score: redScore,
    blue_score: blueScore,
    status: match.scored && redScore !== null && blueScore !== null ? "completed"
      : match.started ? redScore !== null && blueScore !== null ? "provisional" : "results pending" : "scheduled",
  };
}

export function summarizeTeamMatches(matches: TeamMatchRecord[]) {
  const scores = matches.map((match) => match.score);
  return {
    matchesPlayed: matches.length,
    wins: matches.filter((match) => match.outcome === "win").length,
    losses: matches.filter((match) => match.outcome === "loss").length,
    ties: matches.filter((match) => match.outcome === "tie").length,
    unresolved: matches.filter((match) => match.outcome === "unknown").length,
    averageScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    highScore: scores.length ? Math.max(...scores) : null,
    events: new Set(matches.map((match) => match.event_id).filter(Boolean)).size,
  };
}

export function summarizeTeamRankings(rankings: TeamEventRanking[]) {
  const complete = rankings.filter((row) => row.wins !== null && row.losses !== null && row.ties !== null);
  const counts = complete.map((row) => row.wins! + row.losses! + row.ties!);
  const weighted = complete.filter((row) => row.averageScore !== null && row.wins! + row.losses! + row.ties! > 0);
  const weightedMatches = weighted.reduce((sum, row) => sum + row.wins! + row.losses! + row.ties!, 0);
  const highs = rankings.map((row) => row.highScore).filter((score): score is number => score !== null);
  return {
    events: rankings.length,
    matchesPlayed: complete.length ? counts.reduce((sum, count) => sum + count, 0) : null,
    wins: complete.length ? complete.reduce((sum, row) => sum + row.wins!, 0) : null,
    losses: complete.length ? complete.reduce((sum, row) => sum + row.losses!, 0) : null,
    ties: complete.length ? complete.reduce((sum, row) => sum + row.ties!, 0) : null,
    averageScore: weightedMatches ? Math.round(weighted.reduce((sum, row) => sum + row.averageScore! * (row.wins! + row.losses! + row.ties!), 0) / weightedMatches) : null,
    highScore: highs.length ? Math.max(...highs) : null,
  };
}

export function bestSkillsPair(runs: { type?: string; score?: number; event?: { id?: number; name?: string } }[]) {
  const perEvent = new Map<string, { driver: number | null; programming: number | null }>();
  let highestDriver: number | null = null;
  let highestProgramming: number | null = null;
  for (const run of runs) {
    if ((run.type !== "driver" && run.type !== "programming") || !Number.isFinite(run.score)) continue;
    if (run.type === "driver") highestDriver = Math.max(highestDriver ?? 0, run.score!);
    else highestProgramming = Math.max(highestProgramming ?? 0, run.score!);
    const key = run.event?.id ?? run.event?.name;
    if (key === undefined) continue;
    const eventKey = String(key);
    const pair = perEvent.get(eventKey) ?? { driver: null, programming: null };
    pair[run.type] = Math.max(pair[run.type] ?? 0, run.score!);
    perEvent.set(eventKey, pair);
  }
  const best = [...perEvent.values()].filter((pair) => pair.driver !== null && pair.programming !== null)
    .sort((a, b) => (b.driver! + b.programming!) - (a.driver! + a.programming!))[0];
  return { driver: best?.driver ?? highestDriver, programming: best?.programming ?? highestProgramming,
    total: best ? best.driver! + best.programming! : null };
}
