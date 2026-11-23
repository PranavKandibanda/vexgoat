/**
 * Alliance Synergy Calculator.
 *
 * Calculates synergy score (0-100) for potential alliances based on:
 * - Role complementarity (offensive + defense works better than 2 offensives)
 * - Autonomous coverage (ensure at least 1 strong auton team)
 * - Variance reduction (mixing high and low variance teams reduces overall risk)
 * - Weakness penalties (two weak auton teams = bad pairing)
 */

import type { TeamRating } from "@/lib/eloRating";
import {
  classifyTeam,
  identifyWeaknesses,
} from "./teamClassifier";
import { calculateTeamSynergy } from "./teamProfiles";

export interface AllianceSynergy {
  synergy_score: number; // 0-100
  role_complement_bonus: number; // +20 max
  auton_coverage_bonus: number; // +15 max
  consistency_bonus: number; // +15 max
  variance_reduction_bonus: number; // +10 max
  weakness_penalty: number; // -20 max
  detailed_analysis: string;
  team_roles: string[];
  potential_issues: string[];
}

const MAX_SCORE = 100;

/**
 * Calculate synergy for a 2-3 team alliance.
 */
export function calculateAllianceSynergy(teams: TeamRating[]): AllianceSynergy {
  if (teams.length < 2 || teams.length > 3) {
    return {
      synergy_score: 0,
      role_complement_bonus: 0,
      auton_coverage_bonus: 0,
      consistency_bonus: 0,
      variance_reduction_bonus: 0,
      weakness_penalty: 0,
      detailed_analysis: "Invalid team count",
      team_roles: [],
      potential_issues: ["Must provide 2-3 teams"],
    };
  }

  let score = 50; // baseline
  let roleComplementBonus = 0;
  let autonCoverageBonus = 0;
  let consistencyBonus = 0;
  let varianceReductionBonus = 0;
  let weaknessPenalty = 0;
  const potentialIssues: string[] = [];
  const teamRoles = teams.map((t) => classifyTeam(t).role);

  // ===== Role Complementarity Bonus =====
  // 2-team alliances
  if (teams.length === 2) {
    const synergy = calculateTeamSynergy(teams[0], teams[1]);
    if (synergy > 55) {
      roleComplementBonus = 20;
    } else if (synergy > 45) {
      roleComplementBonus = 10;
    } else if (synergy < 35) {
      roleComplementBonus = -5;
    }
  }
  // 3-team alliances
  else if (teams.length === 3) {
    const synergy01 = calculateTeamSynergy(teams[0], teams[1]);
    const synergy12 = calculateTeamSynergy(teams[1], teams[2]);
    const synergy02 = calculateTeamSynergy(teams[0], teams[2]);
    const avgSynergy = (synergy01 + synergy12 + synergy02) / 3;

    if (avgSynergy > 60) {
      roleComplementBonus = 20;
    } else if (avgSynergy > 50) {
      roleComplementBonus = 15;
    } else if (avgSynergy > 40) {
      roleComplementBonus = 5;
    } else {
      roleComplementBonus = -10;
      potentialIssues.push("Teams have poor role complementarity");
    }
  }

  // ===== Autonomous Coverage Bonus =====
  const autonRatings = teams.map((t) => t.auton_rating);
  const maxAutonRating = Math.max(...autonRatings);

  if (maxAutonRating > 1650) {
    // At least one strong auton team
    autonCoverageBonus = 15;
  } else if (maxAutonRating > 1550) {
    autonCoverageBonus = 8;
  } else if (maxAutonRating < 1350) {
    potentialIssues.push("Weak autonomous period across alliance");
    autonCoverageBonus = -5;
  }

  // ===== Consistency Bonus =====
  const consistencies = teams.map((t) => t.consistency_index);
  const avgConsistency = consistencies.reduce((a, b) => a + b, 0) / consistencies.length;

  if (avgConsistency < 25) {
    // Very consistent alliance
    consistencyBonus = 15;
  } else if (avgConsistency < 40) {
    consistencyBonus = 8;
  } else if (avgConsistency > 65) {
    potentialIssues.push("High inconsistency — matches may be unpredictable");
    consistencyBonus = -10;
  }

  // ===== Variance Reduction Bonus =====
  // Mixing high and low variance teams reduces overall alliance variance
  if (teams.length === 2) {
    const consistencyDiff = Math.abs(consistencies[0] - consistencies[1]);
    if (consistencyDiff > 40) {
      varianceReductionBonus = 10; // good mixing
    } else if (consistencyDiff > 20) {
      varianceReductionBonus = 5;
    }
  } else if (teams.length === 3) {
    const minConsistency = Math.min(...consistencies);
    const maxConsistency = Math.max(...consistencies);
    const range = maxConsistency - minConsistency;

    if (range > 50) {
      varianceReductionBonus = 10; // good mix
    } else if (range > 30) {
      varianceReductionBonus = 5;
    }
  }

  // ===== Weakness Penalties =====
  const allWeaknesses = teams.flatMap((t) => identifyWeaknesses(t));

  // Check for duplicate weaknesses
  const weaknessTypes = {
    autonomous: allWeaknesses.filter((w) => w.includes("autonomous")).length,
    driver: allWeaknesses.filter((w) => w.includes("driver")).length,
    endgame: allWeaknesses.filter((w) => w.includes("endgame")).length,
    consistency: allWeaknesses.filter((w) => w.includes("inconsistency")).length,
  };

  if (weaknessTypes.autonomous >= 2) {
    weaknessPenalty -= 15;
    potentialIssues.push("Multiple teams weak at autonomous period");
  }

  if (weaknessTypes.driver >= 2) {
    weaknessPenalty -= 15;
    potentialIssues.push("Multiple teams weak at driver control");
  }

  if (weaknessTypes.endgame >= 2) {
    weaknessPenalty -= 10;
    potentialIssues.push("Multiple teams weak at endgame");
  }

  if (weaknessTypes.consistency >= 2) {
    weaknessPenalty -= 10;
    potentialIssues.push("Multiple teams with inconsistent performance");
  }

  // ===== Calculate Final Score =====
  score +=
    roleComplementBonus +
    autonCoverageBonus +
    consistencyBonus +
    varianceReductionBonus +
    weaknessPenalty;

  score = Math.min(MAX_SCORE, Math.max(0, score)); // Clamp to 0-100

  // Generate detailed analysis
  const analysis = generateSynergyAnalysis(teams, score, {
    roleComplementBonus,
    autonCoverageBonus,
    consistencyBonus,
    varianceReductionBonus,
    weaknessPenalty,
  });

  return {
    synergy_score: score,
    role_complement_bonus: roleComplementBonus,
    auton_coverage_bonus: autonCoverageBonus,
    consistency_bonus: consistencyBonus,
    variance_reduction_bonus: varianceReductionBonus,
    weakness_penalty: weaknessPenalty,
    detailed_analysis: analysis,
    team_roles: teamRoles,
    potential_issues: potentialIssues,
  };
}

