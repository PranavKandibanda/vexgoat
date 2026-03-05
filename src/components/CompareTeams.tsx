"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface TeamData {
  team: {
    number: string;
    team_name: string;
    organization: string;
    location: { city: string; region: string; country: string };
    grade: string;
  };
  skills: { driver: number; programming: number; total: number; worldRank: number | null };
  awards: { name: string; category: string }[];
  strength: { rsi: number; tier: string; tierEmoji: string; skillsComponent: number; awardsComponent: number; consistencyComponent: number };
}

export default function CompareTeams() {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<[TeamData, TeamData] | null>(null);

  async function handleCompare() {
    const a = teamA.trim();
    const b = teamB.trim();
    if (!a || !b) {
      setError("Please enter both team numbers.");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(a) || !/^[a-zA-Z0-9]+$/.test(b)) {
      setError("Team numbers must be alphanumeric.");
      return;
    }
    setError("");
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/compare?numbers=${encodeURIComponent(a)},${encodeURIComponent(b)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to fetch.");
        return;
      }
      setData(json.teams as [TeamData, TeamData]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Input */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Compare Teams
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Team A</label>
            <input
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
              placeholder="e.g. 1234A"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <span className="text-gray-400 font-bold text-lg hidden sm:block">vs</span>
          <div className="flex-1">
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Team B</label>
            <input
              value={teamB}
              onChange={(e) => setTeamB(e.target.value)}
              placeholder="e.g. 5678B"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleCompare}
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition whitespace-nowrap"
          >
            {loading ? "Loading…" : "Compare"}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {data && (
        <>
          {/* Side-by-side overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((d, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 border border-gray-200 dark:border-gray-700"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {d.team.number}
                </h3>
                <p className="text-sm text-gray-500">{d.team.team_name}</p>
                <p className="text-xs text-gray-400">{d.team.organization}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Driver" value={d.skills.driver} />
                  <Stat label="Programming" value={d.skills.programming} />
                  <Stat label="Total Skills" value={d.skills.total} />
                  <Stat label="Awards" value={d.awards.length} />
                  <Stat
                    label="RSI"
                    value={d.strength.rsi}
                    extra={`${d.strength.tierEmoji} ${d.strength.tier}`}
                  />
                  <Stat
                    label="Best Event Rank"
                    value={d.skills.worldRank ? `#${d.skills.worldRank}` : "N/A"}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Skills comparison bar chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Skills Comparison
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={[
                  {
                    name: "Driver",
                    [data[0].team.number]: data[0].skills.driver,
                    [data[1].team.number]: data[1].skills.driver,
                  },
                  {
                    name: "Programming",
                    [data[0].team.number]: data[0].skills.programming,
                    [data[1].team.number]: data[1].skills.programming,
                  },
                  {
                    name: "Total",
                    [data[0].team.number]: data[0].skills.total,
                    [data[1].team.number]: data[1].skills.total,
                  },
                ]}
              >
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey={data[0].team.number} fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey={data[1].team.number} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* RSI comparison radar */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Strength Radar
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart
                data={[
                  {
                    subject: "Skills",
                    A: data[0].strength.skillsComponent,
                    B: data[1].strength.skillsComponent,
                    fullMark: 50,
                  },
                  {
                    subject: "Awards",
                    A: data[0].strength.awardsComponent,
                    B: data[1].strength.awardsComponent,
                    fullMark: 30,
                  },
                  {
                    subject: "Consistency",
                    A: data[0].strength.consistencyComponent,
                    B: data[1].strength.consistencyComponent,
                    fullMark: 20,
                  },
                  {
                    subject: "RSI",
                    A: data[0].strength.rsi,
                    B: data[1].strength.rsi,
                    fullMark: 100,
                  },
                ]}
              >
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name={data[0].team.number} dataKey="A" stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} />
                <Radar name={data[1].team.number} dataKey="B" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  extra,
}: {
  label: string;
  value: string | number;
  extra?: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2">
      <span className="text-xs text-gray-400">{label}</span>
      <p className="font-bold text-gray-800 dark:text-gray-200">{value}</p>
      {extra && <span className="text-xs text-gray-400">{extra}</span>}
    </div>
  );
}
