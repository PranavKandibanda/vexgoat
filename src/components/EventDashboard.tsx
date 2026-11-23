"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AllianceBuilder from "@/components/AllianceBuilder";

type Tab = "overview" | "matches" | "rankings" | "skills" | "awards" | "scout";
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Teams" }, { id: "matches", label: "Matches" },
  { id: "rankings", label: "Qualification rankings" }, { id: "skills", label: "Skills" },
  { id: "awards", label: "Awards" }, { id: "scout", label: "Alliance scout" },
];

interface DashboardData {
  event: { name: string; sku: string | null; start: string | null; end: string | null; location: string };
  total_teams_at_event: number | null;
  teams: { id: number; number: string; name: string | null }[];
  qualification_matches: { match_id: number; match_name: string; scheduled_at: string | null; red_teams: string[]; blue_teams: string[]; red_score: number | null; blue_score: number | null; status: string }[];
  qualification_leaderboard: { division_id: string; rank: number | null; team_number: string | null; wins: number | null; losses: number | null; ties: number | null }[];
  skills_leaderboard: { team_number: string; rank: number | null; driver: number | null; programming: number | null; combined: number | null }[];
  awards: { id: number; name: string; team_number: string | null }[];
}

export default function EventDashboard({ eventId, divisionId }: { eventId: number; divisionId?: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ event_id: String(eventId), tab });
    if (divisionId) params.set("division_id", divisionId);
    fetch(`/api/event-dashboard?${params}`, { signal: controller.signal }).then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Event data is unavailable");
      setData(json);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Event data is unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, divisionId, tab]);

  if (error) return <main className="mx-auto max-w-3xl p-8"><h1 className="text-xl font-semibold">Event unavailable</h1><p>{error}</p><Link href="/" className="text-red-600 underline">Back to VEXGOAT</Link></main>;
  return <div className="space-y-6 text-gray-900 dark:text-gray-100">
    <header className="border-b border-gray-200 dark:border-gray-700 pb-5">
      <Link href="/" className="text-sm text-red-600 underline">VEXGOAT</Link>
      <h1 className="mt-2 text-3xl font-bold">{data?.event.name ?? `Event ${eventId}`}</h1>
      {data && <p className="mt-2 text-sm text-gray-500">{data.event.location || "Location pending"} · {data.event.start ? new Date(data.event.start).toLocaleDateString() : "Date pending"} – {data.event.end ? new Date(data.event.end).toLocaleDateString() : "Date pending"} · {data.total_teams_at_event ?? "—"} teams</p>}
      {data?.event.sku && <a className="mt-2 inline-block text-sm text-red-600 underline" href={`https://events.vex.com/robot-competitions/vex-robotics-competition/${encodeURIComponent(data.event.sku)}.html`} target="_blank" rel="noopener noreferrer">Official event page</a>}
    </header>
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700" aria-label="Event sections">{tabs.map((item) => <button key={item.id} onClick={() => { setTab(item.id); setLoading(true); setError(""); }} className={`whitespace-nowrap px-3 py-3 text-sm ${tab === item.id ? "border-b-2 border-red-600 font-semibold text-red-600" : "text-gray-500"}`}>{item.label}</button>)}</nav>
    {loading && <p role="status" className="text-sm text-gray-500">Loading {tab}…</p>}
    {!loading && data && tab === "overview" && <section><h2 className="text-xl font-semibold mb-3">Participating teams</h2>{data.teams.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{data.teams.map((team) => <div key={team.id} className="border-b border-gray-200 py-2"><Link href={`/?team=${encodeURIComponent(team.number)}`} className="font-semibold text-red-600 underline">{team.number}</Link><span className="ml-2 text-sm text-gray-500">{team.name}</span></div>)}</div> : <p className="text-sm text-gray-500">No teams are published yet.</p>}</section>}
    {!loading && data && tab === "matches" && <section><h2 className="text-xl font-semibold mb-3">Schedule and results</h2>{data.qualification_matches.length ? <div className="divide-y divide-gray-200">{data.qualification_matches.map((match) => <div key={match.match_id} className="grid grid-cols-[minmax(6rem,1fr)_2fr_auto] gap-3 py-3 text-sm"><div><strong>{match.match_name}</strong><p className="text-gray-500">{match.scheduled_at ? new Date(match.scheduled_at).toLocaleString() : "Time pending"}</p>{match.status === "results pending" && <p className="text-amber-700">Results pending</p>}{match.status === "provisional" && <p className="text-amber-700">Score published; final status unconfirmed</p>}</div><div><p>Red: {match.red_teams.join(", ") || "TBD"}</p><p>Blue: {match.blue_teams.join(", ") || "TBD"}</p></div><div className="text-right tabular-nums"><p>{match.red_score ?? "—"}</p><p>{match.blue_score ?? "—"}</p></div></div>)}</div> : <p className="text-sm text-gray-500">No matches are published yet.</p>}</section>}
    {!loading && data && tab === "rankings" && <section><h2 className="text-xl font-semibold mb-3">Official qualification rankings</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Rank</th><th className="p-2">Team</th><th className="p-2">W</th><th className="p-2">L</th><th className="p-2">T</th></tr></thead><tbody>{data.qualification_leaderboard.map((row, index) => <tr key={`${row.division_id}-${index}`} className="border-b"><td className="p-2">{row.rank ?? "—"}</td><td className="p-2">{row.team_number ?? "—"}</td><td className="p-2">{row.wins ?? "—"}</td><td className="p-2">{row.losses ?? "—"}</td><td className="p-2">{row.ties ?? "—"}</td></tr>)}</tbody></table></div>{!data.qualification_leaderboard.length && <p className="text-sm text-gray-500">Rankings are not published yet.</p>}</section>}
    {!loading && data && tab === "skills" && <section><h2 className="text-xl font-semibold mb-1">Event skills</h2><p className="mb-3 text-xs text-gray-500">Best published runs by team; combined ranks are calculated and do not include official tiebreakers.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Rank</th><th className="p-2">Team</th><th className="p-2">Driver</th><th className="p-2">Programming</th><th className="p-2">Combined</th></tr></thead><tbody>{data.skills_leaderboard.map((row) => <tr key={row.team_number} className="border-b"><td className="p-2">{row.rank ?? "—"}</td><td className="p-2">{row.team_number}</td><td className="p-2">{row.driver ?? "—"}</td><td className="p-2">{row.programming ?? "—"}</td><td className="p-2">{row.combined ?? "—"}</td></tr>)}</tbody></table></div>{!data.skills_leaderboard.length && <p className="text-sm text-gray-500">No skills scores are published yet.</p>}</section>}
    {!loading && data && tab === "awards" && <section><h2 className="text-xl font-semibold mb-3">Awards</h2>{data.awards.length ? <ul className="divide-y divide-gray-200">{data.awards.map((award) => <li key={award.id} className="py-2 text-sm">{award.name}{award.team_number ? ` · ${award.team_number}` : ""}</li>)}</ul> : <p className="text-sm text-gray-500">Awards are not published yet.</p>}</section>}
    {!loading && data && tab === "scout" && <AllianceBuilder eventId={eventId} />}
  </div>;
}
