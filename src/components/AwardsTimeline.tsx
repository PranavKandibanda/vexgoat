"use client";

import React from "react";
import type { Award } from "@/lib/robotEvents";

interface Props {
  awards: Award[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Excellence: "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20",
  "Tournament Champion": "border-blue-400 bg-blue-50 dark:bg-blue-900/20",
  "Skills Champion": "border-purple-400 bg-purple-50 dark:bg-purple-900/20",
  "Design/Judged": "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
  Other: "border-gray-300 bg-gray-50 dark:bg-gray-800",
};

const DOT_COLORS: Record<string, string> = {
  Excellence: "bg-yellow-400",
  "Tournament Champion": "bg-blue-400",
  "Skills Champion": "bg-purple-400",
  "Design/Judged": "bg-emerald-400",
  Other: "bg-gray-400",
};

export default function AwardsTimeline({ awards }: Props) {
  const sorted = [...awards].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Awards Timeline
        </h3>
        <p className="text-gray-400 text-sm">No awards recorded.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
        Awards Timeline
      </h3>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {Object.entries(DOT_COLORS).map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {cat}
          </span>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative pl-6">
        <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
        {sorted.map((award, i) => (
          <div key={i} className="relative mb-4 last:mb-0">
            <div
              className={`absolute -left-4 top-1.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-gray-800 ${
                DOT_COLORS[award.category] ?? DOT_COLORS.Other
              }`}
            />
            <div
              className={`ml-2 rounded-lg border-l-4 p-3 ${
                CATEGORY_COLORS[award.category] ?? CATEGORY_COLORS.Other
              }`}
            >
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {award.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {award.event}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400">
                  {award.date
                    ? new Date(award.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </span>
                {award.season && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {award.season}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
