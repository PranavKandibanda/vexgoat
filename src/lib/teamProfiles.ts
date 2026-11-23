/**
 * Team Profiles - Generate scouting reports and team analysis.
 */

import type { TeamRating } from "@/lib/eloRating";
import {
  classifyTeam,
  identifyStrengths,
  identifyWeaknesses,
  recommendPartnerRoles,
  type TeamClassification,
} from "./teamClassifier";

export interface TeamProfile {
  team_number: string;
  team_id: number;
  classification: TeamClassification;
  strengths: string[];
  weaknesses: string[];
  recommended_partner_roles: string[];
  summary_text: string;
  suggested_strategy: string;
}

/**
 * Generate a full team profile from their rating data.
 */
export function generateTeamProfile(teamRating: TeamRating): TeamProfile {
  const classification = classifyTeam(teamRating);
  const strengths = identifyStrengths(teamRating);
  const weaknesses = identifyWeaknesses(teamRating);
  const partnerRoles = recommendPartnerRoles(teamRating, classification);

  // Generate summary text
  const summaryText = generateSummaryText(
    teamRating,
    classification,
    strengths,
    weaknesses
  );

  // Generate strategy suggestions
  const suggestedStrategy = generateStrategyText(
    classification,
    teamRating
  );

  return {
    team_number: teamRating.team_number,
    team_id: teamRating.team_id,
    classification,
    strengths,
    weaknesses,
    recommended_partner_roles: partnerRoles,
    summary_text: summaryText,
    suggested_strategy: suggestedStrategy,
  };
}

/**
 * Generate a human-readable summary of the team's performance.
 */
function generateSummaryText(
  teamRating: TeamRating,
  classification: TeamClassification,
  strengths: string[],
  weaknesses: string[]
): string {
  const role = classification.role;
  const desc = classification.role_description;
  const winRate =
    teamRating.matches_played > 0
      ? ((teamRating.wins / teamRating.matches_played) * 100).toFixed(0)
      : "0";

  let text = `${role} (${classification.role_emoji})\n${desc}\n\n`;

  text += `Win Rate: ${winRate}% | Matches Played: ${teamRating.matches_played}\n`;
  text += `Overall Rating: ${teamRating.elo_rating} | Consistency: ${teamRating.consistency_index}/100\n\n`;

  if (strengths.length > 0) {
    text += "Strengths:\n";
    strengths.forEach((s) => {
      text += `• ${s}\n`;
    });
  }

  if (weaknesses.length > 0) {
    text += "\nWeaknesses:\n";
    weaknesses.forEach((w) => {
      text += `• ${w}\n`;
    });
  }

  return text;
}

/**
 * Generate strategic recommendations based on team profile.
 */
function generateStrategyText(
  classification: TeamClassification,
  teamRating: TeamRating
): string {
  const role = classification.role;

  const strategies: Record<string, string> = {
    "Offensive Carry": `Pick this team as your primary scorer. They excel at match play and should lead your alliance's scoring. Pair with a \`Defensive Specialist\` to create a balanced partnership.`,

    "Defensive Specialist": `Use this team for defense and endgame. They may not score heavily but provide reliability and often secure crucial climbing points. Pair with an \`Offensive Carry\` to maximize points.`,

    Balanced: `Flexible alliance member who can adapt to various matchups. Works well with any role; consider team chemistry when forming alliances.`,

    "Endgame Focused": `Leverage their climbing expertise for endgame points. Rely on alliance partners for driver-period scoring. Pairs well with \`Offensive Carry\` or \`Autonomous Heavy\`.`,

    "Autonomous Heavy": `Their strength lies in the autonomous period. Ensure they have consistent autonomous routines and pair with strong driver-period teams to maximize their advantage.`,

    Inconsistent: `High-risk, high-reward pick. Performance is unpredictable—check recent matches before committing to an alliance. May perform exceptionally well or underperform.`,
  };

  let strategy = strategies[role] || "Monitor team performance before committing to alliance.";

  // Add specific tactical notes
  if (teamRating.consistency_index < 25) {
    strategy += "\n✓ Highly consistent—reliable pick for important matches.";
  } else if (teamRating.consistency_index > 70) {
    strategy += "\n⚠ Highly variable—monitor recent performance before selection.";
  }

  if (teamRating.elo_rating > 1750) {
    strategy += "\n✓ Elite-level team—strong contender for event wins.";
  } else if (teamRating.elo_rating < 1250) {
    strategy += "\n◆ Developing team—good practice partner for alliance building.";
  }

  return strategy;
}

/**
 * Calculate synergy between two teams for alliance compatibility.
 * Returns a score 0-100 where higher = better partnership.
 */
export function calculateTeamSynergy(team1: TeamRating, team2: TeamRating): number {
  const class1 = classifyTeam(team1);
  const class2 = classifyTeam(team2);

  let synergy = 50; // baseline

  // Role complementarity
  const complementary: Record<string, string[]> = {
    "Offensive Carry": ["Defensive Specialist"],
    "Defensive Specialist": ["Offensive Carry"],
    Balanced: ["Balanced", "Offensive Carry", "Defensive Specialist"],
    "Endgame Focused": ["Autonomous Heavy"],
    "Autonomous Heavy": ["Endgame Focused"],
    Inconsistent: [], // no good synergy with inconsistent teams
  };

  if (
    complementary[class1.role]?.includes(class2.role) ||
    complementary[class2.role]?.includes(class1.role)
  ) {
    synergy += 15;
  }

  // ELO similarity (teams at similar levels perform better together)
  const eloDiff = Math.abs(team1.elo_rating - team2.elo_rating);
  if (eloDiff < 100) {
    synergy += 10; // very close in rating
  } else if (eloDiff < 200) {
    synergy += 5;
  } else if (eloDiff > 400) {
    synergy -= 5; // large skill gap
  }

  // Consistency matching
  const consistencyDiff = Math.abs(team1.consistency_index - team2.consistency_index);
  if (consistencyDiff < 20) {
    synergy += 8; // similar consistency
  } else if (consistencyDiff > 50) {
    synergy -= 5; // very different consistency
  }

  // Avoid pairing two inconsistent teams
  if (class1.role === "Inconsistent" && class2.role === "Inconsistent") {
    synergy -= 20;
  }

  // Cap synergy between 0 and 100
  return Math.min(Math.max(synergy, 0), 100);
}
