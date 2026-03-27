/**
 * Market Alignment Analysis — compares model championship probabilities
 * against sportsbook consensus and generates disagreement reports.
 */

import { CONSENSUS_ODDS, SPORTSBOOK_ODDS, POLYMARKET_ODDS } from "./market-odds";

export interface TeamComparison {
  team: string;
  modelProb: number;
  consensusProb: number;
  sportsbookProb: number;
  polymarketProb: number;
  diff: number;           // model - consensus (positive = model higher)
  absDiff: number;
  samplingError: number;  // 95% CI half-width for modelProb given simulation iterations
  significant: boolean;   // is |diff| > 2 * samplingError?
  direction: "MODEL_HIGHER" | "MODEL_LOWER" | "ALIGNED";
  category: "strong_agree" | "agree" | "mild_disagree" | "disagree" | "strong_disagree";
}

/**
 * Compute 95% CI half-width using the Wilson interval.
 * Wilson is more reliable than Wald for small p (< 0.05), which applies
 * to most of the 48 WC teams. Returns the half-width of the interval.
 */
export function samplingError95(p: number, n: number): number {
  const z = 1.96;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  // Return half-width of the Wilson interval
  return margin;
}

export interface AlignmentMetrics {
  mse: number;
  spearmanCorrelation: number;
  top5Overlap: number;
  top10Overlap: number;
  meanAbsDiff: number;
}

export interface DisagreementAnalysis {
  team: string;
  modelProb: number;
  consensusProb: number;
  diff: number;
  direction: "MODEL_HIGHER" | "MODEL_LOWER";
  severity: "mild" | "notable" | "significant";
  justification: string;
}

// Thresholds for categorizing agreement
const THRESHOLD_STRONG_AGREE = 0.005;  // within 0.5pp
const THRESHOLD_AGREE = 0.015;         // within 1.5pp
const THRESHOLD_MILD = 0.03;           // within 3pp
const THRESHOLD_DISAGREE = 0.05;       // within 5pp

function categorize(absDiff: number): TeamComparison["category"] {
  if (absDiff <= THRESHOLD_STRONG_AGREE) return "strong_agree";
  if (absDiff <= THRESHOLD_AGREE) return "agree";
  if (absDiff <= THRESHOLD_MILD) return "mild_disagree";
  if (absDiff <= THRESHOLD_DISAGREE) return "disagree";
  return "strong_disagree";
}

function direction(diff: number): TeamComparison["direction"] {
  if (diff > THRESHOLD_STRONG_AGREE) return "MODEL_HIGHER";
  if (diff < -THRESHOLD_STRONG_AGREE) return "MODEL_LOWER";
  return "ALIGNED";
}

/**
 * Compare model championship probabilities against market consensus.
 * @param modelOdds Championship probabilities from simulation
 * @param iterations Number of Monte Carlo iterations (for confidence intervals)
 */
export function compareToMarket(
  modelOdds: Record<string, number>,
  iterations: number = 10000,
): TeamComparison[] {
  const allTeams = new Set([
    ...Object.keys(modelOdds),
    ...Object.keys(CONSENSUS_ODDS),
  ]);

  const comparisons: TeamComparison[] = [];
  for (const team of allTeams) {
    const mp = modelOdds[team] ?? 0;
    const cp = CONSENSUS_ODDS[team] ?? 0;
    const sp = SPORTSBOOK_ODDS[team] ?? 0;
    const pp = POLYMARKET_ODDS[team] ?? 0;
    const diff = mp - cp;
    const absDiff = Math.abs(diff);
    const se = samplingError95(mp, iterations);

    comparisons.push({
      team,
      modelProb: mp,
      consensusProb: cp,
      sportsbookProb: sp,
      polymarketProb: pp,
      diff,
      absDiff,
      samplingError: se,
      significant: absDiff > se, // beyond 95% CI (Wilson interval already includes z=1.96)
      direction: direction(diff),
      category: categorize(absDiff),
    });
  }

  return comparisons.sort((a, b) => b.consensusProb - a.consensusProb);
}

/**
 * Compute alignment metrics between model and market.
 */
