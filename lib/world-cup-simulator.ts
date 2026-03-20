/**
 * World Cup 2026 Monte Carlo Simulator.
 *
 * Runs N iterations of the full tournament to produce:
 *  - Group finishing position probabilities
 *  - Bracket slot probabilities (who appears in each R32 match)
 *  - Advancement probabilities (prob of reaching each round)
 */

import { predictMatch, type TeamRatings } from "./prediction-engine";
import {
  GROUPS,
  UEFA_PLAYOFFS,
  FIFA_PLAYOFFS,
  R32_MATCHES,
  R16_MATCHES,
  QF_MATCHES,
  SF_MATCHES,
  FINAL_MATCH,
  THIRD_PLACE_MATCH,
  dbName,
  type PlayoffPath,
  type FifaPlayoffPath,
} from "./world-cup-data";

// --- Rating stats (set by runSimulation before use) ---
let ratingStats = {
  avgOff: 1500, avgDef: 1500, stdOff: 250, stdDef: 180,
};

// --- Host nation home advantage ---
// Group → host nation that plays at home in that group
const GROUP_HOST: Record<string, string> = {
  A: "Mexico",
  B: "Canada",
  D: "United States",
};

// Knockout match → host country (derived from MATCH_SCHEDULE venues)
// Mexico: Estadio Azteca (Mexico City), BBVA Stadium (Monterrey)
// Canada: BMO Field (Toronto), BC Place (Vancouver)
// All other knockout venues are in the US
const KNOCKOUT_MATCH_COUNTRY: Record<number, string> = {
  79: "Mexico",   // R32 — Mexico City
  85: "Mexico",   // R32 — Monterrey
  92: "Mexico",   // R16 — Mexico City
  84: "Canada",   // R32 — Toronto
  87: "Canada",   // R32 — Vancouver
  96: "Canada",   // R16 — Vancouver
  // All other matches (73-88 R32, 89-96 R16, 97-104 QF/SF/Final) are in the US
};

function getKnockoutHost(matchNum: number): string {
  return KNOCKOUT_MATCH_COUNTRY[matchNum] ?? "United States";
}

// --- Types ---

interface TeamData {
  name: string; // WC name
  dbName: string; // DB name
  slug: string;
  ratings: TeamRatings; // current offensive/defensive
}

interface GroupStanding {
  team: string; // WC name
  points: number;
  gf: number;
  ga: number;
  gd: number;
  wins: number;
  fairPlay: number; // lower is worse (simulated as random tiebreaker)
}

interface SimMatchResult {
  homeGoals: number;
  awayGoals: number;
  winner: string; // for knockout: who advances
}

// Aggregate counters
interface GroupCounter {
  finishPos: [number, number, number, number]; // count of 1st,2nd,3rd,4th
  totalPoints: number;
  totalGD: number;
  advanceCount: number;
}

interface AdvancementCounter {
  qualify: number; // for playoff teams: made the tournament
  groupStage: number; // participated in group stage
  r32: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  champion: number;
}

// --- Score Sampling ---

/**
 * Sample a scoreline from the prediction model's score matrix.
 */
function sampleScore(
  homeRatings: TeamRatings,
  awayRatings: TeamRatings,
  neutralVenue: boolean,
  matchImportance: "TOURNAMENT_GROUP" | "TOURNAMENT_KNOCKOUT" = "TOURNAMENT_GROUP"
): { homeGoals: number; awayGoals: number } {
  const pred = predictMatch({
    homeTeam: homeRatings,
    awayTeam: awayRatings,
    neutralVenue,
    matchImportance,
    avgOffensive: ratingStats.avgOff,
    avgDefensive: ratingStats.avgDef,
    stdOffensive: ratingStats.stdOff,
    stdDefensive: ratingStats.stdDef,
  });

  const r = Math.random();
  let cumulative = 0;
  for (let h = 0; h < pred.scoreMatrix.length; h++) {
    for (let a = 0; a < pred.scoreMatrix[h].length; a++) {
      cumulative += pred.scoreMatrix[h][a];
      if (r <= cumulative) {
        return { homeGoals: h, awayGoals: a };
      }
    }
  }
  return { homeGoals: 0, awayGoals: 0 };
}

