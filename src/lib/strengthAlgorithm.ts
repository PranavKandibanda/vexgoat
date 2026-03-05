/**
 * Relative Strength Index (RSI) algorithm for VEX teams.
 */

import type { SkillsSummary, Award } from "./robotEvents";

export interface StrengthResult {
  rsi: number;
  tier: string;
  tierEmoji: string;
  skillsComponent: number;
  awardsComponent: number;
  consistencyComponent: number;
}

const MAX_SKILLS = 238; // theoretical max combined (119 driver + 119 programming)

function computeSkillsComponent(skills: SkillsSummary): number {
  // 50% weight, scaled 0-50
  if (!skills || skills.total === 0) return 0;
  const ratio = Math.min(skills.total / MAX_SKILLS, 1);
  return ratio * 50;
}

function computeAwardsComponent(awards: Award[]): number {
  // 30% weight, capped at 30
  let points = 0;
  for (const a of awards) {
    switch (a.category) {
      case "Excellence":
        points += 15;
        break;
      case "Tournament Champion":
        points += 10;
        break;
      case "Skills Champion":
        points += 8;
        break;
      case "Design/Judged":
        points += 5;
        break;
      default:
        points += 2;
        break;
    }
  }
  return Math.min(points, 30);
}

function computeConsistencyComponent(skills: SkillsSummary, awards: Award[]): number {
  // 20% weight, capped at 20
  // Based on number of events and repeated scoring
  const uniqueEvents = new Set<string>();
  for (const r of skills.records) {
    if (r.event) uniqueEvents.add(r.event);
  }
  for (const a of awards) {
    if (a.event) uniqueEvents.add(a.event);
  }

  const eventCount = uniqueEvents.size;

  // More events = more consistent
  const eventFactor = Math.min(eventCount / 10, 1) * 12;

  // High repeated scores (count records above 50% of best)
  const threshold = skills.total * 0.5;
  let goodPerformances = 0;
  // Group by event and check driver+prog totals
  const eventBests = new Map<string, number>();
  for (const r of skills.records) {
    const cur = eventBests.get(r.event) ?? 0;
    eventBests.set(r.event, cur + r.score);
  }
  for (const total of eventBests.values()) {
    if (total >= threshold) goodPerformances++;
  }
  const repeatFactor = eventCount > 0 ? Math.min(goodPerformances / eventCount, 1) * 8 : 0;

  return Math.min(eventFactor + repeatFactor, 20);
}

function getTier(rsi: number): { tier: string; emoji: string } {
  if (rsi >= 85) return { tier: "Elite", emoji: "🔥" };
  if (rsi >= 70) return { tier: "Highly Competitive", emoji: "💪" };
  if (rsi >= 50) return { tier: "Competitive", emoji: "📈" };
  return { tier: "Developing", emoji: "🌱" };
}

export function calculateStrength(skills: SkillsSummary, awards: Award[]): StrengthResult {
  const skillsComponent = computeSkillsComponent(skills);
  const awardsComponent = computeAwardsComponent(awards);
  const consistencyComponent = computeConsistencyComponent(skills, awards);
  const rsi = Math.round((skillsComponent + awardsComponent + consistencyComponent) * 10) / 10;
  const { tier, emoji } = getTier(rsi);
  return {
    rsi,
    tier,
    tierEmoji: emoji,
    skillsComponent: Math.round(skillsComponent * 10) / 10,
    awardsComponent: Math.round(awardsComponent * 10) / 10,
    consistencyComponent: Math.round(consistencyComponent * 10) / 10,
  };
}