/**
 * Generate a human-readable analysis of the alliance synergy.
 */
function generateSynergyAnalysis(
  teams: TeamRating[],
  score: number,
  bonuses: {
    roleComplementBonus: number;
    autonCoverageBonus: number;
    consistencyBonus: number;
    varianceReductionBonus: number;
    weaknessPenalty: number;
  }
): string {
  let analysis = "";

  if (score >= 80) {
    analysis = "Excellent synergy! This alliance has strong complementary roles and should perform well together.";
  } else if (score >= 60) {
    analysis = "Good synergy. This alliance pairs well but may have minor weaknesses to address.";
  } else if (score >= 40) {
    analysis = "Moderate synergy. This alliance works but has some alignment issues.";
  } else {
    analysis = "Poor synergy. This alliance has significant compatibility issues.";
  }

  analysis += "\n\nBreakdown:\n";

  if (bonuses.roleComplementBonus > 0) {
    analysis += `✓ Strong role complementarity (+${bonuses.roleComplementBonus})\n`;
  } else if (bonuses.roleComplementBonus < 0) {
    analysis += `✗ Weak role complementarity (${bonuses.roleComplementBonus})\n`;
  }

  if (bonuses.autonCoverageBonus > 0) {
    analysis += `✓ Good autonomous coverage (+${bonuses.autonCoverageBonus})\n`;
  } else if (bonuses.autonCoverageBonus < 0) {
    analysis += `✗ Weak autonomous period (${bonuses.autonCoverageBonus})\n`;
  }

  if (bonuses.consistencyBonus > 0) {
    analysis += `✓ Consistent alliance performance (+${bonuses.consistencyBonus})\n`;
  } else if (bonuses.consistencyBonus < 0) {
    analysis += `✗ Inconsistent performance (${bonuses.consistencyBonus})\n`;
  }

  if (bonuses.varianceReductionBonus > 0) {
    analysis += `✓ Good variance reduction (+${bonuses.varianceReductionBonus})\n`;
  }

  if (bonuses.weaknessPenalty < 0) {
    analysis += `✗ Shared weaknesses (${bonuses.weaknessPenalty})\n`;
  }

  return analysis;
}

/**
 * Find best alliance partners for a given team.
 */
export async function findBestPartners(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any, // Firestore db instance
  teamNumber: string,
  availableTeams: string[],
  topN: number = 5
): Promise<
  Array<{
    team_number: string;
    synergy_score: number;
    synergy_analysis: string;
  }>
> {
  try {
    // Fetch the main team's rating
    const mainTeamDoc = await db.collection("team_ratings_204").doc(teamNumber).get();
    if (!mainTeamDoc.exists) {
      return [];
    }
    const mainTeam = mainTeamDoc.data();

    // Score each available team
    const scores: Array<{ team_number: string; score: number; analysis: string }> = [];

    for (const candidateTeam of availableTeams) {
      if (candidateTeam === teamNumber) continue; // Skip self

      const candidateDoc = await db
        .collection("team_ratings_204")
        .doc(candidateTeam)
        .get();
      if (!candidateDoc.exists) continue;

      const candidate = candidateDoc.data();
      const synergy = calculateAllianceSynergy([mainTeam, candidate]);

      scores.push({
        team_number: candidateTeam,
        score: synergy.synergy_score,
        analysis: synergy.detailed_analysis,
      });
    }

    // Sort by synergy score descending
    scores.sort((a, b) => b.score - a.score);

    // Return top N
    return scores.slice(0, topN).map((s) => ({
      team_number: s.team_number,
      synergy_score: s.score,
      synergy_analysis: s.analysis,
    }));
  } catch (err) {
    console.error("Error finding best partners:", err);
    return [];
  }
}
