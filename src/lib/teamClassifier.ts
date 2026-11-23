/**
 * Team Role Classification System.
 *
 * Classifies teams into 6 strategic roles based on their performance profile:
 * 1. Offensive Carry - High overall scoring, dominant in match play
 * 2. Defensive Specialist - Low scoring but strong endgame, defensive role
 * 3. Balanced - Well-rounded performer across all game phases
 * 4. Endgame Focused - Specializes in endgame climbs
 * 5. Autonomous Heavy - Strong autonomous period, weak driver control
 * 6. Inconsistent - Highly variable performance, unpredictable
 */

import type { TeamRating } from "@/lib/eloRating";

export type TeamRole =
  | "Offensive Carry"
  | "Defensive Specialist"
  | "Balanced"
  | "Endgame Focused"
  | "Autonomous Heavy"
  | "Inconsistent";

export interface TeamClassification {
  role: TeamRole;
  role_emoji: string;
  role_description: string;
  confidence: number; // 0-1, higher = more confident in classification
  component_strengths: {
    autonomous: "strong" | "weak" | "average";
    driver: "strong" | "weak" | "average";
    endgame: "strong" | "weak" | "average";
  };
  key_metrics: {
    overall_rating: number;
    win_rate: number; // 0-1
    consistency_index: number; // 0-100, lower = more consistent
  };
}

const BASE_RATING = 1500;
const RATING_RANGE = 700; // scale -700 to +700 from base

/**
 * Classify a team based on their rating profile and win history.
 */
export function classifyTeam(teamRating: TeamRating): TeamClassification {
  const overallRating = teamRating.elo_rating;
  const autonRating = teamRating.auton_rating;
  const driverRating = teamRating.driver_rating;
  const endgameRating = teamRating.endgame_rating;
  const consistency = teamRating.consistency_index;
  const winRate = teamRating.matches_played > 0 ? teamRating.wins / teamRating.matches_played : 0;

  // Normalize ratings to -1 to +1 scale
  const norm = (rating: number): number => (rating - BASE_RATING) / RATING_RANGE;
  const n_auton = norm(autonRating);
  const n_driver = norm(driverRating);
  const n_endgame = norm(endgameRating);
  const n_overall = norm(overallRating);

  // Thresholds
  const STRONG = 0.15; // >15% above base
  const WEAK = -0.15; // >15% below base
  const CONSISTENT = 30; // consistency index < 30
  const INCONSISTENT = 60; // consistency index > 60

  // Component analysis
  const components: TeamClassification["component_strengths"] = {
    autonomous: n_auton > STRONG ? "strong" : n_auton < WEAK ? "weak" : "average",
    driver: n_driver > STRONG ? "strong" : n_driver < WEAK ? "weak" : "average",
    endgame: n_endgame > STRONG ? "strong" : n_endgame < WEAK ? "weak" : "average",
  };

  let role: TeamRole;
  let confidence = 0.7; // base confidence
  let description = "";
  let emoji = "";

  // Classification logic
  if (consistency > INCONSISTENT) {
    // Highly inconsistent teams
    role = "Inconsistent";
    emoji = "🎲";
    description = "Unpredictable performance; high variance in match results";
    confidence = 0.9;
  } else if (components.driver === "strong" && n_overall > STRONG && winRate > 0.6) {
    // Strong overall with excellent driver control
    role = "Offensive Carry";
    emoji = "🔥";
    description = "High-scoring team that dominates match play";
    confidence = 0.85;
  } else if (
    components.endgame === "strong" &&
    (components.autonomous === "weak" || components.driver === "weak")
  ) {
    // Specialist in endgame (climbing)
    if (n_overall < -STRONG) {
      // Purely defensive
      role = "Defensive Specialist";
      emoji = "🛡️";
      description = "Low-scoring team focusing on defensive strategy and endgame reliability";
      confidence = 0.8;
    } else {
      // Still strong at endgame
      role = "Endgame Focused";
      emoji = "🧗";
      description = "Team specializing in endgame climbs and mid-match positioning";
      confidence = 0.75;
    }
  } else if (components.autonomous === "strong" && components.driver === "weak") {
    // Strong auton but weak driver
    role = "Autonomous Heavy";
    emoji = "🤖";
    description =
      "Reliable autonomous routine; struggles with driver control in operator period";
    confidence = 0.8;
  } else if (
    Math.abs(n_auton - n_driver) < 0.1 &&
    Math.abs(n_driver - n_endgame) < 0.1 &&
    consistency < CONSISTENT
  ) {
    // All components balanced and consistent
    role = "Balanced";
    emoji = "⚖️";
    description = "Well-rounded performer with consistent capability across all game phases";
    confidence = 0.85;
  } else if (n_overall > STRONG && consistency < CONSISTENT) {
    // High-rated and consistent (could be offensive or balanced)
    role = "Offensive Carry";
    emoji = "🔥";
    description = "High-scoring team with consistent, reliable performance";
    confidence = 0.75;
  } else {
    // Default to balanced
    role = "Balanced";
    emoji = "⚖️";
    description = "Solid, well-rounded team with no standout specialization";
    confidence = 0.6;
  }

  return {
    role,
    role_emoji: emoji,
    role_description: description,
    confidence: Math.min(confidence, 0.95),
    component_strengths: components,
    key_metrics: {
      overall_rating: overallRating,
      win_rate: Math.round(winRate * 1000) / 1000,
      consistency_index: consistency,
    },
  };
}

