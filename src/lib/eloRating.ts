/**
 * ELO Rating System for VEX teams.
 *
 * Tracks 4 separate ratings:
 * 1. Base ELO (overall competitive strength)
 * 2. Autonomous ELO (autonomous period performance)
 * 3. Driver ELO (driver period performance)
 * 4. Endgame ELO (endgame period performance)
 *
 * Also tracks:
 * - consistency_index: standard deviation of recent scores
 * - matches_played: career match count
 * - win_rate: percentage of matches won
 */

export interface TeamRating {
  team_number: string;
  team_id: number;
  elo_rating: number;
  auton_rating: number;
  driver_rating: number;
  endgame_rating: number;
  matches_played: number;
  wins: number;
  consistency_index: number;
  updated_at: string;
}

export interface AllianceStrength {
  total_strength: number;
  base_strength: number;
  auton_bonus: number;
  driver_bonus: number;
  endgame_bonus: number;
  consistency_multiplier: number;
}

export interface MatchResult {
  winner_teams: string[]; // team numbers
  loser_teams: string[]; // team numbers
  winner_score: number;
  loser_score: number;
}

export interface WinPrediction {
  win_probability: number; // 0-1, or percentage 0-100
  expected_score_range: { min: number; max: number } | null;
  key_advantage: "autonomous" | "driver" | "endgame" | "overall";
  confidence: number; // 0-1
}

const K_FACTOR = 32; // standard K-factor for rating adjustments
const BASE_RATING = 1500;
const MAX_RATING = 2200;
const MIN_RATING = 800;

/**
 * Calculate new ELO rating after a match result.
 * Uses standard ELO formula with adjustment for score difference.
 */
export function calculateNewElo(
  currentElo: number,
  opponentElo: number,
  won: boolean,
  scoreMargin: number = 0
): number {
  // Expected probability that current player wins
  const expectedWinProb = 1 / (1 + Math.pow(10, (opponentElo - currentElo) / 400));

  // Actual result: 1 if won, 0 if lost
  const actual = won ? 1 : 0;

  // Adjust K-factor based on score margin (blowout vs close match)
  // Large margins (>50 pts) â†’ higher K (more rating swing)
  // Close matches (<10 pts) â†’ lower K (less rating swing)
  let adjustedK = K_FACTOR;
  if (scoreMargin > 50) adjustedK = K_FACTOR * 1.5;
  if (scoreMargin < 10) adjustedK = K_FACTOR * 0.8;

  // New ELO
  const newElo = currentElo + adjustedK * (actual - expectedWinProb);

  // Clamp to reasonable bounds
  return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(newElo)));
}

/**
 * Update all 4 component ratings for a team based on match performance.
 */
export function updateComponentRatings(
  teamRating: TeamRating,
  est_auton: number,
  est_driver: number,
  est_endgame: number,
  totalScore: number,
  won: boolean,
  opponentRatings: { auton: number; driver: number; endgame: number }
): {
  auton_rating: number;
  driver_rating: number;
  endgame_rating: number;
} {
  // Estimate opponent's scores (assume similar distribution)
  const est_opp_auton = (opponentRatings.auton - BASE_RATING) * 0.01; // simplified
  const est_opp_driver = (opponentRatings.driver - BASE_RATING) * 0.01;
  const est_opp_endgame = (opponentRatings.endgame - BASE_RATING) * 0.01;

  // Update each component rating
  const auton_rating = calculateNewElo(
    teamRating.auton_rating,
    opponentRatings.auton,
    won,
    Math.abs(est_auton - est_opp_auton)
  );

  const driver_rating = calculateNewElo(
    teamRating.driver_rating,
    opponentRatings.driver,
    won,
    Math.abs(est_driver - est_opp_driver)
  );

  const endgame_rating = calculateNewElo(
    teamRating.endgame_rating,
    opponentRatings.endgame,
    won,
    Math.abs(est_endgame - est_opp_endgame)
  );

  return { auton_rating, driver_rating, endgame_rating };
}

/**
 * Calculate the combined strength of an alliance.
 */
