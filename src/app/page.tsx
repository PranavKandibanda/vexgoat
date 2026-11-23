"use client";

import React, { useEffect, useState } from "react";
import TeamCard from "@/components/TeamCard";
import SkillsChart from "@/components/SkillsChart";
import AwardsTimeline from "@/components/AwardsTimeline";
import StrengthGauge from "@/components/StrengthGauge";
import PushBackCalculator from "@/components/PushBackCalculator";
import OverrideCalculator from "@/components/OverrideCalculator";
import CompareTeams from "@/components/CompareTeams";
import EventInsights from "@/components/EventInsights";
import type { TeamInfo, SkillsSummary, Award, TeamEventRanking } from "@/lib/robotEvents";
import type { StrengthResult } from "@/lib/strengthAlgorithm";

type Tab = "analytics" | "scoring" | "compare" | "event";

interface TeamApiResponse {
  team: TeamInfo;
  skills: SkillsSummary;
  awards: Award[];
  strength: StrengthResult | null;
  record: { matchesPlayed: number; wins: number; losses: number; ties: number; unresolved: number; averageScore: number | null; highScore: number | null; events: number };
  qualification: { matchesPlayed: number | null; wins: number | null; losses: number | null; ties: number | null; averageScore: number | null; highScore: number | null; events: number };
  rankings: TeamEventRanking[];
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("analytics");
  const [teamNumber, setTeamNumber] = useState("");
  const [season, setSeason] = useState(204);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<TeamApiResponse | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedSeason = params.get("season") === "197" ? 197 : 204;
    setSeason(selectedSeason);
    const number = params.get("team");
    if (number) {
      setTeamNumber(number);
      void handleSearch(number, selectedSeason);
    }
    // Shareable team links are loaded once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(value = teamNumber, selectedSeason = season) {
    const num = value.trim();
    if (!num) {
      setError("Please enter a team number.");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(num)) {
      setError("Team number must be alphanumeric.");
      return;
    }
    setError("");
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/team?number=${encodeURIComponent(num)}&season=${selectedSeason}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "An error occurred.");
        return;
      }
      setData(json);
      window.history.replaceState(null, "", `/?team=${encodeURIComponent(num)}&season=${selectedSeason}`);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "analytics", label: "Team Analytics" },
    { key: "scoring", label: "Skills Calculator" },
    { key: "compare", label: "Compare Teams" },
    { key: "event", label: "Event Search" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-lg shadow">
              V
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                VEXGOAT
              </h1>
              <p className="text-xs text-gray-400">
                Override · 2026–27 V5RC
              </p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Main navigation">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === t.key
                    ? "bg-gray-50 dark:bg-gray-950 text-red-600 dark:text-red-400 border-b-2 border-red-500"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
            <a href="https://events.vex.com/robot-competitions/vex-robotics-competition/standings/skills" target="_blank" rel="noopener noreferrer" className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-red-600">World Skills ↗</a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <label className="mb-6 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">Season
          <select value={season} onChange={(event) => { const next = Number(event.target.value); setSeason(next); setData(null); window.history.replaceState(null, "", `/?season=${next}`); }} className="rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <option value={204}>2026–27 Override</option><option value={197}>2025–26 Push Back</option>
          </select>
        </label>
        {/* ============ TAB 1: ANALYTICS ============ */}
        {tab === "analytics" && (
          <div className="space-y-6">
            {/* Search bar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Search Team
              </h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={teamNumber}
                  onChange={(e) => setTeamNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
                  placeholder="Enter Team Number (e.g. 1234A)"
                  className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={() => void handleSearch()}
                  disabled={loading}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Searching…
                    </span>
                  ) : (
                    "Search"
                  )}
                </button>
              </div>
              {error && (
                <div className="mt-3 px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Loading spinner */}
            {loading && (
              <div className="flex justify-center py-16">
                <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Results */}
            {data && !loading && (
              <div className="space-y-6">
                {/* Row 1: Team info + Strength */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <TeamCard team={data.team} />
                  </div>
                  {data.strength ? <StrengthGauge strength={data.strength} /> : <div className="p-5 text-sm text-gray-600 dark:text-gray-300"><h3 className="font-semibold">Qualification record</h3>{data.qualification.matchesPlayed !== null ? <><p>{data.qualification.wins} W · {data.qualification.losses} L · {data.qualification.ties} T across {data.qualification.events} event rankings</p><p>Average alliance score: {data.qualification.averageScore ?? "—"} · High: {data.qualification.highScore ?? "—"}</p></> : <p>No qualification rankings published for this team in the selected season.</p>}<p className="mt-2 text-xs">Official event rankings; season summary calculated by VEXGOAT. Elimination results are separate.</p></div>}
                </div>

                {data.rankings.length > 0 && <section className="bg-white p-5 dark:bg-gray-800"><h3 className="mb-3 font-semibold">Event rankings</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Event</th><th className="p-2">Division</th><th className="p-2">Rank</th><th className="p-2">W–L–T</th></tr></thead><tbody>{data.rankings.map((row, index) => <tr className="border-b" key={`${row.eventId}-${row.division}-${index}`}><td className="p-2">{row.eventId ? <a className="text-red-600 underline" href={`/events/${row.eventId}`}>{row.event}</a> : row.event}</td><td className="p-2">{row.division}</td><td className="p-2">{row.rank ?? "—"}</td><td className="p-2">{row.wins ?? "—"}–{row.losses ?? "—"}–{row.ties ?? "—"}</td></tr>)}</tbody></table></div></section>}

                {/* Row 2: Skills chart */}
                <SkillsChart skills={data.skills} />
                {season === 204 && <a className="text-sm text-red-600 underline" href="https://events.vex.com/robot-competitions/vex-robotics-competition/standings/skills" target="_blank" rel="noopener noreferrer">Official worldwide skills standings and country, region, and grade filters</a>}

                {/* Row 3: Awards */}
                <AwardsTimeline awards={data.awards} />
              </div>
            )}

            {/* Empty state */}
            {!data && !loading && !error && (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Search for a VEX Team
                </h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  Enter a team number above to view their skills scores, awards,
                  and competitive strength analysis.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============ TAB 2: SCORING ============ */}
        {tab === "scoring" && (season === 204 ? <OverrideCalculator /> : <PushBackCalculator />)}

        {/* ============ TAB 3: COMPARE ============ */}
        {tab === "compare" && <CompareTeams season={season} />}

        {/* ============ TAB 4: EVENT SEARCH ============ */}
        {tab === "event" && <EventInsights season={season} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 mt-12">
        <p className="text-center text-xs text-gray-400">
          VEX Team Analytics &middot; Data from{" "}
          <a
            href="https://events.vex.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            VEX Events
          </a>{" "}
          &middot; Independent team analytics
        </p>
      </footer>
    </div>
  );
}