/**
 * Simulate a knockout match (must produce a winner).
 * If drawn after 90 min, goes to extra time, then penalties.
 *
 * When a host nation is playing at home, pass neutralVenue=false
 * and put the host as the "home" team (first argument).
 */
function simulateKnockoutMatch(
  homeRatings: TeamRatings,
  awayRatings: TeamRatings,
  homeName: string,
  awayName: string,
  neutralVenue = true
): string {
  const { homeGoals, awayGoals } = sampleScore(homeRatings, awayRatings, neutralVenue, "TOURNAMENT_KNOCKOUT");
  if (homeGoals > awayGoals) return homeName;
  if (awayGoals > homeGoals) return awayName;

  // Extra time: ~30 min with reduced scoring. Empirically ~0.27x of 90 min
  // rate in World Cups (fatigue + tactical conservatism).
  const etPred = predictMatch({
    homeTeam: homeRatings,
    awayTeam: awayRatings,
    neutralVenue,
    matchImportance: "TOURNAMENT_KNOCKOUT",
    avgOffensive: ratingStats.avgOff,
    avgDefensive: ratingStats.avgDef,
    stdOffensive: ratingStats.stdOff,
    stdDefensive: ratingStats.stdDef,
  });
  const etHomeGoals = sampleFromPoisson(etPred.homeExpectedGoals * 0.27);
  const etAwayGoals = sampleFromPoisson(etPred.awayExpectedGoals * 0.27);
  if (etHomeGoals > etAwayGoals) return homeName;
  if (etAwayGoals > etHomeGoals) return awayName;

  // Penalties: higher-rated teams have a meaningful edge — better penalty
  // takers, better goalkeepers, more composure under pressure.
  // Research shows ~58% win rate for the stronger team in WC shootouts.
  // Sigmoid: ±150 Elo gap → ~8% swing (range: ~42% to ~58% for "home").
  const homeOverall = (homeRatings.offensive + (3000 - homeRatings.defensive)) / 2;
  const awayOverall = (awayRatings.offensive + (3000 - awayRatings.defensive)) / 2;
  const ratingGap = homeOverall - awayOverall;
  const qualityEdge = 0.16 / (1 + Math.exp(-ratingGap / 150)) - 0.08;
  const crowdEdge = neutralVenue ? 0.0 : 0.04;
  const penaltyHomeProb = 0.50 + qualityEdge + crowdEdge;
  return Math.random() < penaltyHomeProb ? homeName : awayName;
}

function sampleFromPoisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// --- Playoff Simulation ---

function simulateUefaPlayoff(
  path: PlayoffPath,
  teamMap: Map<string, TeamData>
): string {
  const s1Home = teamMap.get(dbName(path.semi1[0]))!;
  const s1Away = teamMap.get(dbName(path.semi1[1]))!;
  const s2Home = teamMap.get(dbName(path.semi2[0]))!;
  const s2Away = teamMap.get(dbName(path.semi2[1]))!;

  const semi1Winner = simulateKnockoutMatch(
    s1Home.ratings, s1Away.ratings, path.semi1[0], path.semi1[1]
  );
  const semi2Winner = simulateKnockoutMatch(
    s2Home.ratings, s2Away.ratings, path.semi2[0], path.semi2[1]
  );

  const finalHome = teamMap.get(dbName(semi1Winner))!;
  const finalAway = teamMap.get(dbName(semi2Winner))!;
  return simulateKnockoutMatch(
    finalHome.ratings, finalAway.ratings, semi1Winner, semi2Winner
  );
}

function simulateFifaPlayoff(
  path: FifaPlayoffPath,
  teamMap: Map<string, TeamData>
): string {
  const s1 = teamMap.get(dbName(path.semi[0]))!;
  const s2 = teamMap.get(dbName(path.semi[1]))!;

  const semiWinner = simulateKnockoutMatch(
    s1.ratings, s2.ratings, path.semi[0], path.semi[1]
  );

  const finalHome = teamMap.get(dbName(path.finalOpponent))!;
  const finalAway = teamMap.get(dbName(semiWinner))!;
  return simulateKnockoutMatch(
    finalHome.ratings, finalAway.ratings, path.finalOpponent, semiWinner
  );
}

// --- Group Stage Simulation ---

