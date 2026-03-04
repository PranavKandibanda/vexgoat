"use client";

import React from "react";
import type { TeamInfo } from "@/lib/robotEvents";

interface Props {
  team: TeamInfo;
}

export default function TeamCard({ team }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold text-xl shadow-md">
          {team.number.slice(0, 2)}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {team.number}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {team.program.code}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
        <InfoRow label="Team Name" value={team.team_name} />
        <InfoRow label="Organization" value={team.organization} />
        <InfoRow
          label="Location"
          value={[team.location.city, team.location.region, team.location.country]
            .filter(Boolean)
            .join(", ")}
        />
        <InfoRow label="Grade" value={team.grade} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider">
        {label}
      </span>
      <p className="text-gray-800 dark:text-gray-200 font-medium truncate">
        {value || "—"}
      </p>
    </div>
  );
}
