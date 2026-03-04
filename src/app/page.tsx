"use client";

import React, { useState } from "react";
import TeamCard from "@/components/TeamCard";
import SkillsChart from "@/components/SkillsChart";
import AwardsTimeline from "@/components/AwardsTimeline";
import StrengthGauge from "@/components/StrengthGauge";
import PushBackCalculator from "@/components/PushBackCalculator";
import CompareTeams from "@/components/CompareTeams";

type Tab = "analytics" | "scoring" | "compare";

interface TeamApiResponse {
  team: any;
  skills: any;
  awards: any;
  strength: any;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("analytics");
  const [teamNumber, setTeamNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<TeamApiResponse | null>(null);

  async function handleSearch() {
    const num = teamNumber.trim();
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
      const res = await fetch(`/api/team?number=${encodeURIComponent(num)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "An error occurred.");
        return;
      }
      setData(json);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "analytics", label: "Team Analytics", icon: "📊" },
    { key: "scoring", label: "Skills Calculator", icon: "🧮" },
    { key: "compare", label: "Compare Teams", icon: "⚔️" },
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
                VEX Team Analytics
              </h1>
              <p className="text-xs text-gray-400">
                Powered by RobotEvents API
              </p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex gap-1">
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
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
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
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Enter Team Number (e.g. 1234A)"
                  className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={handleSearch}
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
                  <StrengthGauge strength={data.strength} />
                </div>

                {/* Row 2: Skills chart */}
                <SkillsChart skills={data.skills} />

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
        {tab === "scoring" && <PushBackCalculator />}

        {/* ============ TAB 3: COMPARE ============ */}
        {tab === "compare" && <CompareTeams />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 mt-12">
        <p className="text-center text-xs text-gray-400">
          VEX Team Analytics &middot; Data from{" "}
          <a
            href="https://www.robotevents.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            RobotEvents
          </a>{" "}
          &middot; Not affiliated with VEX Robotics or the REC Foundation
        </p>
      </footer>
    </div>
  );
}
