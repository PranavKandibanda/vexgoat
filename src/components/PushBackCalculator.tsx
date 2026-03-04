"use client";

import React, { useState } from "react";
import {
  calculatePushBackScore,
  PUSH_BACK_SCORING,
  type PushBackInput,
  type PushBackResult,
} from "@/lib/scoring";

export default function PushBackCalculator() {
  const [input, setInput] = useState<PushBackInput>({
    blocksInGoal: 0,
    controlZonesLongGoal: 0,
    controlZonesCenterGoal: 0,
    clearedParkZones: 0,
    clearedLoaders: 0,
    parkedRobot: false,
  });

  const result: PushBackResult = calculatePushBackScore(input);

  function setField<K extends keyof PushBackInput>(key: K, value: PushBackInput[K]) {
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Push Back Skills Calculator
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Calculate your VEX V5 Push Back skills score based on official scoring rules.
        </p>
      </div>

      {/* Input section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Scoring Inputs
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="Blocks Scored in a Goal"
            value={input.blocksInGoal}
            onChange={(v) => setField("blocksInGoal", v)}
            points={PUSH_BACK_SCORING.block_in_goal}
          />
          <NumberInput
            label="Filled Control Zones (Long Goal)"
            value={input.controlZonesLongGoal}
            onChange={(v) => setField("controlZonesLongGoal", v)}
            points={PUSH_BACK_SCORING.control_zone_long_goal}
          />
          <NumberInput
            label="Filled Control Zones (Center Goal)"
            value={input.controlZonesCenterGoal}
            onChange={(v) => setField("controlZonesCenterGoal", v)}
            points={PUSH_BACK_SCORING.control_zone_center_goal}
          />
          <NumberInput
            label="Cleared Park Zones"
            value={input.clearedParkZones}
            onChange={(v) => setField("clearedParkZones", v)}
            points={PUSH_BACK_SCORING.cleared_park_zone}
          />
          <NumberInput
            label="Cleared Loaders"
            value={input.clearedLoaders}
            onChange={(v) => setField("clearedLoaders", v)}
            points={PUSH_BACK_SCORING.cleared_loader}
          />

          {/* Parked Robot */}
          <div className="flex items-center gap-3 sm:col-span-2 mt-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={input.parkedRobot}
                onChange={(e) => setField("parkedRobot", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-300 peer-focus:ring-2 peer-focus:ring-red-400 rounded-full peer dark:bg-gray-600 peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
            </label>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Parked Robot ({PUSH_BACK_SCORING.parked_robot} pts)
            </span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Score Breakdown
        </h3>

        <div className="space-y-2 mb-6">
          <BreakdownRow label="Blocks in Goals" value={result.blocksScore} />
          <BreakdownRow label="Control Zones (Long Goal)" value={result.longGoalZoneScore} />
          <BreakdownRow label="Control Zones (Center Goal)" value={result.centerGoalZoneScore} />
          <BreakdownRow label="Cleared Park Zones" value={result.parkZoneScore} />
          <BreakdownRow label="Cleared Loaders" value={result.loaderScore} />
          <BreakdownRow label="Parked Robot" value={result.parkedScore} />
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex justify-between items-end">
            <span className="text-gray-600 dark:text-gray-400 font-medium">
              Total Score
            </span>
            <span className="text-4xl font-extrabold text-red-500">
              {result.totalScore}
            </span>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>Max Possible: {result.maxPossible}</span>
            <span>{result.percentOfMax}% of theoretical max</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(result.percentOfMax, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scoring reference */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
          Scoring Reference
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {[
            { label: "Block in Goal", value: `${PUSH_BACK_SCORING.block_in_goal} pt` },
            { label: "Control Zone (Long Goal)", value: `${PUSH_BACK_SCORING.control_zone_long_goal} pts` },
            { label: "Control Zone (Center Goal)", value: `${PUSH_BACK_SCORING.control_zone_center_goal} pts` },
            { label: "Cleared Park Zone", value: `${PUSH_BACK_SCORING.cleared_park_zone} pts` },
            { label: "Cleared Loader", value: `${PUSH_BACK_SCORING.cleared_loader} pts` },
            { label: "Parked Robot", value: `${PUSH_BACK_SCORING.parked_robot} pts` },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2"
            >
              <span className="text-gray-400 text-xs">{label}</span>
              <p className="font-bold text-gray-800 dark:text-gray-200">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function NumberInput({
  label,
  value,
  onChange,
  points,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  points: number;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
        {label}{" "}
        <span className="text-xs text-gray-400">({points} pts each)</span>
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-16 text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
        <button
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          +
        </button>
        <span className="text-xs text-gray-400 ml-1">
          = {value * points} pts
        </span>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
        {value}
      </span>
    </div>
  );
}
