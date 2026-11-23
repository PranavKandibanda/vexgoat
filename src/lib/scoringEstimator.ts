/**
 * Scoring Estimator — estimates autonomous/driver/endgame breakdown from total score.
 *
 * Uses team's driver/programming skills scores as indicators of their capabilities:
 * - Programming skills (0-119) → Autonomous capability indicator
 * - Driver skills (0-119) → Driver period capability indicator
 *
 * Applies historical Push Back game mechanics averages:
 * - Autonomous contribution: ~30% of total
 * - Driver contribution: ~50% of total
 * - Endgame contribution: ~20% of total
 */

import type { SkillsSummary } from "./robotEvents";

export interface ScoringBreakdown {
  total_score: number;
  est_auton: number;
  est_driver: number;
  est_endgame: number;
  confidence: number; // 0-1, lower if team has very different performance profile
}

const PUSH_BACK_WEIGHTS = {
  auton: 0.3,
  driver: 0.5,
  endgame: 0.2,
};

/**
 * Estimate scoring breakdown from total score and team skills profile.
 * Uses team's skill scores to detect if they deviate from average distribution.
 */
export function estimateBreakdown(
  totalScore: number,
  teamSkills: SkillsSummary
): ScoringBreakdown {
  // Base estimation using historical averages
  let est_auton = totalScore * PUSH_BACK_WEIGHTS.auton;
  let est_driver = totalScore * PUSH_BACK_WEIGHTS.driver;
  let est_endgame = totalScore * PUSH_BACK_WEIGHTS.endgame;

  // Adjust based on team's skill profile
  // If team is strong at programming (autonomous coding), boost auton estimate
  // If team is strong at driver skills, boost driver estimate
  const max_skills = 119; // max driver or programming score in skills

  if ((teamSkills.total ?? 0) > 0) {
    const programmingRatio = (teamSkills.programming ?? 0) / max_skills;
    const driverRatio = (teamSkills.driver ?? 0) / max_skills;

    // Teams with high programming scores likely score well in autonomous
    // Teams with high driver scores likely score well in driver period
    if (programmingRatio > 0.6) {
      // Strong programming team — boost auton by up to 10%
      est_auton *= 1 + (programmingRatio - 0.6) * 0.167; // 0.167 ≈ 10% / 0.6
    }

    if (driverRatio > 0.6) {
      // Strong driver team — boost driver by up to 10%
      est_driver *= 1 + (driverRatio - 0.6) * 0.167;
    }

    // Weak teams might rely more on endgame (defensive strategy)
    if ((teamSkills.total ?? 0) < 100) {
      est_endgame *= 1.05; // slight boost for weak teams
    }
  }

  // Normalize to ensure total matches input
  const estimated_total = est_auton + est_driver + est_endgame;
  if (estimated_total > 0) {
    const scale = totalScore / estimated_total;
    est_auton *= scale;
    est_driver *= scale;
    est_endgame *= scale;
  }

  // Confidence: how confident are we in this breakdown?
  // Higher confidence if team has good skill data
  let confidence = 0.7; // baseline
  if ((teamSkills.total ?? 0) > 150) confidence += 0.2; // high skill teams are more predictable
  if (teamSkills.records.length > 5) confidence += 0.1; // more match data = more confidence

  return {
    total_score: totalScore,
    est_auton: Math.round(est_auton),
    est_driver: Math.round(est_driver),
    est_endgame: Math.round(est_endgame),
    confidence: Math.min(confidence, 1.0),
  };
}

/**
 * Validate that estimated breakdown is reasonable for Push Back.
 * Check against known benchmarks and game mechanics.
 */
export function validateEstimation(breakdown: ScoringBreakdown): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Each component should be 0-30% of total (with flexibility)
  if (breakdown.est_auton > breakdown.total_score * 0.45) {
    issues.push("Estimated autonomous too high (max ~30%)");
  }
  if (breakdown.est_driver > breakdown.total_score * 0.65) {
    issues.push("Estimated driver too high (max ~50%)");
  }
  if (breakdown.est_endgame > breakdown.total_score * 0.35) {
    issues.push("Estimated endgame too high (max ~20%)");
  }

  // Sum should equal total (within 5 points)
  const sum = breakdown.est_auton + breakdown.est_driver + breakdown.est_endgame;
  if (Math.abs(sum - breakdown.total_score) > 5) {
    issues.push(`Sum mismatch: ${sum} vs ${breakdown.total_score}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Estimate team's component-specific ratings based on historical data.
 * Returns normalized 0-2000 scale ratings for auton, driver, endgame.
 */
export function estimateComponentRatings(
  teamSkills: SkillsSummary,
  matchRecords: Array<{ score: number; date: string }>
): {
  auton_rating: number;
  driver_rating: number;
  endgame_rating: number;
} {
  let auton_rating = 1500; // base ELO
  let driver_rating = 1500;
  let endgame_rating = 1500;

  if (teamSkills.total === 0) {
    return { auton_rating, driver_rating, endgame_rating };
  }

  // Use skills scores as direct indicators
  // Max skills score (119 + 119 = 238) maps to ~1750 rating
  const skills_to_elo = (skillScore: number) => {
    const max_skills = 238;
    const rating_range = 250; // 1500 - 1750
    return 1500 + (skillScore / max_skills) * rating_range;
  };

  // Programming (autonomous coding) → auton rating
  auton_rating = skills_to_elo(teamSkills.programming ?? 0);

  // Driver skills → driver rating
  driver_rating = skills_to_elo(teamSkills.driver ?? 0);

  // Endgame rating based on consistency (teams that show up consistently likely have good climbs)
  if (matchRecords.length > 0) {
    const avgScore = matchRecords.reduce((sum, r) => sum + r.score, 0) / matchRecords.length;
    const variance =
      matchRecords.reduce((sum, r) => sum + Math.pow(r.score - avgScore, 2), 0) /
      matchRecords.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance (consistent teams) → higher endgame rating
    // Assumes consistent teams have reliable endgame strategies
    const consistency_bonus = Math.max(0, 100 - stdDev * 0.5); // up to 100 point boost
    endgame_rating = 1500 + consistency_bonus;
  }

  return {
    auton_rating: Math.min(Math.max(Math.round(auton_rating), 1000), 2000),
    driver_rating: Math.min(Math.max(Math.round(driver_rating), 1000), 2000),
    endgame_rating: Math.min(Math.max(Math.round(endgame_rating), 1000), 2000),
  };
}