/**
 * Identify team weaknesses based on rating profile.
 */
export function identifyWeaknesses(teamRating: TeamRating): string[] {
  const THRESHOLD = 100; // 100 rating points below overall average
  const winRate =
    teamRating.matches_played > 0 ? teamRating.wins / teamRating.matches_played : 0;

  const weaknesses: string[] = [];
  const avg = (teamRating.auton_rating + teamRating.driver_rating + teamRating.endgame_rating) / 3;

  if (teamRating.auton_rating < avg - THRESHOLD) {
    weaknesses.push("Weak autonomous period — struggles with pre-programmed routines");
  }

  if (teamRating.driver_rating < avg - THRESHOLD) {
    weaknesses.push("Weak driver control — loses points during operator-controlled phase");
  }

  if (teamRating.endgame_rating < avg - THRESHOLD) {
    weaknesses.push("Weak endgame execution — fails to reliably secure climbing points");
  }

  if (teamRating.consistency_index > 60) {
    weaknesses.push("High inconsistency — unpredictable match-to-match performance");
  }

  if (winRate < 0.3 && teamRating.matches_played > 5) {
    weaknesses.push("Poor win rate — loses majority of competitive matches");
  }

  return weaknesses.slice(0, 3); // Return top 3 weaknesses
}

/**
 * Identify team strengths based on rating profile.
 */
export function identifyStrengths(teamRating: TeamRating): string[] {
  const THRESHOLD = 100;
  const winRate =
    teamRating.matches_played > 0 ? teamRating.wins / teamRating.matches_played : 0;

  const strengths: string[] = [];
  const avg = (teamRating.auton_rating + teamRating.driver_rating + teamRating.endgame_rating) / 3;

  if (teamRating.auton_rating > avg + THRESHOLD) {
    strengths.push("Strong autonomous period — consistent high-scoring pre-match routines");
  }

  if (teamRating.driver_rating > avg + THRESHOLD) {
    strengths.push("Strong driver control — dominates operator-controlled scoring");
  }

  if (teamRating.endgame_rating > avg + THRESHOLD) {
    strengths.push("Strong endgame execution — reliable climbing and endgame scoring");
  }

  if (teamRating.consistency_index < 30) {
    strengths.push("Highly consistent — reliable performance across all matches");
  }

  if (winRate > 0.7 && teamRating.matches_played > 5) {
    strengths.push("Excellent win rate — consistently defeats opponents in competitive play");
  }

  return strengths.slice(0, 3); // Return top 3 strengths
}

/**
 * Find the best partner types for a team based on their weaknesses.
 */
export function recommendPartnerRoles(teamRating: TeamRating, classification: TeamClassification): string[] {
  const partners: string[] = [];
  const weaknesses = identifyWeaknesses(teamRating);

  // If weak at autonomous, partner with autonomous-heavy team
  if (
    weaknesses.some((w) => w.includes("autonomous")) ||
    classification.component_strengths.autonomous === "weak"
  ) {
    partners.push("Autonomous Heavy");
  }

  // If weak at driver, partner with offensive carry
  if (
    weaknesses.some((w) => w.includes("driver")) ||
    classification.component_strengths.driver === "weak"
  ) {
    partners.push("Offensive Carry");
  }

  // If weak at endgame, partner with endgame-focused team
  if (
    weaknesses.some((w) => w.includes("endgame")) ||
    classification.component_strengths.endgame === "weak"
  ) {
    partners.push("Endgame Focused");
  }

  // If inconsistent, partner with balanced/consistent team
  if (weaknesses.some((w) => w.includes("inconsistency"))) {
    partners.push("Balanced");
  }

  // If no specific weakness, suggest balanced partner
  if (partners.length === 0) {
    partners.push("Balanced");
  }

  return [...new Set(partners)].slice(0, 2); // Return unique, top 2
}
