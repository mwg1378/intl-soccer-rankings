/**
 * Market Observations — documented analysis of sportsbook vs prediction market
 * divergences and notable patterns in World Cup 2026 odds.
 *
 * Updated: March 27, 2026
 *
 * This module captures the qualitative analysis that explains *why* markets
 * price teams the way they do, and where our model's perspective adds value.
 */

export interface MarketObservation {
  team: string;
  category: "source_divergence" | "model_insight" | "market_shift" | "playoff_uncertainty";
  headline: string;
  analysis: string;
}

export const MARKET_OBSERVATIONS: MarketObservation[] = [
  // === Source divergences (sportsbook vs Polymarket) ===
  {
    team: "Brazil",
    category: "source_divergence",
    headline: "Polymarket is notably cooler on Brazil than traditional sportsbooks",
    analysis:
      "Traditional books price Brazil at +750 (tied with France for 3rd favorite), " +
      "but Polymarket has them at just 8.6% — behind both France (10.9%) and Argentina (10.1%). " +
      "This ~2.5pp gap is the largest source divergence among contenders. Possible explanations: " +
      "(1) Polymarket traders are more reactive to Brazil's recent tournament disappointments " +
      "(2022 QF exit to Croatia, 2024 Copa QF exit), (2) traditional books have stickier lines " +
      "that still reflect Brazil's brand premium, (3) the prediction market is faster to price " +
      "in the generational transition from Neymar. Our model should lean toward Polymarket here — " +
      "results-based models are designed to capture exactly this kind of declining trajectory.",
  },
  {
    team: "Germany",
    category: "source_divergence",
    headline: "Polymarket discounts Germany more than sportsbooks",
    analysis:
      "Sportsbooks have Germany at +1200 (~6.7% implied), while Polymarket has them at just 5.4%. " +
      "Germany's 2024 Euro semifinal as hosts was impressive but they exited to eventual champions Spain. " +
      "The prediction market may be pricing in Germany's inconsistency: they failed to exit the " +
      "group stage in 2018 and 2022. Without home advantage in 2026, the market is skeptical. " +
      "Their Group E (Curaçao, Ivory Coast, Ecuador) is navigable, which the books may be pricing.",
  },
  {
    team: "France",
    category: "source_divergence",
    headline: "Polymarket likes France more than traditional books",
    analysis:
      "Polymarket prices France at 10.9% vs sportsbooks' ~8.5% (implied from +750). " +
      "This could reflect prediction market traders' belief in France's deep squad " +
      "(Mbappé, Griezmann successors, strong PSG/Premier League contingent) and their " +
      "track record: 2018 winners, 2022 finalists. The sportsbook price may be held back " +
      "by France's recent Nations League form. Group I (Senegal, playoff TBD, Norway) is " +
      "competitive but manageable for a team of France's caliber.",
  },

  // === Playoff uncertainty ===
  {
    team: "Italy",
    category: "playoff_uncertainty",
    headline: "Italy priced as top-10 favorite despite not yet qualifying",
    analysis:
      "Italy sits at +3000 (~2.7%) despite needing to beat Bosnia in the playoff final " +
      "(March 31). This prices in their ~75% qualification probability AND their tournament " +
      "strength. Italy are Euro 2020 champions with a strong tactical identity under Spalletti. " +
      "If they qualify into Group B (Canada, Qatar, Switzerland), they'd be favorites to top it. " +
      "Our model needs to handle this conditional probability correctly — Italy's championship " +
      "odds should be (prob of qualifying) * (prob of winning given qualified).",
  },
  {
    team: "Denmark",
    category: "playoff_uncertainty",
    headline: "Denmark at +12000 shows strong Dark Horse belief",
    analysis:
      "Denmark must beat Czechia (March 31) to qualify, but the market still prices them " +
      "at +12000 (~0.7%). Given they have maybe a 55% chance of qualifying, the conditional " +
      "championship probability is over 1.2%. Denmark reached the Euro 2020 semifinal " +
      "and have a cohesive squad. Group A (Mexico, South Africa, South Korea) would be " +
      "very favorable if they qualify.",
  },

  // === Model insights ===
  {
    team: "Norway",
    category: "model_insight",
    headline: "Both sources agree on Norway at 3.3% — but is this a Haaland premium?",
    analysis:
      "Norway is a consensus top-9 pick at 3.3% (Polymarket) / 3.3% (implied from +2500). " +
      "This is remarkable for a team that has never won a major tournament. The pricing is " +
      "almost entirely an Erling Haaland premium — the market is effectively saying one " +
      "generational striker can carry a team through 7 matches. Our model may underrate " +
      "this if it weights squad depth equally across positions. Norway's Group I draw " +
      "(France, Senegal, playoff TBD) is tough, requiring them to likely beat France to " +
      "top the group.",
  },
  {
    team: "United States",
    category: "model_insight",
    headline: "Host advantage may be underpriced at 1.3-1.7%",
    analysis:
      "The US ranges from 1.3% (sportsbooks) to 1.7% (Polymarket). Historical World Cup " +
      "data shows hosts outperform their rating significantly — South Korea (2002 SF), " +
      "South Africa (2010 group exit but vs strong opponents), Russia (2018 QF). " +
      "The US plays all group matches and early KO rounds at home venues with massive crowds. " +
      "Our simulation models venue-specific home advantage per match, which should capture " +
      "this. If our model assigns the US more than 2%, it's likely because the simulation " +
      "properly accounts for the venue boost the market may be underweighting.",
  },
  {
    team: "Colombia",
    category: "model_insight",
    headline: "Colombia's momentum may not be fully priced in",
    analysis:
      "At 1.7-2.0%, Colombia is a value pick if our model rates them higher. They reached " +
      "the 2024 Copa América final (losing only to Argentina), have a dynamic young squad " +
      "(Luis Díaz, Jhon Durán), and drew into Group K (Portugal, playoff TBD, Uzbekistan). " +
      "The Copa final run significantly boosted their Elo and BT ratings. If our model " +
      "assigns them 2.5%+, it's capturing the upward momentum the market is slow to price.",
  },
  {
    team: "Belgium",
    category: "market_shift",
    headline: "Polymarket has given up on Belgium's golden generation",
    analysis:
      "The gap between sportsbooks (2.7%) and Polymarket (1.9%) reflects the prediction " +
      "market's quicker reaction to Belgium's decline. After consecutive R16/group exits " +
      "in 2022 and Euro 2024, the golden generation narrative has expired. De Bruyne and " +
      "Lukaku are aging, and the replacement pipeline is thin. Our model should show a " +
      "declining Elo trajectory. Group G (Egypt, Iran, New Zealand) is very favorable, " +
      "which keeps the sportsbook price elevated, but won't help much in the knockouts.",
  },
  {
    team: "Croatia",
    category: "market_shift",
    headline: "Post-Modrić transition is priced in",
    analysis:
      "Croatia at 0.9-1.3% is a steep decline from their 2018 World Cup final and 2022 " +
      "semifinal status. The market has correctly priced in the end of the Modrić era. " +
      "Group L (England, Ghana, Panama) makes advancement likely but facing the bracket's " +
      "tougher side. Our model's Elo for Croatia may still carry residual momentum from " +
      "their 2018-2022 peaks — if we have them notably higher than 1%, that's a flag.",
  },
];

/** Get observations for a specific team */
export function getTeamObservations(team: string): MarketObservation[] {
  return MARKET_OBSERVATIONS.filter(o => o.team === team);
}

/** Get all observations by category */
export function getObservationsByCategory(
  category: MarketObservation["category"],
): MarketObservation[] {
  return MARKET_OBSERVATIONS.filter(o => o.category === category);
}
