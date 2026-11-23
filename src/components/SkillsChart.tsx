"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import type { SkillsSummary } from "@/lib/robotEvents";

interface Props {
  skills: SkillsSummary;
}

const COLORS = ["#ef4444", "#3b82f6", "#8b5cf6"];

export default function SkillsChart({ skills }: Props) {
  const barData = [
    { name: "Driver", score: skills.driver },
    { name: "Programming", score: skills.programming },
    { name: "Combined", score: skills.total },
  ];
  const radarData = barData.map(({ name, score }) => ({ subject: name, score }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Skills Breakdown
      </h3>
      {skills.records.length === 0 && <p className="mb-4 text-sm text-gray-500">No published skills runs for this season.</p>}
      <div className="mb-5 border-l-4 border-purple-500 bg-purple-50 px-4 py-3 dark:bg-purple-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">Best same-event combined score</p>
        <p className="text-4xl font-bold tabular-nums text-gray-900 dark:text-white">{skills.total ?? "—"}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">{skills.total === null ? "A combined score needs published Driver and Programming runs at the same event." : `${skills.driver} Driver + ${skills.programming} Programming`}</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">
                Category
              </th>
              <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-700/50">
              <td className="py-2 text-gray-800 dark:text-gray-200">Driver</td>
              <td className="py-2 text-right font-mono font-bold text-red-500">
                {skills.driver ?? "—"}
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700/50">
              <td className="py-2 text-gray-800 dark:text-gray-200">
                Programming
              </td>
              <td className="py-2 text-right font-mono font-bold text-blue-500">
                {skills.programming ?? "—"}
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700/50">
              <td className="py-2 text-gray-800 dark:text-gray-200 font-bold">
                Total
              </td>
              <td className="py-2 text-right font-mono font-bold text-purple-500">
                {skills.total ?? "—"}
              </td>
            </tr>
            <tr>
              <td className="py-2 text-gray-800 dark:text-gray-200">
                World Rank
              </td>
              <td className="py-2 text-right font-mono font-bold text-amber-500">
                {skills.worldRank ? `#${skills.worldRank}` : "N/A"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Charts */}
      {skills.records.length > 0 && <div className="grid gap-6 md:grid-cols-2">
        {/* Bar chart */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            Score Comparison
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                {barData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {skills.total !== null && <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">Score profile</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#9ca3af" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={false} axisLine={false} domain={[0, Math.max(skills.total, 1)]} />
              <Tooltip />
              <Radar dataKey="score" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>}

      </div>}
    </div>
  );
}