export function calculateAllianceStrength(
  teamRatings: TeamRating[]
): AllianceStrength {
  if (teamRatings.length === 0) {
    return {
      total_strength: 0,
      base_strength: 0,
      auton_bonus: 0,
      driver_bonus: 0,
      endgame_bonus: 0,
      consistency_multiplier: 1,
    };
  }

  // Base strength: sum of ELO ratings
  const base_strength = teamRatings.reduce((sum, r) => sum + r.elo_rating, 0);

  // Weighted bonuses by component (30% auton, 50% driver, 20% endgame)
  const avg_auton = teamRatings.reduce((sum, r) => sum + r.auton_rating, 0) / teamRatings.length;
  const avg_driver = teamRatings.reduce((sum, r) => sum + r.driver_rating, 0) / teamRatings.length;
  const avg_endgame = teamRatings.reduce((sum, r) => sum + r.endgame_rating, 0) / teamRatings.length;

  // Scale bonuses to 0-100 range
  const auton_bonus = ((avg_auton - BASE_RATING) / 700) * 100 * 0.3;
  const driver_bonus = ((avg_driver - BASE_RATING) / 700) * 100 * 0.5;
  const endgame_bonus = ((avg_endgame - BASE_RATING) / 700) * 100 * 0.2;

  // Consistency multiplier (lower variance â†’ higher multiplier, up to 1.1x)
  const avg_consistency =
    teamRatings.reduce((sum, r) => sum + r.consistency_index, 0) / teamRatings.length;
  const consistency_multiplier = Math.min(1.1, 1 + (50 - avg_consistency) * 0.002);

  const total_strength = base_strength;

  return {
    total_strength: Math.round(total_strength),
    base_strength,
    auton_bonus: Math.round(auton_bonus),
    driver_bonus: Math.round(driver_bonus),
    endgame_bonus: Math.round(endgame_bonus),
    consistency_multiplier: Math.round(consistency_multiplier * 1000) / 1000,
  };
}

/**
 * Predict the winner and win probability for an alliance vs alliance matchup.
 */
export function predictMatch(
  allianceA: TeamRating[],
  allianceB: TeamRating[]
): {
  alliance_a: WinPrediction;
  alliance_b: WinPrediction;
} {
  const strengthA = calculateAllianceStrength(allianceA);
  const strengthB = calculateAllianceStrength(allianceB);

  // Logistic function for win probability
  const calcWinProb = (strA: number, strB: number): number => {
    const diff = strB - strA;
    return 1 / (1 + Math.pow(10, diff / 400));
  };

  const minMatches = Math.min(...[...allianceA, ...allianceB].map((team) => team.matches_played));
  const prob_a = minMatches >= 3 ? calcWinProb(strengthA.total_strength, strengthB.total_strength) : 0.5;
  const prob_b = 1 - prob_a;

  // Key advantage: which component has biggest delta
  let key_advantage_a: "autonomous" | "driver" | "endgame" | "overall" = "overall";
  const diffs = {
    autonomous: strengthA.auton_bonus - strengthB.auton_bonus,
    driver: strengthA.driver_bonus - strengthB.driver_bonus,
    endgame: strengthA.endgame_bonus - strengthB.endgame_bonus,
  };
  const maxAdvantageDiff = Math.max(
    Math.abs(diffs.autonomous),
    Math.abs(diffs.driver),
    Math.abs(diffs.endgame)
  );
  if (Math.abs(diffs.autonomous) === maxAdvantageDiff && diffs.autonomous > 0) {
    key_advantage_a = "autonomous";
  } else if (Math.abs(diffs.driver) === maxAdvantageDiff && diffs.driver > 0) {
    key_advantage_a = "driver";
  } else if (Math.abs(diffs.endgame) === maxAdvantageDiff && diffs.endgame > 0) {
    key_advantage_a = "endgame";
  }

  let key_advantage_b: "autonomous" | "driver" | "endgame" | "overall" = "overall";
  const diffs_b = {
    autonomous: -diffs.autonomous,
    driver: -diffs.driver,
    endgame: -diffs.endgame,
  };
  const maxAdvantageDiff_b = Math.max(
    Math.abs(diffs_b.autonomous),
    Math.abs(diffs_b.driver),
    Math.abs(diffs_b.endgame)
  );
  if (Math.abs(diffs_b.autonomous) === maxAdvantageDiff_b && diffs_b.autonomous > 0) {
    key_advantage_b = "autonomous";
  } else if (Math.abs(diffs_b.driver) === maxAdvantageDiff_b && diffs_b.driver > 0) {
    key_advantage_b = "driver";
  } else if (Math.abs(diffs_b.endgame) === maxAdvantageDiff_b && diffs_b.endgame > 0) {
    key_advantage_b = "endgame";
  }

  // Confidence: higher if teams have played many matches
  const avg_matches_a =
    allianceA.reduce((sum, r) => sum + r.matches_played, 0) / allianceA.length;
  const avg_matches_b =
    allianceB.reduce((sum, r) => sum + r.matches_played, 0) / allianceB.length;
  const confidence_a = Math.min(0.9, avg_matches_a / 30);
  const confidence_b = Math.min(0.9, avg_matches_b / 30);

  return {
    alliance_a: {
      win_probability: prob_a,
      expected_score_range: null,
      key_advantage: key_advantage_a,
      confidence: confidence_a,
    },
    alliance_b: {
      win_probability: prob_b,
      expected_score_range: null,
      key_advantage: key_advantage_b,
      confidence: confidence_b,
    },
  };
}

/**
 * Calculate consistency index (standard deviation) from match history.
 */
export function calculateConsistencyIndex(scores: number[]): number {
  if (scores.length === 0) return 100;
  if (scores.length === 1) return 0;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Return as 0-100 scale (higher = less consistent)
  return Math.round(Math.min(stdDev, 100));
}
