"use client";

import { useState } from "react";
import { calculateOverrideSkillsScore } from "@/lib/overrideScoring";

export default function OverrideCalculator() {
  const [colored, setColored] = useState(0);
  const [yellow, setYellow] = useState(0);
  const [midfield, setMidfield] = useState(false);
  return <section className="max-w-2xl bg-white dark:bg-gray-800 p-6 space-y-5">
    <div><h2 className="text-2xl font-bold">Override Skills Calculator</h2><p className="text-sm text-gray-500">Practice estimate using official RSC3 scoring. Count only eligible scored pin halves.</p></div>
    <label className="block text-sm">Scored red or blue pin halves (5 points)
      <input type="number" min="0" step="1" value={colored} onChange={(event) => setColored(Math.max(0, Math.floor(Number(event.target.value) || 0)))} className="mt-1 block w-full rounded border border-gray-300 bg-transparent p-2" />
    </label>
    <label className="block text-sm">Scored owned yellow pin halves (10 points)
      <input type="number" min="0" step="1" value={yellow} onChange={(event) => setYellow(Math.max(0, Math.floor(Number(event.target.value) || 0)))} className="mt-1 block w-full rounded border border-gray-300 bg-transparent p-2" />
    </label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={midfield} onChange={(event) => setMidfield(event.target.checked)} /> Robot ends in Midfield (8 points)</label>
    <p className="text-3xl font-bold tabular-nums">{calculateOverrideSkillsScore(colored, yellow, midfield)} points</p>
    <a href="https://manuals.vex.com/v5/override/v2.1/skills/" target="_blank" rel="noopener noreferrer" className="text-sm text-red-600 underline">Read the official scoring rules</a>
  </section>;
}
