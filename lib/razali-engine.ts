/**
 * Razali/Yeung Squad Quality Engine.
 *
 * Implements the cluster aggregation approach from:
 * "A framework of interpretable match results prediction in football
 *  with FIFA ratings and team formation" (Yeung, Saringat, Razali, Mustapha, 2023)
 *
 * 35 EA FC player sub-attributes are grouped into 7 clusters, then
 * summed per position role (FWD/MID/DEF/GK) to create 28 team features.
 * These are collapsed into offensive/defensive ratings on the Elo scale.
 */

// --- 7 Razali Clusters ---
// Column names from the Kaggle dataset (stefanoleone992/ea-sports-fc-24)
export const CLUSTERS = {
  attacking: [
    "attacking_crossing", "attacking_finishing", "attacking_heading_accuracy",
    "attacking_short_passing", "attacking_volleys",
  ],
  skill: [
    "skill_dribbling", "skill_curve", "skill_fk_accuracy",
    "skill_long_passing", "skill_ball_control",
  ],
  movement: [
    "movement_acceleration", "movement_sprint_speed", "movement_agility",
    "movement_reactions", "movement_balance",
  ],
  power: [
    "power_shot_power", "power_jumping", "power_stamina",
    "power_strength", "power_long_shots",
  ],
  mentality: [
    "mentality_aggression", "mentality_interceptions", "mentality_positioning",
    "mentality_vision", "mentality_penalties", "mentality_composure",
  ],
  defending: [
    "defending_marking_awareness", "defending_standing_tackle",
    "defending_sliding_tackle",
  ],
  goalkeeping: [
    "goalkeeping_diving", "goalkeeping_handling", "goalkeeping_kicking",
    "goalkeeping_positioning", "goalkeeping_reflexes",
  ],
} as const;

// Legacy column name mapping (FIFA 15-20 used different names)
const COLUMN_ALIASES: Record<string, string> = {
  defending_marking_awareness: "defending_marking",
};

export type ClusterName = keyof typeof CLUSTERS;
export type PositionRole = "GK" | "DEF" | "MID" | "FWD";

export interface PlayerClusterSums {
  attacking: number;
  skill: number;
  movement: number;
  power: number;
  mentality: number;
  defending: number;
  goalkeeping: number;
}

export interface TeamRazaliFeatures {
  fwdAttacking: number; fwdSkill: number; fwdMovement: number;
  fwdPower: number; fwdMentality: number; fwdDefending: number; fwdGoalkeeping: number;
  midAttacking: number; midSkill: number; midMovement: number;
  midPower: number; midMentality: number; midDefending: number; midGoalkeeping: number;
  defAttacking: number; defSkill: number; defMovement: number;
  defPower: number; defMentality: number; defDefending: number; defGoalkeeping: number;
  gkAttacking: number; gkSkill: number; gkMovement: number;
  gkPower: number; gkMentality: number; gkDefending: number; gkGoalkeeping: number;
}

/**
 * Compute 7 cluster sums from a player's raw attribute values.
 */
export function computeClusterSums(
  playerRow: Record<string, string | number>
): PlayerClusterSums {
  const result: Record<string, number> = {};

  for (const [cluster, columns] of Object.entries(CLUSTERS)) {
    let sum = 0;
    for (const col of columns) {
      let val = playerRow[col];
      // Try alias if column not found
      if (val == null && COLUMN_ALIASES[col]) {
        val = playerRow[COLUMN_ALIASES[col]];
      }
      const num = typeof val === "number" ? val : parseFloat(String(val));
      if (!isNaN(num)) sum += num;
    }
    result[cluster] = sum;
  }

  return result as unknown as PlayerClusterSums;
}

/**
 * Map EA FC nation_position to one of 4 Razali roles.
 */
export function mapPositionRole(nationPosition: string): PositionRole {
  const pos = nationPosition.toUpperCase().trim();
  if (pos === "GK") return "GK";
  if (["CB", "LB", "RB", "LWB", "RWB"].includes(pos)) return "DEF";
  if (["CDM", "CM", "CAM", "LM", "RM"].includes(pos)) return "MID";
  if (["ST", "CF", "LW", "RW", "LF", "RF"].includes(pos)) return "FWD";
  return "MID"; // fallback
}

