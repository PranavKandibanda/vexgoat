/**
 * VEX V5 Push Back Skills Scoring Constants
 *
 * Based on the official VEX V5 Robotics Competition Push Back game manual.
 *
 * Push Back Scoring:
 * - Each Block Scored in a Goal:              1 Point
 * - Each filled Control Zone in a Long Goal:  5 Points
 * - Each filled Control Zone in a Center Goal:10 Points
 * - Each Cleared Park Zone:                   5 Points
 * - Each Cleared Loader:                      5 Points
 * - Parked Robot:                             15 Points
 */

export const PUSH_BACK_SCORING = {
  /** Points per block scored in a goal */
  block_in_goal: 1,
  /** Bonus for each filled control zone in a long goal */
  control_zone_long_goal: 5,
  /** Bonus for each filled control zone in a center goal */
  control_zone_center_goal: 10,
  /** Points per cleared park zone */
  cleared_park_zone: 5,
  /** Points per cleared loader */
  cleared_loader: 5,
  /** Points for a parked robot */
  parked_robot: 15,
  /** Maximum possible driver skills score (theoretical) */
  max_driver_score: 119,
  /** Maximum possible programming skills score (theoretical) */
  max_programming_score: 119,
  /** Maximum combined skills score (theoretical) */
  max_combined_score: 238,
};

/**
 * Zone-based scoring for Push Back interactive calculator.
 */
export interface PushBackInput {
  blocksInGoal: number;
  controlZonesLongGoal: number;
  controlZonesCenterGoal: number;
  clearedParkZones: number;
  clearedLoaders: number;
  parkedRobot: boolean;
}

export interface PushBackResult {
  blocksScore: number;
  longGoalZoneScore: number;
  centerGoalZoneScore: number;
  parkZoneScore: number;
  loaderScore: number;
  parkedScore: number;
  totalScore: number;
  maxPossible: number;
  percentOfMax: number;
}

export function calculatePushBackScore(input: PushBackInput): PushBackResult {
  const blocksScore = input.blocksInGoal * PUSH_BACK_SCORING.block_in_goal;
  const longGoalZoneScore = input.controlZonesLongGoal * PUSH_BACK_SCORING.control_zone_long_goal;
  const centerGoalZoneScore = input.controlZonesCenterGoal * PUSH_BACK_SCORING.control_zone_center_goal;
  const parkZoneScore = input.clearedParkZones * PUSH_BACK_SCORING.cleared_park_zone;
  const loaderScore = input.clearedLoaders * PUSH_BACK_SCORING.cleared_loader;
  const parkedScore = input.parkedRobot ? PUSH_BACK_SCORING.parked_robot : 0;

  const totalScore = blocksScore + longGoalZoneScore + centerGoalZoneScore + parkZoneScore + loaderScore + parkedScore;
  const maxPossible = PUSH_BACK_SCORING.max_combined_score;

  return {
    blocksScore,
    longGoalZoneScore,
    centerGoalZoneScore,
    parkZoneScore,
    loaderScore,
    parkedScore,
    totalScore,
    maxPossible,
    percentOfMax: maxPossible > 0 ? Math.round((totalScore / maxPossible) * 1000) / 10 : 0,
  };
}