function simulateGroupStage(
  groupTeams: string[],
  groupId: string,
  teamMap: Map<string, TeamData>
): GroupStanding[] {
  const standings: GroupStanding[] = groupTeams.map((t) => ({
    team: t,
    points: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    wins: 0,
    fairPlay: Math.random() * 10, // random tiebreaker proxy
  }));

  // Which host plays at home in this group?
  const hostTeam = GROUP_HOST[groupId];

  // Round-robin: 6 matches per group
  for (let i = 0; i < groupTeams.length; i++) {
    for (let j = i + 1; j < groupTeams.length; j++) {
      const teamI = groupTeams[i];
      const teamJ = groupTeams[j];

      // Determine if a host nation is playing at home
      let homeIdx = i;
      let awayIdx = j;
      let neutralVenue = true;

      if (hostTeam === teamI) {
        // Host is team i → they get home advantage
        homeIdx = i;
        awayIdx = j;
        neutralVenue = false;
      } else if (hostTeam === teamJ) {
        // Host is team j → swap so host is "home"
        homeIdx = j;
        awayIdx = i;
        neutralVenue = false;
      }

      const home = teamMap.get(dbName(groupTeams[homeIdx]))!;
      const away = teamMap.get(dbName(groupTeams[awayIdx]))!;
      const { homeGoals, awayGoals } = sampleScore(
        home.ratings, away.ratings, neutralVenue
      );

      standings[homeIdx].gf += homeGoals;
      standings[homeIdx].ga += awayGoals;
      standings[awayIdx].gf += awayGoals;
      standings[awayIdx].ga += homeGoals;

      if (homeGoals > awayGoals) {
        standings[homeIdx].points += 3;
        standings[homeIdx].wins++;
      } else if (homeGoals < awayGoals) {
        standings[awayIdx].points += 3;
        standings[awayIdx].wins++;
      } else {
        standings[homeIdx].points += 1;
        standings[awayIdx].points += 1;
      }
    }
  }

  // Calculate GD
  for (const s of standings) {
    s.gd = s.gf - s.ga;
  }

  // Sort: points → GD → GF → fair play (random)
  standings.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.gd !== b.gd) return b.gd - a.gd;
    if (a.gf !== b.gf) return b.gf - a.gf;
    return a.fairPlay - b.fairPlay;
  });

  return standings;
}

// --- 3rd Place Assignment ---

/**
 * Given the 8 qualifying 3rd-place teams (by group letter),
 * assign them to the 8 R32 bracket slots.
 *
 * Uses a greedy constraint-satisfaction approach that respects
 * the eligible group sets for each R32 match slot.
 */
function assign3rdPlaceTeams(
  qualifying3rdGroups: string[]
): Map<number, string> {
  // R32 matches that need a 3rd-place team
  const slots = R32_MATCHES.filter((m) => m.eligible3rd);
  const assignment = new Map<number, string>();
  const assignedGroups = new Set<string>();
  const qSet = new Set(qualifying3rdGroups);

  // Sort slots by most constrained first (fewest eligible groups that actually qualify)
  const slotPriority = slots
    .map((s) => ({
      ...s,
      eligibleCount: s.eligible3rd!.filter((g) => qSet.has(g)).length,
    }))
    .sort((a, b) => a.eligibleCount - b.eligibleCount);

  for (const slot of slotPriority) {
    const eligible = slot.eligible3rd!.filter(
      (g) => qSet.has(g) && !assignedGroups.has(g)
    );
    if (eligible.length === 0) {
      // Fallback: pick any unassigned qualifying group
      const fallback = qualifying3rdGroups.find((g) => !assignedGroups.has(g));
      if (fallback) {
        assignment.set(slot.num, fallback);
        assignedGroups.add(fallback);
      }
      continue;
    }
    // Pick a random eligible group
    const chosen = eligible[Math.floor(Math.random() * eligible.length)];
    assignment.set(slot.num, chosen);
    assignedGroups.add(chosen);
  }

  return assignment;
}

// --- Main Simulator ---