/**
 * Aggregate player cluster sums into team-level features by role.
 * Uses SUM (not average) per the Razali paper to capture "number advantage."
 */
export function aggregateTeamFeatures(
  players: Array<{ role: PositionRole; clusters: PlayerClusterSums }>
): TeamRazaliFeatures {
  const features: TeamRazaliFeatures = {
    fwdAttacking: 0, fwdSkill: 0, fwdMovement: 0, fwdPower: 0,
    fwdMentality: 0, fwdDefending: 0, fwdGoalkeeping: 0,
    midAttacking: 0, midSkill: 0, midMovement: 0, midPower: 0,
    midMentality: 0, midDefending: 0, midGoalkeeping: 0,
    defAttacking: 0, defSkill: 0, defMovement: 0, defPower: 0,
    defMentality: 0, defDefending: 0, defGoalkeeping: 0,
    gkAttacking: 0, gkSkill: 0, gkMovement: 0, gkPower: 0,
    gkMentality: 0, gkDefending: 0, gkGoalkeeping: 0,
  };

  const prefixMap: Record<PositionRole, string> = {
    FWD: "fwd", MID: "mid", DEF: "def", GK: "gk",
  };

  for (const { role, clusters } of players) {
    const prefix = prefixMap[role];
    for (const [cluster, value] of Object.entries(clusters)) {
      const key = `${prefix}${cluster.charAt(0).toUpperCase()}${cluster.slice(1)}` as keyof TeamRazaliFeatures;
      (features[key] as number) += value;
    }
  }

  return features;
}

// --- Offensive/Defensive derivation weights ---
// FWD attacking/skill/movement + MID attacking/skill/movement/mentality
const OFFENSIVE_WEIGHTS: Partial<Record<keyof TeamRazaliFeatures, number>> = {
  fwdAttacking: 0.30, fwdSkill: 0.15, fwdMovement: 0.15,
  midAttacking: 0.15, midSkill: 0.10, midMovement: 0.10,
  midMentality: 0.05,
};

// DEF defending/power/mentality + GK goalkeeping + MID defending/power/mentality
const DEFENSIVE_WEIGHTS: Partial<Record<keyof TeamRazaliFeatures, number>> = {
  defDefending: 0.30, defPower: 0.15, defMentality: 0.10,
  gkGoalkeeping: 0.15, midDefending: 0.15, midPower: 0.10,
  midMentality: 0.05,
};

/**
 * Derive raw offensive score from team features.
 */
export function deriveRawOffensive(features: TeamRazaliFeatures): number {
  let score = 0;
  for (const [key, weight] of Object.entries(OFFENSIVE_WEIGHTS)) {
    score += features[key as keyof TeamRazaliFeatures] * weight;
  }
  return score;
}

/**
 * Derive raw defensive score from team features.
 */
export function deriveRawDefensive(features: TeamRazaliFeatures): number {
  let score = 0;
  for (const [key, weight] of Object.entries(DEFENSIVE_WEIGHTS)) {
    score += features[key as keyof TeamRazaliFeatures] * weight;
  }
  return score;
}

const RAZALI_ELO_MEAN = 1500;
const RAZALI_ELO_STD = 150;

/**
 * Convert a raw Razali score to the Elo scale via z-score normalization.
 */
export function razaliToEloScale(
  rawScore: number,
  mean: number,
  std: number,
  isDefensive: boolean
): number {
  if (std < 0.01) return RAZALI_ELO_MEAN;
  const z = (rawScore - mean) / std;
  if (isDefensive) {
    // In our system: lower defensive = better defense
    return RAZALI_ELO_MEAN - z * RAZALI_ELO_STD;
  }
  return RAZALI_ELO_MEAN + z * RAZALI_ELO_STD;
}

/**
 * FIFA edition number to calendar year.
 */
export function editionToYear(edition: number): number {
  return edition + 1999; // FIFA 15 = 2014, FIFA 24 = 2023
}

/**
 * Calendar year to FIFA edition number.
 */
export function yearToEdition(year: number): number | null {
  if (year < 2014) return null;
  if (year > 2023) return 24; // reuse latest
  return year - 1999;
}