export function computeMetrics(comparisons: TeamComparison[]): AlignmentMetrics {
  // MSE
  let mse = 0;
  for (const c of comparisons) {
    mse += (c.modelProb - c.consensusProb) ** 2;
  }
  mse /= comparisons.length;

  // Spearman rank correlation
  const byModel = [...comparisons].sort((a, b) => b.modelProb - a.modelProb);
  const byMarket = [...comparisons].sort((a, b) => b.consensusProb - a.consensusProb);
  const modelRank = new Map(byModel.map((c, i) => [c.team, i]));
  const marketRank = new Map(byMarket.map((c, i) => [c.team, i]));

  let d2Sum = 0;
  const n = comparisons.length;
  for (const c of comparisons) {
    const d = (modelRank.get(c.team) ?? 0) - (marketRank.get(c.team) ?? 0);
    d2Sum += d * d;
  }
  const spearmanCorrelation = 1 - (6 * d2Sum) / (n * (n * n - 1));

  // Top-N overlap
  const modelTop5 = byModel.slice(0, 5).map(c => c.team);
  const marketTop5 = byMarket.slice(0, 5).map(c => c.team);
  const modelTop10 = byModel.slice(0, 10).map(c => c.team);
  const marketTop10 = byMarket.slice(0, 10).map(c => c.team);

  const top5Overlap = modelTop5.filter(t => marketTop5.includes(t)).length / 5;
  const top10Overlap = modelTop10.filter(t => marketTop10.includes(t)).length / 10;

  // Mean absolute difference
  const meanAbsDiff = comparisons.reduce((s, c) => s + c.absDiff, 0) / comparisons.length;

  return { mse, spearmanCorrelation, top5Overlap, top10Overlap, meanAbsDiff };
}

/**
 * Generate justifications for notable disagreements.
 *
 * These are pre-written explanations for known divergences between
 * our model and the market. They encode domain knowledge about why
 * the model or the market might be "right."
 */
