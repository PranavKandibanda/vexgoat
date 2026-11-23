// RSC3, V5RC Override game manual v2.1. Count only halves that meet placement and ownership rules.
export function calculateOverrideSkillsScore(coloredHalves: number, ownedYellowHalves: number, midfield: boolean): number {
  if (![coloredHalves, ownedYellowHalves].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error("Scoring counts must be nonnegative integers");
  }
  return coloredHalves * 5 + ownedYellowHalves * 10 + (midfield ? 8 : 0);
}