export interface SimulationResults {
  iterations: number;
  groupOdds: Record<string, {
    group: string;
    name: string;
    probFirst: number;
    probSecond: number;
    probThird: number;
    probFourth: number;
    probAdvance: number;
    avgPoints: number;
    avgGD: number;
  }>;
  bracketOdds: Record<string, {
    description: string;
    teams: Record<string, number>; // slug → probability
  }>;
  advancementOdds: Record<string, {
    name: string;
    group: string;
    probQualify: number;
    probGroupStage: number;
    probR32: number;
    probR16: number;
    probQF: number;
    probSF: number;
    probFinal: number;
    probChampion: number;
  }>;
  qualifierOdds: Record<string, {
    description: string;
    teams: Record<string, number>; // name → probability
  }>;
}

export function setRatingStats(stats: {
  avgOff: number; avgDef: number; stdOff: number; stdDef: number;
}) {
  ratingStats = stats;
}

export function runSimulation(
  teamDataMap: Map<string, TeamData>,
  iterations: number
): SimulationResults {
  // Initialize counters
  const groupCounters = new Map<string, GroupCounter>();
  const advCounters = new Map<string, AdvancementCounter>();
  const bracketCounters = new Map<string, Map<string, number>>(); // matchNum → teamSlug → count
  const qualifierCounters = new Map<string, Map<string, number>>(); // path → teamName → count

  // Team → group mapping (resolved per iteration for playoff teams)
  const teamGroups = new Map<string, string>();

  // Initialize qualifier counters
  for (const [pathId] of Object.entries(UEFA_PLAYOFFS)) {
    qualifierCounters.set(`UEFA_${pathId}`, new Map());
  }
  for (const [pathId] of Object.entries(FIFA_PLAYOFFS)) {
    qualifierCounters.set(`FIFA_${pathId}`, new Map());
  }

  // Initialize bracket counters for each R32 match
  for (const m of R32_MATCHES) {
    bracketCounters.set(String(m.num), new Map());
  }

  // All possible team slugs
  const allTeamSlugs = new Set<string>();
  for (const [, td] of teamDataMap) {
    allTeamSlugs.add(td.slug);
  }

  function getOrCreateGroupCounter(slug: string): GroupCounter {
    let c = groupCounters.get(slug);
    if (!c) {
      c = { finishPos: [0, 0, 0, 0], totalPoints: 0, totalGD: 0, advanceCount: 0 };
      groupCounters.set(slug, c);
    }
    return c;
  }

  function getOrCreateAdvCounter(slug: string): AdvancementCounter {
    let c = advCounters.get(slug);
    if (!c) {
      c = { qualify: 0, groupStage: 0, r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0 };
      advCounters.set(slug, c);
    }
    return c;
  }

  // --- Main simulation loop ---
  for (let iter = 0; iter < iterations; iter++) {
    if (iter % 1000 === 0 && iter > 0) {
      console.log(`  Iteration ${iter}/${iterations}...`);
    }

    // 1. Resolve playoffs
    const playoffResults = new Map<string, string>(); // placeholder → winner WC name

    for (const [pathId, path] of Object.entries(UEFA_PLAYOFFS)) {
      const winner = simulateUefaPlayoff(path, teamDataMap);
      playoffResults.set(path.placeholder, winner);
      const qc = qualifierCounters.get(`UEFA_${pathId}`)!;
      qc.set(winner, (qc.get(winner) ?? 0) + 1);
    }

    for (const [pathId, path] of Object.entries(FIFA_PLAYOFFS)) {
      const winner = simulateFifaPlayoff(path, teamDataMap);
      playoffResults.set(path.placeholder, winner);
      const qc = qualifierCounters.get(`FIFA_${pathId}`)!;
      qc.set(winner, (qc.get(winner) ?? 0) + 1);
    }

    // Mark all 48 teams that qualified
    const qualified48 = new Set<string>();
    teamGroups.clear();

    // 2. Simulate group stage
    const groupResults = new Map<string, GroupStanding[]>();

    for (const [groupId, groupTeams] of Object.entries(GROUPS)) {
      // Resolve placeholder teams
      const resolved = groupTeams.map((t) => {
        if (t.startsWith("__")) return playoffResults.get(t)!;
        return t;
      });

      for (const t of resolved) {
        qualified48.add(t);
        teamGroups.set(t, groupId);
      }

      const standings = simulateGroupStage(resolved, groupId, teamDataMap);
      groupResults.set(groupId, standings);

      // Record group positions
      for (let pos = 0; pos < standings.length; pos++) {
        const team = standings[pos].team;
        const td = teamDataMap.get(dbName(team))!;
        const gc = getOrCreateGroupCounter(td.slug);
        gc.finishPos[pos]++;
        gc.totalPoints += standings[pos].points;
        gc.totalGD += standings[pos].gd;
      }
    }

    // Mark playoff teams' qualification
    for (const [, winner] of playoffResults) {
      const td = teamDataMap.get(dbName(winner))!;
      getOrCreateAdvCounter(td.slug).qualify++;
    }
    // Confirmed teams always qualify
    for (const t of qualified48) {
      if (!playoffResults.has(t)) {
        // This is a confirmed team
        const td = teamDataMap.get(dbName(t));
        if (td) getOrCreateAdvCounter(td.slug).qualify++;
      }
    }
    // All 48 are in the group stage
    for (const t of qualified48) {
      const td = teamDataMap.get(dbName(t));
      if (td) getOrCreateAdvCounter(td.slug).groupStage++;
    }

    // 3. Determine which teams advance
    // Top 2 from each group + best 8 third-place teams
    const advancingTeams = new Map<string, string>(); // "1A","2A","3A" → team name

    const thirdPlaceTeams: Array<GroupStanding & { group: string }> = [];

    for (const [groupId, standings] of groupResults) {
      advancingTeams.set(`1${groupId}`, standings[0].team);
      advancingTeams.set(`2${groupId}`, standings[1].team);
      thirdPlaceTeams.push({ ...standings[2], group: groupId });
    }

    // Rank 3rd-place teams
    thirdPlaceTeams.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.gd !== b.gd) return b.gd - a.gd;
      if (a.gf !== b.gf) return b.gf - a.gf;
      return Math.random() - 0.5; // tiebreaker
    });

    const qualifying3rd = thirdPlaceTeams.slice(0, 8);
    for (const t of qualifying3rd) {
      advancingTeams.set(`3${t.group}`, t.team);
    }

    // Record group advancement
    for (const [, teamName] of advancingTeams) {
      const td = teamDataMap.get(dbName(teamName));
      if (td) {
        getOrCreateGroupCounter(td.slug).advanceCount++;
      }
    }

    // 4. Assign 3rd-place teams to R32 bracket
    const qualifying3rdGroups = qualifying3rd.map((t) => t.group);
    const thirdAssignment = assign3rdPlaceTeams(qualifying3rdGroups);

    // 5. Simulate knockout rounds
    const matchWinners = new Map<number, string>(); // matchNum → winner team name
    const matchLosers = new Map<number, string>();

    // Helper: simulate a knockout match with venue-based host advantage.
    // Each knockout match has a fixed venue. If a host nation is playing
    // in their own country, they get home advantage.
    function koMatch(name1: string, name2: string, matchNum: number): string {
      const r1 = teamDataMap.get(dbName(name1))!.ratings;
      const r2 = teamDataMap.get(dbName(name2))!.ratings;

      const hostCountry = getKnockoutHost(matchNum);
      const hostPlaying = name1 === hostCountry || name2 === hostCountry;

      if (hostPlaying) {
        const [homeName, awayName] = name1 === hostCountry ? [name1, name2] : [name2, name1];
        const homeR = teamDataMap.get(dbName(homeName))!.ratings;
        const awayR = teamDataMap.get(dbName(awayName))!.ratings;
        return simulateKnockoutMatch(homeR, awayR, homeName, awayName, false);
      }

      return simulateKnockoutMatch(r1, r2, name1, name2, true);
    }

    // R32
    for (const m of R32_MATCHES) {
      let homeName: string;
      let awayName: string;

      // Resolve home
      homeName = advancingTeams.get(m.home)!;

      // Resolve away
      if (m.away === "3rd") {
        const assignedGroup = thirdAssignment.get(m.num);
        awayName = advancingTeams.get(`3${assignedGroup}`)!;
      } else {
        awayName = advancingTeams.get(m.away)!;
      }

      if (!homeName || !awayName) continue;

      // Record bracket appearance
      const bc = bracketCounters.get(String(m.num))!;
      const homeSlug = teamDataMap.get(dbName(homeName))?.slug;
      const awaySlug = teamDataMap.get(dbName(awayName))?.slug;
      if (homeSlug) bc.set(homeSlug, (bc.get(homeSlug) ?? 0) + 1);
      if (awaySlug) bc.set(awaySlug, (bc.get(awaySlug) ?? 0) + 1);

      // Mark R32 advancement
      const homeTd = teamDataMap.get(dbName(homeName));
      const awayTd = teamDataMap.get(dbName(awayName));
      if (homeTd) getOrCreateAdvCounter(homeTd.slug).r32++;
      if (awayTd) getOrCreateAdvCounter(awayTd.slug).r32++;

      // Simulate with venue-based host advantage
      const winner = koMatch(homeName, awayName, m.num);
      const loser = winner === homeName ? awayName : homeName;
      matchWinners.set(m.num, winner);
      matchLosers.set(m.num, loser);
    }

    // R16
    for (const m of R16_MATCHES) {
      const homeName = matchWinners.get(m.home);
      const awayName = matchWinners.get(m.away);
      if (!homeName || !awayName) continue;

      const homeTd = teamDataMap.get(dbName(homeName));
      const awayTd = teamDataMap.get(dbName(awayName));
      if (homeTd) getOrCreateAdvCounter(homeTd.slug).r16++;
      if (awayTd) getOrCreateAdvCounter(awayTd.slug).r16++;

      const winner = koMatch(homeName, awayName, m.num);
      matchWinners.set(m.num, winner);
      matchLosers.set(m.num, winner === homeName ? awayName : homeName);
    }

    // QF
    for (const m of QF_MATCHES) {
      const homeName = matchWinners.get(m.home);
      const awayName = matchWinners.get(m.away);
      if (!homeName || !awayName) continue;

      const homeTd = teamDataMap.get(dbName(homeName));
      const awayTd = teamDataMap.get(dbName(awayName));
      if (homeTd) getOrCreateAdvCounter(homeTd.slug).qf++;
      if (awayTd) getOrCreateAdvCounter(awayTd.slug).qf++;

      const winner = koMatch(homeName, awayName, m.num);
      matchWinners.set(m.num, winner);
      matchLosers.set(m.num, winner === homeName ? awayName : homeName);
    }

    // SF
    for (const m of SF_MATCHES) {
      const homeName = matchWinners.get(m.home);
      const awayName = matchWinners.get(m.away);
      if (!homeName || !awayName) continue;

      const homeTd = teamDataMap.get(dbName(homeName));
      const awayTd = teamDataMap.get(dbName(awayName));
      if (homeTd) getOrCreateAdvCounter(homeTd.slug).sf++;
      if (awayTd) getOrCreateAdvCounter(awayTd.slug).sf++;

      const winner = koMatch(homeName, awayName, m.num);
      matchWinners.set(m.num, winner);
      matchLosers.set(m.num, winner === homeName ? awayName : homeName);
    }

    // Final
    {
      const homeName = matchWinners.get(FINAL_MATCH.home);
      const awayName = matchWinners.get(FINAL_MATCH.away);
      if (homeName && awayName) {
        const homeTd = teamDataMap.get(dbName(homeName));
        const awayTd = teamDataMap.get(dbName(awayName));
        if (homeTd) getOrCreateAdvCounter(homeTd.slug).final++;
        if (awayTd) getOrCreateAdvCounter(awayTd.slug).final++;

        const winner = koMatch(homeName, awayName, FINAL_MATCH.num);
        const td = teamDataMap.get(dbName(winner));
        if (td) getOrCreateAdvCounter(td.slug).champion++;
      }
    }
  }

  // --- Aggregate results ---
  const groupOdds: SimulationResults["groupOdds"] = {};
  const advancementOdds: SimulationResults["advancementOdds"] = {};
  const bracketOddsResult: SimulationResults["bracketOdds"] = {};
  const qualifierOddsResult: SimulationResults["qualifierOdds"] = {};

  // Group odds
  for (const [slug, counter] of groupCounters) {
    // Find the WC name and group for this slug
    let wcName = "";
    let group = "";
    for (const [g, teams] of Object.entries(GROUPS)) {
      for (const t of teams) {
        if (t.startsWith("__")) continue;
        const td = teamDataMap.get(dbName(t));
        if (td && td.slug === slug) {
          wcName = t;
          group = g;
        }
      }
    }
    // Also check playoff teams
    if (!wcName) {
      for (const td of teamDataMap.values()) {
        if (td.slug === slug) {
          wcName = td.name;
          break;
        }
      }
    }

    // For playoff teams, find group from qualifier
    if (!group) {
      for (const [, path] of Object.entries(UEFA_PLAYOFFS)) {
        for (const team of [...path.semi1, ...path.semi2]) {
          const td = teamDataMap.get(dbName(team));
          if (td && td.slug === slug) group = path.targetGroup;
        }
      }
      for (const [, path] of Object.entries(FIFA_PLAYOFFS)) {
        for (const team of [...path.semi, path.finalOpponent]) {
          const td = teamDataMap.get(dbName(team));
          if (td && td.slug === slug) group = path.targetGroup;
        }
      }
    }

    const total = counter.finishPos.reduce((a, b) => a + b, 0);
    if (total === 0) continue;

    groupOdds[slug] = {
      group,
      name: wcName || slug,
      probFirst: counter.finishPos[0] / total,
      probSecond: counter.finishPos[1] / total,
      probThird: counter.finishPos[2] / total,
      probFourth: counter.finishPos[3] / total,
      probAdvance: counter.advanceCount / total,
      avgPoints: counter.totalPoints / total,
      avgGD: counter.totalGD / total,
    };
  }

  // Advancement odds
  for (const [slug, counter] of advCounters) {
    let name = slug;
    let group = "";
    for (const td of teamDataMap.values()) {
      if (td.slug === slug) { name = td.name; break; }
    }
    // Find group
    const go = groupOdds[slug];
    if (go) group = go.group;

    advancementOdds[slug] = {
      name,
      group,
      probQualify: counter.qualify / iterations,
      probGroupStage: counter.groupStage / iterations,
      probR32: counter.r32 / iterations,
      probR16: counter.r16 / iterations,
      probQF: counter.qf / iterations,
      probSF: counter.sf / iterations,
      probFinal: counter.final / iterations,
      probChampion: counter.champion / iterations,
    };
  }

  // Bracket odds (R32 matches)
  const r32Descriptions: Record<number, string> = {
    73: "2nd Grp A vs 2nd Grp B",
    74: "1st Grp E vs 3rd Place",
    75: "1st Grp F vs 2nd Grp C",
    76: "1st Grp C vs 2nd Grp F",
    77: "1st Grp I vs 3rd Place",
    78: "2nd Grp E vs 2nd Grp I",
    79: "1st Grp A vs 3rd Place",
    80: "1st Grp L vs 3rd Place",
    81: "1st Grp D vs 3rd Place",
    82: "1st Grp G vs 3rd Place",
    83: "2nd Grp K vs 2nd Grp L",
    84: "1st Grp H vs 2nd Grp J",
    85: "1st Grp B vs 3rd Place",
    86: "1st Grp J vs 2nd Grp H",
    87: "1st Grp K vs 3rd Place",
    88: "2nd Grp D vs 2nd Grp G",
  };

  for (const [matchNum, counter] of bracketCounters) {
    const teams: Record<string, number> = {};
    for (const [slug, count] of counter) {
      teams[slug] = count / iterations;
    }
    bracketOddsResult[matchNum] = {
      description: r32Descriptions[parseInt(matchNum)] ?? `Match ${matchNum}`,
      teams,
    };
  }

  // Qualifier odds
  for (const [pathId, counter] of qualifierCounters) {
    const teams: Record<string, number> = {};
    for (const [name, count] of counter) {
      teams[name] = count / iterations;
    }
    const description = pathId.startsWith("UEFA")
      ? `UEFA Playoff Path ${pathId.split("_")[1]}`
      : `FIFA Intercontinental Playoff ${pathId.split("_")[1]}`;
    qualifierOddsResult[pathId] = { description, teams };
  }

  return {
    iterations,
    groupOdds,
    bracketOdds: bracketOddsResult,
    advancementOdds,
    qualifierOdds: qualifierOddsResult,
  };
}