export function generateDisagreementReport(
  comparisons: TeamComparison[],
): DisagreementAnalysis[] {
  const notable = comparisons.filter(c => c.category === "mild_disagree" || c.category === "disagree" || c.category === "strong_disagree");

  // Domain knowledge justifications keyed by team name
  const JUSTIFICATIONS: Record<string, (c: TeamComparison) => string> = {
    "Spain": (c) => c.direction === "MODEL_HIGHER"
      ? "Our model may be weighting Spain's Nations League dominance and squad depth more heavily. Spain's 2024 Euro win and deep talent pool across La Liga make them a clear #1 in results-based models."
      : "The market may be pricing in Spain's tactical consistency under de la Fuente and their 2024 Euro championship pedigree more than our historical models capture.",
    "England": (c) => c.direction === "MODEL_HIGHER"
      ? "England's Elo and BT ratings are buoyed by consistent deep runs (2018 SF, 2020 final, 2022 QF, 2024 final). Our model weights this track record heavily."
      : "The market may be giving England credit for squad talent (Premier League depth) that our results-based models underweight. England's perennial 'underperformance' narrative may be overblown — the squad quality is genuinely elite.",
    "France": (c) => c.direction === "MODEL_HIGHER"
      ? "France's rating benefits from a deep squad headlined by Mbappé. Our Combined model (Elo + roster quality) captures this well."
      : "Polymarket prices France higher than traditional sportsbooks. The market consensus may reflect confidence in French tactical depth and World Cup pedigree (2018 winners, 2022 finalists) beyond what sequential Elo captures.",
    "Brazil": (c) => c.direction === "MODEL_HIGHER"
      ? "Our model may be giving Brazil residual credit from their historically high Elo. Brazil's recent tournament disappointments (2022 QF exit, 2024 Copa QF exit) haven't fully eroded their structural rating advantage."
      : "The market has cooled on Brazil compared to 2022. Sportsbooks still price them at +750 (tied with France), but Polymarket is lower at 8.6%. Our model may be appropriately skeptical of Brazil's recent form while the traditional books lag.",
    "Argentina": (c) => c.direction === "MODEL_HIGHER"
      ? "Argentina's 2022 World Cup and 2024 Copa América wins keep their Elo high. But the market may be pricing in Messi's age/retirement and the difficulty of defending a World Cup title."
      : "The defending champions still have a deep squad even post-Messi. The market may be appropriately pricing in continuity risk as Argentina transitions from the Messi era.",
    "Portugal": (c) => c.direction === "MODEL_HIGHER"
      ? "Our model rates Portugal's squad quality highly (Ronaldo era depth + emerging talent). The Combined model's roster component boosts them."
      : "Portugal in a strong group (H) with Uruguay, but their knockout draw could be favorable. The market may be pricing draw luck that our simulation averages out.",
    "Germany": (c) => c.direction === "MODEL_HIGHER"
      ? "Germany's high base Elo and strong Bundesliga representation in our roster model may be inflating their rating above what the market expects."
      : "Germany's 2024 Euro host-nation semifinal run showed quality, but they're in a transitional phase. The market is cautious; our model may lag this sentiment.",
    "Netherlands": (c) => c.direction === "MODEL_HIGHER"
      ? "The Netherlands have been consistently ranked in the top 8-10 by our Elo models. Their steady tournament performances keep them rated highly."
      : "A favorable group (F: Japan, playoff team, Tunisia) could help the Netherlands advance deep, which the market may be pricing in.",
    "Norway": (c) => c.direction === "MODEL_HIGHER"
      ? "Our model may be overrating Norway based on Haaland's impact in recent qualifiers. Norway's overall squad depth is thinner than the top 8."
      : "Haaland is a generational talent, and the market (Polymarket 3.3%, sportsbooks 3.3%) is pricing in his individual ability to carry a team through a tournament. Our model may undervalue star-player effects.",
    "Italy": (c) => c.direction === "MODEL_HIGHER"
      ? "Italy's Elo benefits from their 2020 Euro title and strong qualification record. But they still need to win the playoff final vs Bosnia (March 31)."
      : "The market prices Italy at +3000 (2.7%) — they're a known tournament team (2020 Euro winners) but qualification uncertainty creates a discount. Our model should account for the ~75% qualification probability.",
    "Belgium": (c) => c.direction === "MODEL_HIGHER"
      ? "Belgium's 'golden generation' still inflates their Elo from years of top-5 FIFA rankings. The market has correctly discounted them as the squad ages."
      : "Belgium's experienced core (De Bruyne, Lukaku) still has a puncher's chance, but the market at 1.9% (Polymarket) to 2.7% (sportsbooks) reflects a team past its peak.",
    "Colombia": (c) => c.direction === "MODEL_HIGHER"
      ? "Colombia's recent form has been excellent (2024 Copa América final). Our model captures their upward trajectory."
      : "The market at 1.7-2.0% correctly identifies Colombia as a strong dark horse. Their group (K: Portugal, playoff team, Uzbekistan) is navigable.",
    "United States": (c) => c.direction === "MODEL_HIGHER"
      ? "Host nation advantage is significant (historically ~+15% advancement boost). Our simulation models venue-specific home advantage for US matches."
      : "The market at 1.3-1.7% may be underpricing host advantage. In World Cup history, hosts routinely outperform their rating. The US has improved significantly since 2022 but faces a tough Group D.",
    "Morocco": (c) => c.direction === "MODEL_HIGHER"
      ? "Morocco's 2022 World Cup semifinal run significantly boosted their Elo. Our model carries that forward, though it may be an outlier performance."
      : "The market at 1.4-1.7% respects Morocco's 2022 run. In Group C (Brazil, Haiti, Scotland), they're competitive but face Brazil in the opener.",
    "Japan": (c) => c.direction === "MODEL_HIGHER"
      ? "Japan's recent improvement (competitive vs. Germany and Spain in 2022) is reflected in our ratings. They've been on a steady upward trajectory."
      : "The market at 0.9-1.5% sees Japan as an improving dark horse. Group F (Netherlands, playoff team, Tunisia) is navigable. Our model and Polymarket (1.5%) are aligned.",
    "Mexico": (c) => c.direction === "MODEL_HIGHER"
      ? "Host nation advantage applies to Mexico. Our simulation models this per-match based on venue (Estadio Azteca, Guadalajara)."
      : "Host status helps but Mexico hasn't advanced past the R16 since 1986 (as hosts). The market discounts host advantage less than history suggests it should.",
    "Croatia": (c) => c.direction === "MODEL_HIGHER"
      ? "Croatia's 2018 final and 2022 semifinal keep their Elo elevated. Strong tournament pedigree in our sequential models."
      : "Croatia is aging (Modrić era winding down) but still dangerous in Group L (England, Ghana, Panama). The market at 0.9-1.3% reflects a team in transition.",
  };

  return notable.map(c => {
    const justifyFn = JUSTIFICATIONS[c.team];
    const justification = justifyFn
      ? justifyFn(c)
      : c.direction === "MODEL_HIGHER"
        ? `Our model rates ${c.team} ${(c.diff * 100).toFixed(1)}pp above market consensus. This may reflect historical rating momentum that hasn't caught up with recent squad changes or form.`
        : `The market rates ${c.team} ${(-c.diff * 100).toFixed(1)}pp above our model. This could reflect factors our model doesn't capture well: squad chemistry, coaching changes, or draw/venue effects.`;

    return {
      team: c.team,
      modelProb: c.modelProb,
      consensusProb: c.consensusProb,
      diff: c.diff,
      direction: c.direction as "MODEL_HIGHER" | "MODEL_LOWER",
      severity: c.category === "mild_disagree" ? "mild" as const
        : c.category === "disagree" ? "notable" as const
        : "significant" as const,
      justification,
    };
  });
}
