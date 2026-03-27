/**
 * Sportsbook & prediction market consensus odds for the 2026 FIFA World Cup.
 *
 * Updated: March 27, 2026
 *
 * Two independent sources are maintained:
 *  1. Traditional sportsbooks (NBC Sports / DraftKings / FanDuel / FOX Sports)
 *  2. Polymarket prediction market ($389M+ traded volume)
 *
 * Raw odds are converted to implied probabilities and normalized to sum to 1.
 */

// --- Source 1: Traditional sportsbooks (American odds → implied probability) ---
// Source: NBC Sports aggregation of DraftKings, FanDuel, BetMGM — March 27, 2026
// Implied probability = 100 / (americanOdds + 100), then normalized
const SPORTSBOOK_AMERICAN_ODDS: Record<string, number> = {
  "Spain": 450,
  "England": 550,
  "France": 750,
  "Brazil": 750,
  "Argentina": 800,
  "Portugal": 1100,
  "Germany": 1200,
  "Netherlands": 2000,
  "Norway": 2500,
  "Belgium": 3000,
  "Italy": 3000,          // not yet qualified (UEFA playoff final March 31)
  "Colombia": 4000,
  "Morocco": 6000,
  "United States": 6500,
  "Uruguay": 6500,
  "Mexico": 7000,
  "Ecuador": 8000,
  "Switzerland": 9000,
  "Croatia": 9000,
  "Japan": 9000,
  "Senegal": 10000,
  "Denmark": 12000,       // not yet qualified (UEFA playoff final March 31)
  "Austria": 15000,
  "Paraguay": 17000,
  "Turkey": 20000,        // not yet qualified (UEFA playoff final March 31)
  "Scotland": 20000,
  "Canada": 20000,
  "Ivory Coast": 25000,
  "Sweden": 25000,        // not yet qualified (UEFA playoff final March 31)
  "Poland": 25000,        // not yet qualified (UEFA playoff final March 31)
  "Egypt": 30000,
  "South Korea": 35000,
  "Algeria": 35000,
  "Ghana": 35000,
  "Czech Republic": 40000, // not yet qualified (UEFA playoff final March 31)
  "Bolivia": 45000,       // not yet qualified (FIFA playoff final March 31)
  "Australia": 45000,
  "Tunisia": 50000,
  "Iran": 50000,
  "DR Congo": 70000,      // awaiting FIFA playoff final March 31
  "South Africa": 80000,
  "Kosovo": 100000,       // not yet qualified (UEFA playoff final March 31)
  "Cape Verde": 100000,
  "Saudi Arabia": 100000,
  "Qatar": 100000,
  "Panama": 100000,
  "New Zealand": 100000,
  "Jamaica": 100000,      // awaiting FIFA playoff final March 31
  "Iraq": 100000,         // awaiting FIFA playoff final March 31
  "Haiti": 150000,
  "Uzbekistan": 150000,
  "Curaçao": 150000,
  "Jordan": 150000,
};

// Convert American odds to implied probabilities, then normalize
function americanToImplied(odds: number): number {
  return 100 / (odds + 100);
}

function normalizeOdds(raw: Record<string, number>): Record<string, number> {
  const total = Object.values(raw).reduce((s, v) => s + v, 0);
  const result: Record<string, number> = {};
  for (const [team, prob] of Object.entries(raw)) {
    result[team] = prob / total;
  }
  return result;
}

const sportsbookRaw: Record<string, number> = {};
for (const [team, odds] of Object.entries(SPORTSBOOK_AMERICAN_ODDS)) {
  sportsbookRaw[team] = americanToImplied(odds);
}

export const SPORTSBOOK_ODDS = normalizeOdds(sportsbookRaw);

// --- Source 2: Polymarket prediction market ---
// Source: Polymarket "2026 FIFA World Cup Winner" — March 27, 2026
// $389.9M total traded volume. Raw probabilities as displayed.
const POLYMARKET_RAW: Record<string, number> = {
  "Spain": 0.158,
  "England": 0.128,
  "France": 0.109,
  "Argentina": 0.101,
  "Brazil": 0.086,
  "Portugal": 0.069,
  "Germany": 0.054,
  "Netherlands": 0.033,
  "Norway": 0.033,
  "Italy": 0.027,
  "Belgium": 0.019,
  "Colombia": 0.017,
  "United States": 0.017,
  "Morocco": 0.017,
  "Uruguay": 0.015,
  "Japan": 0.015,
  "Croatia": 0.013,
  "Mexico": 0.012,
  "Ecuador": 0.009,
  "Switzerland": 0.008,
  "Senegal": 0.008,
  "Canada": 0.006,
  "Austria": 0.006,
  "South Korea": 0.004,
  "Paraguay": 0.004,
  "Ivory Coast": 0.004,
  "Algeria": 0.003,
  "Scotland": 0.003,
  "Australia": 0.003,
  "Saudi Arabia": 0.003,
  "Egypt": 0.003,
  "Jordan": 0.002,
  "Ghana": 0.002,
  "Tunisia": 0.002,
  "South Africa": 0.002,
  "Cape Verde": 0.002,
  "Qatar": 0.002,
  "New Zealand": 0.001,
  "Haiti": 0.001,
  "Curaçao": 0.001,
  "Iran": 0.001,
  "Uzbekistan": 0.001,
};

export const POLYMARKET_ODDS = normalizeOdds(POLYMARKET_RAW);

// --- Consensus: average of the two sources ---
// Where a team appears in only one source, use that source's value at half weight.
export function computeConsensusOdds(): Record<string, number> {
  const allTeams = new Set([
    ...Object.keys(SPORTSBOOK_ODDS),
    ...Object.keys(POLYMARKET_ODDS),
  ]);

  const raw: Record<string, number> = {};
  for (const team of allTeams) {
    const sb = SPORTSBOOK_ODDS[team];
    const pm = POLYMARKET_ODDS[team];
    if (sb !== undefined && pm !== undefined) {
      raw[team] = (sb + pm) / 2;
    } else {
      raw[team] = (sb ?? pm ?? 0) / 2;
    }
  }

  return normalizeOdds(raw);
}

export const CONSENSUS_ODDS = computeConsensusOdds();

// --- Market metadata ---
export const MARKET_SOURCES = {
  sportsbook: {
    name: "Sportsbooks (DraftKings / FanDuel / BetMGM)",
    updated: "2026-03-27",
    source: "NBC Sports aggregation",
  },
  polymarket: {
    name: "Polymarket Prediction Market",
    updated: "2026-03-27",
    volume: "$389.9M",
    source: "polymarket.com/event/2026-fifa-world-cup-winner",
  },
};

// --- Helpers ---

/** Get the top N teams by consensus probability */
export function topTeams(n: number = 20): Array<{
  team: string;
  consensus: number;
  sportsbook: number;
  polymarket: number;
  sourceDivergence: number;
}> {
  return Object.entries(CONSENSUS_ODDS)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([team, consensus]) => {
      const sb = SPORTSBOOK_ODDS[team] ?? 0;
      const pm = POLYMARKET_ODDS[team] ?? 0;
      return {
        team,
        consensus,
        sportsbook: sb,
        polymarket: pm,
        sourceDivergence: Math.abs(sb - pm),
      };
    });
}
