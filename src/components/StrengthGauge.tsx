"use client";

import React from "react";
import type { StrengthResult } from "@/lib/strengthAlgorithm";

interface Props {
  strength: StrengthResult;
}

export default function StrengthGauge({ strength }: Props) {
  const { rsi, tier, tierEmoji, skillsComponent, awardsComponent, consistencyComponent } =
    strength;

  // Arc parameters
  const radius = 80;
  const stroke = 14;
  const circumference = Math.PI * radius; // half-circle
  const progress = (Math.min(rsi, 100) / 100) * circumference;

  const tierColor =
    rsi >= 85
      ? "text-orange-500"
      : rsi >= 70
      ? "text-blue-500"
      : rsi >= 50
      ? "text-green-500"
      : "text-gray-500";

  const strokeColor =
    rsi >= 85
      ? "#f97316"
      : rsi >= 70
      ? "#3b82f6"
      : rsi >= 50
      ? "#22c55e"
      : "#9ca3af";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Competitive Strength
      </h3>

      {/* Gauge */}
      <div className="flex flex-col items-center mb-6">
        <svg width="200" height="120" viewBox="0 0 200 120">
          {/* Background arc */}
          <path
            d="M 10 110 A 80 80 0 0 1 190 110"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="dark:stroke-gray-700"
          />
          {/* Progress arc */}
          <path
            d="M 10 110 A 80 80 0 0 1 190 110"
            fill="none"
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            style={{ transition: "stroke-dasharray 1s ease-out" }}
          />
        </svg>
        <div className="text-center -mt-16">
          <p className={`text-4xl font-extrabold ${tierColor}`}>{rsi}</p>
          <p className={`text-sm font-semibold ${tierColor}`}>
            {tierEmoji} {tier}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-3">
        <BarLine label="Skills (50)" value={skillsComponent} max={50} color="bg-red-500" />
        <BarLine label="Awards (30)" value={awardsComponent} max={30} color="bg-blue-500" />
        <BarLine
          label="Consistency (20)"
          value={consistencyComponent}
          max={20}
          color="bg-green-500"
        />
      </div>
    </div>
  );
}

function BarLine({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
          {value}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
