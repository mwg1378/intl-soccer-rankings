/**
 * Seed script: Load historical match data and compute Elo ratings.
 *
 * Usage: npx tsx scripts/seed.ts
 *
 * Steps:
 *  1. Parse results.csv and shootouts.csv
 *  2. Create Team records for all unique teams
 *  3. Process matches chronologically through the Elo engine (from 1998)
 *  4. Compute rankings and create snapshots (displayed from 2002+)
 *
 * Expected runtime: ~1-2 minutes
 */

import "dotenv/config";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  calculateElo,
  overallRating,
  combinedRating,
  applyMeanReversion,
  applyWinRateReversion,
  applyHomeAwayReversion,
  getWinRate,
  computeHomeAdvantage,
  type TeamElo,
  type WinRateState,
  type HomeAwayState,
} from "../lib/ranking-engine";
import { yearToEdition } from "../lib/razali-engine";
import {
  updatePiRatings,
  applyPiMeanReversion,
  piOverall,
  DEFAULT_PI_PARAMS,
  type PiTeamRatings,
} from "../lib/pi-ratings";
import {
  prepareMatchesForSolver,
  solveBradleyTerry,
  type RawMatchInput,
} from "../lib/bt-engine";
import {
  processMatch as processGlickoMatch,
  initGlicko,
  glickoToDisplay,
  rdToDisplay,
  applyGlickoReversion,
  type GlickoState,
} from "../lib/glicko2-engine";
import {
  processBerrarMatch,
  initBerrar,
  applyBerrarReversion,
  type BerrarState,
} from "../lib/berrar-engine";
import {
  processOpMatch,
  initOp,
  opToDisplay,
  applyOpReversion,
  type OpState,
} from "../lib/ordered-probit-engine";
import {
  updateIwPiRatings,
  initIwPi,
  iwPiOverall,
  applyIwPiMeanReversion,
  type IwPiTeamRatings,
} from "../lib/iw-pi-engine";
import {
  processMoEloMatch,
  initMoElo,
  moEloOverall,
  applyMoEloReversion,
  type MoEloState,
} from "../lib/mo-elo-engine";
import {
  gridOptimizedRating,
  top3EqualRating,
  backtestedMarketRating,
} from "../lib/composite-engines";

// --- Config ---
const START_DATE = "2014-01-01"; // Extended back to 2014 for more match history
const DISPLAY_DATE = "2014-06-01"; // Rankings displayed from 2014 World Cup
const MIN_MATCHES_FOR_RANKING = 20; // Teams with fewer matches get rank 0 (unranked)
const SNAPSHOT_INTERVAL_DAYS = 30; // Create ranking snapshots monthly
const BATCH_SIZE = 500; // DB batch size for inserts

// --- Initialize Prisma ---
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// --- Tournament → MatchImportance mapping ---
function tournamentToImportance(tournament: string): string {
  const t = tournament.toLowerCase();
  if (t.includes("friendly")) return "FRIENDLY";
  if (t.includes("nations league")) return "NATIONS_LEAGUE";
  if (
    t.includes("qualification") ||
    t.includes("qualif") ||
    t.includes("qualifier")
  )
    return "QUALIFIER";
  if (
    t.includes("world cup") ||
    t.includes("euro") ||
    t.includes("copa am") ||
    t.includes("african cup") ||
    t.includes("asian cup") ||
    t.includes("gold cup") ||
    t.includes("concacaf")
  ) {
    return "TOURNAMENT_GROUP"; // We don't have stage info in CSV, default to group
  }
  // Regional tournaments and cups
  if (
    t.includes("cup") ||
    t.includes("championship") ||
    t.includes("tournament")
  )
    return "TOURNAMENT_GROUP";
  return "FRIENDLY";
}

// --- Slug generation ---
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- FIFA code guesses (common ones) ---
const KNOWN_CODES: Record<string, string> = {
  Argentina: "ARG", Australia: "AUS", Austria: "AUT", Belgium: "BEL",
  Bolivia: "BOL", Brazil: "BRA", Cameroon: "CMR", Canada: "CAN",
  Chile: "CHI", China: "CHN", Colombia: "COL", "Costa Rica": "CRC",
  Croatia: "CRO", "Czech Republic": "CZE", Czechia: "CZE", Denmark: "DEN",
  Ecuador: "ECU", Egypt: "EGY", England: "ENG", Finland: "FIN",
  France: "FRA", Germany: "GER", Ghana: "GHA", Greece: "GRE",
  Honduras: "HON", Hungary: "HUN", Iceland: "ISL", India: "IND",
  Indonesia: "IDN", Iran: "IRN", Iraq: "IRQ", Ireland: "IRL",
  Israel: "ISR", Italy: "ITA", "Ivory Coast": "CIV",
  "Côte d'Ivoire": "CIV", Jamaica: "JAM", Japan: "JPN",
  "Korea Republic": "KOR", "South Korea": "KOR",
  "Korea DPR": "PRK", "North Korea": "PRK",
  Mexico: "MEX", Morocco: "MAR", Netherlands: "NED",
  "New Zealand": "NZL", Nigeria: "NGA", Norway: "NOR",
  Panama: "PAN", Paraguay: "PAR", Peru: "PER", Poland: "POL",
  Portugal: "POR", Qatar: "QAT", Romania: "ROU", Russia: "RUS",
  "Saudi Arabia": "KSA", Scotland: "SCO", Senegal: "SEN",
  Serbia: "SRB", Slovakia: "SVK", Slovenia: "SVN",
  "South Africa": "RSA", Spain: "ESP", Sweden: "SWE",
  Switzerland: "SUI", Thailand: "THA", Tunisia: "TUN",
  Turkey: "TUR", Ukraine: "UKR", "United States": "USA",
  Uruguay: "URU", Uzbekistan: "UZB", Venezuela: "VEN",
  Vietnam: "VNM", Wales: "WAL", Algeria: "ALG", Angola: "ANG",
  "Bosnia and Herzegovina": "BIH", "Burkina Faso": "BFA",
  "Cape Verde": "CPV", "China PR": "CHN",
  "Congo DR": "COD", "DR Congo": "COD",
  "El Salvador": "SLV", Ethiopia: "ETH", Gabon: "GAB",
  Georgia: "GEO", Guatemala: "GUA", Guinea: "GUI",
  Haiti: "HAI", Kenya: "KEN", Kuwait: "KUW",
  Lebanon: "LBN", Libya: "LBY", Luxembourg: "LUX",
  Mali: "MLI", Mozambique: "MOZ", Myanmar: "MYA",
  Namibia: "NAM", Niger: "NIG", Oman: "OMA",
  Palestine: "PLE", Philippines: "PHI",
  "Republic of Ireland": "IRL",
  Rwanda: "RWA", "Sierra Leone": "SLE",
  Singapore: "SIN", Sudan: "SDN", Syria: "SYR",
  Tanzania: "TAN", Togo: "TOG", "Trinidad and Tobago": "TRI",
  Uganda: "UGA", "United Arab Emirates": "UAE",
  Yemen: "YEM", Zambia: "ZAM", Zimbabwe: "ZIM",
  Montenegro: "MNE", "North Macedonia": "MKD",
  Kosovo: "KVX", Curaçao: "CUW", Suriname: "SUR",
  Malta: "MLT", Cyprus: "CYP", Estonia: "EST",
  Latvia: "LVA", Lithuania: "LTU", Albania: "ALB",
  Armenia: "ARM", Azerbaijan: "AZE", Belarus: "BLR",
  "Faroe Islands": "FRO", Gibraltar: "GIB",
  Kazakhstan: "KAZ", Liechtenstein: "LIE",
  Moldova: "MDA", "San Marino": "SMR",
  Andorra: "AND", Bahrain: "BHR",
  Bangladesh: "BAN", Benin: "BEN",
  Bermuda: "BER", Bhutan: "BHU",
  Botswana: "BOT", "Central African Republic": "CTA",
  Chad: "CHA", Comoros: "COM", Congo: "CGO",
  Cuba: "CUB", Djibouti: "DJI",
  "Dominican Republic": "DOM", Eritrea: "ERI",
  Eswatini: "SWZ", Fiji: "FIJ",
  "French Guiana": "GUF", Gambia: "GAM",
  Grenada: "GRN", Guam: "GUM",
  "Guinea-Bissau": "GNB", Guyana: "GUY",
  "Hong Kong": "HKG", Jordan: "JOR",
  Kyrgyzstan: "KGZ", Laos: "LAO",
  Lesotho: "LES", Liberia: "LBR",
  "Macau": "MAC", Madagascar: "MAD",
  Malawi: "MWI", Malaysia: "MAS",
  Maldives: "MDV", Mauritania: "MTN",
  Mauritius: "MRI", Mongolia: "MNG",
  Nepal: "NEP", Nicaragua: "NCA",
  "Northern Ireland": "NIR",
  "Papua New Guinea": "PNG",
  "Puerto Rico": "PUR",
  "Réunion": "REU",
  Samoa: "SAM", "São Tomé and Príncipe": "STP",
  "Solomon Islands": "SOL",
  Somalia: "SOM", "South Sudan": "SSD",
  "Sri Lanka": "SRI", "St Kitts and Nevis": "SKN",
  "St Lucia": "LCA", "St Vincent and the Grenadines": "VIN",
  Tajikistan: "TJK", "Timor-Leste": "TLS",
  Tonga: "TGA", Turkmenistan: "TKM",
  Vanuatu: "VAN",
  "Chinese Taipei": "TPE", Taiwan: "TPE",
  Cambodia: "CAM",
};

// Confederation guesses based on common knowledge
function guessConfederation(name: string): string {
  const european = new Set([
    "England", "France", "Germany", "Spain", "Italy", "Netherlands", "Portugal",
    "Belgium", "Croatia", "Denmark", "Sweden", "Switzerland", "Austria",
    "Poland", "Czech Republic", "Czechia", "Romania", "Hungary", "Greece",
    "Scotland", "Wales", "Ireland", "Republic of Ireland", "Northern Ireland",
    "Norway", "Finland", "Iceland", "Turkey", "Ukraine", "Russia", "Serbia",
    "Slovakia", "Slovenia", "Bosnia and Herzegovina", "Montenegro",
    "North Macedonia", "Albania", "Bulgaria", "Georgia", "Armenia",
    "Azerbaijan", "Belarus", "Estonia", "Latvia", "Lithuania", "Moldova",
    "Kazakhstan", "Cyprus", "Malta", "Luxembourg", "Liechtenstein",
    "Faroe Islands", "Gibraltar", "San Marino", "Andorra", "Kosovo",
  ]);
  const southAmerican = new Set([
    "Brazil", "Argentina", "Uruguay", "Colombia", "Chile", "Peru",
    "Ecuador", "Bolivia", "Paraguay", "Venezuela",
  ]);
  const concacaf = new Set([
    "Mexico", "United States", "Canada", "Costa Rica", "Panama",
    "Honduras", "Jamaica", "El Salvador", "Trinidad and Tobago",
    "Guatemala", "Haiti", "Cuba", "Curaçao", "Suriname", "Nicaragua",
    "Dominican Republic", "Bermuda", "Grenada", "Guyana",
    "St Kitts and Nevis", "St Lucia", "St Vincent and the Grenadines",
    "Puerto Rico",
  ]);
  const asian = new Set([
    "Japan", "Korea Republic", "South Korea", "Australia", "Iran",
    "Saudi Arabia", "Qatar", "United Arab Emirates", "Iraq", "China PR",
    "China", "Uzbekistan", "Thailand", "Vietnam", "India", "Oman",
    "Bahrain", "Jordan", "Syria", "Lebanon", "Palestine", "Kuwait",
    "Indonesia", "Malaysia", "Philippines", "Singapore", "Myanmar",
    "Korea DPR", "North Korea", "Hong Kong", "Macau", "Chinese Taipei",
    "Taiwan", "Bangladesh", "Nepal", "Sri Lanka", "Maldives", "Bhutan",
    "Mongolia", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Cambodia",
    "Laos", "Timor-Leste", "Yemen",
  ]);
  const oceanian = new Set([
    "New Zealand", "Fiji", "Papua New Guinea", "Solomon Islands",
    "Vanuatu", "Samoa", "Tonga",
  ]);

  if (european.has(name)) return "UEFA";
  if (southAmerican.has(name)) return "CONMEBOL";
  if (concacaf.has(name)) return "CONCACAF";
  if (asian.has(name)) return "AFC";
  if (oceanian.has(name)) return "OFC";
  return "CAF"; // Default to CAF for remaining (mostly African nations)
}

interface CsvMatch {
  date: string;
  home_team: string;
  away_team: string;
  home_score: string;
  away_score: string;
  tournament: string;
  city: string;
  country: string;
  neutral: string;
}

interface CsvShootout {
  date: string;
  home_team: string;
  away_team: string;
  winner: string;
}

async function main() {
  console.log("=== International Soccer Rankings Seed Script ===\n");

  // 1. Parse CSVs
  console.log("1. Parsing CSV files...");
  const resultsRaw = readFileSync(
    join(__dirname, "data/results.csv"),
    "utf-8"
  );
  const shootoutsRaw = readFileSync(
    join(__dirname, "data/shootouts.csv"),
    "utf-8"
  );

  const allMatches: CsvMatch[] = parse(resultsRaw, {
    columns: true,
    skip_empty_lines: true,
  });
  const shootouts: CsvShootout[] = parse(shootoutsRaw, {
    columns: true,
    skip_empty_lines: true,
  });

  // Build shootout lookup: "date|home|away" → winner
  const shootoutMap = new Map<string, string>();
  for (const s of shootouts) {
    shootoutMap.set(`${s.date}|${s.home_team}|${s.away_team}`, s.winner);
  }

  // Filter to matches from 1998 onward
  const matches = allMatches.filter((m) => m.date >= START_DATE);
  matches.sort((a, b) => a.date.localeCompare(b.date));

  console.log(
    `   Total matches in CSV: ${allMatches.length}`
  );
  console.log(`   Matches since ${START_DATE}: ${matches.length}`);
  console.log(`   Shootouts: ${shootouts.length}\n`);

  // 2. Collect all unique team names
  console.log("2. Creating teams...");
  const teamNames = new Set<string>();
  for (const m of matches) {
    teamNames.add(m.home_team);
    teamNames.add(m.away_team);
  }

  // Clear existing data
  console.log("   Clearing existing data...");
  await prisma.rankingSnapshot.deleteMany();
  await prisma.teamRoster.deleteMany();
  await prisma.match.deleteMany();
  await prisma.predictionCache.deleteMany();
  await prisma.playerSeasonStats.deleteMany();
  await prisma.player.deleteMany();
  await prisma.leagueCoefficient.deleteMany();
  await prisma.teamSeasonRazali.deleteMany();
  await prisma.team.deleteMany();

  // Create teams
  const teamMap = new Map<string, string>(); // name → id
  const usedCodes = new Set<string>();
  let codeCounter = 0;

  for (const name of teamNames) {
    let code = KNOWN_CODES[name];
    if (!code) {
      // Generate a unique 3-letter code
      code = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
      while (usedCodes.has(code)) {
        codeCounter++;
        code = code.substring(0, 2) + String(codeCounter % 10);
      }
    }
    // Handle duplicate codes
    if (usedCodes.has(code)) {
      codeCounter++;
      code = code.substring(0, 2) + String(codeCounter % 10);
    }
    usedCodes.add(code);

    const team = await prisma.team.create({
      data: {
        name,
        slug: slugify(name),
        fifaCode: code,
        confederation: guessConfederation(name) as never,
        currentOverallRating: 1500,
        currentOffensiveRating: 1500,
        currentDefensiveRating: 1500,
        currentRank: 0,
        eloOffensive: 1500,
        eloDefensive: 1500,
        rosterOffensive: 1500,
        rosterDefensive: 1500,
      },
    });
    teamMap.set(name, team.id);
  }
  console.log(`   Created ${teamMap.size} teams\n`);

  // 3. Process matches through Elo engine
  console.log("3. Processing matches through Elo engine...");

  // In-memory state for speed
  const eloState = new Map<string, TeamElo>();
  const piState = new Map<string, PiTeamRatings>();
  const winRateState = new Map<string, WinRateState>();
  const homeAwayState = new Map<string, HomeAwayState>();
  const matchCountState = new Map<string, number>();
  for (const [name] of teamMap) {
    eloState.set(name, { offensive: 1500, defensive: 1500 });
    piState.set(name, { home: 0, away: 0 });
    winRateState.set(name, { wins: 0, total: 0 });
    matchCountState.set(name, 0);
    homeAwayState.set(name, {
      homeGoalsScored: 0, homeGoalsConceded: 0,
      awayGoalsScored: 0, awayGoalsConceded: 0,
      homeMatches: 0, awayMatches: 0,
    });
  }

  // New model states
  const glickoState = new Map<string, GlickoState>();
  const berrarState = new Map<string, BerrarState>();
  const opState = new Map<string, OpState>();
  const iwPiState = new Map<string, IwPiTeamRatings>();
  const moEloState = new Map<string, MoEloState>();
  for (const [name] of teamMap) {
    glickoState.set(name, initGlicko());
    berrarState.set(name, initBerrar());
    opState.set(name, initOp());
    iwPiState.set(name, initIwPi());
    moEloState.set(name, initMoElo());
  }

  // Collect raw match data for BT solver
  const btRawMatches: RawMatchInput[] = [];

  let processedCount = 0;
  let lastSnapshotDate = "";
  let lastYear = "";
  const matchBatch: Array<Parameters<typeof prisma.match.create>[0]["data"]> = [];

  for (const m of matches) {
    // Apply annual mean reversion at year boundaries
    const matchYear = m.date.substring(0, 4);
    if (matchYear !== lastYear && lastYear !== "") {
      for (const [name, elo] of eloState) {
        eloState.set(name, applyMeanReversion(elo));
      }
      for (const [name, pi] of piState) {
        piState.set(name, applyPiMeanReversion(pi, 0.08));
      }
      for (const [name, wr] of winRateState) {
        winRateState.set(name, applyWinRateReversion(wr));
      }
      for (const [name, ha] of homeAwayState) {
        homeAwayState.set(name, applyHomeAwayReversion(ha));
      }
      for (const [name, g] of glickoState) {
        glickoState.set(name, applyGlickoReversion(g));
      }
      for (const [name, b] of berrarState) {
        berrarState.set(name, applyBerrarReversion(b));
      }
      for (const [name, o] of opState) {
        opState.set(name, applyOpReversion(o));
      }
      for (const [name, iwp] of iwPiState) {
        iwPiState.set(name, applyIwPiMeanReversion(iwp));
      }
      for (const [name, mo] of moEloState) {
        moEloState.set(name, applyMoEloReversion(mo));
      }
      // Razali roster ratings are applied post-seed via fetch-rosters.ts
    }
    lastYear = matchYear;

    const homeId = teamMap.get(m.home_team)!;
    const awayId = teamMap.get(m.away_team)!;
    const homeElo = eloState.get(m.home_team)!;
    const awayElo = eloState.get(m.away_team)!;

    const homeScore = parseInt(m.home_score, 10);
    const awayScore = parseInt(m.away_score, 10);
    if (isNaN(homeScore) || isNaN(awayScore)) continue;

    // Check for penalty shootout
    const shootoutKey = `${m.date}|${m.home_team}|${m.away_team}`;
    const shootoutWinner = shootoutMap.get(shootoutKey);
    let homeScorePenalties: number | null = null;
    let awayScorePenalties: number | null = null;
    if (shootoutWinner && homeScore === awayScore) {
      // We don't have exact penalty scores, so use 5-4 / 4-5 convention
      if (shootoutWinner === m.home_team) {
        homeScorePenalties = 5;
        awayScorePenalties = 4;
      } else {
        homeScorePenalties = 4;
        awayScorePenalties = 5;
      }
    }

    const importance = tournamentToImportance(m.tournament);

    // Get running win rates for adaptive goal diff
    const homeWR = getWinRate(winRateState.get(m.home_team)!);
    const awayWR = getWinRate(winRateState.get(m.away_team)!);

    // Calculate new Elo with per-team adaptive multiplier + home advantage
    const isNeutral = m.neutral === "TRUE";
    const homeHA = computeHomeAdvantage(homeAwayState.get(m.home_team)!);
    const result = calculateElo(homeElo, awayElo, {
      homeScore,
      awayScore,
      homeScorePenalties,
      awayScorePenalties,
      matchImportance: importance as never,
      tournament: m.tournament,
      tournamentStage: null,
      neutralVenue: isNeutral,
      homeConfederation: guessConfederation(m.home_team),
    }, homeWR, awayWR, homeHA);

    // Update pi-ratings
    const homePi = piState.get(m.home_team)!;
    const awayPi = piState.get(m.away_team)!;
    const piResult = updatePiRatings(homePi, awayPi, homeScore, awayScore, DEFAULT_PI_PARAMS, isNeutral);
    piState.set(m.home_team, piResult.homeTeam);
    piState.set(m.away_team, piResult.awayTeam);

    // Update Glicko-2
    const homeGlicko = glickoState.get(m.home_team)!;
    const awayGlicko = glickoState.get(m.away_team)!;
    const glickoResult = processGlickoMatch(homeGlicko, awayGlicko, homeScore, awayScore, homeScorePenalties, awayScorePenalties);
    glickoState.set(m.home_team, glickoResult.home);
    glickoState.set(m.away_team, glickoResult.away);

    // Update Berrar k-NN
    const homeBerrar = berrarState.get(m.home_team)!;
    const awayBerrar = berrarState.get(m.away_team)!;
    const berrarResult = processBerrarMatch(homeBerrar, awayBerrar, homeScore, awayScore, homeScorePenalties, awayScorePenalties);
    berrarState.set(m.home_team, berrarResult.home);
    berrarState.set(m.away_team, berrarResult.away);

    // Update Ordered Probit
    const homeOp = opState.get(m.home_team)!;
    const awayOp = opState.get(m.away_team)!;
    const opResult = processOpMatch(homeOp, awayOp, homeScore, awayScore, isNeutral);
    opState.set(m.home_team, opResult.home);
    opState.set(m.away_team, opResult.away);

    // Update Importance-Weighted Pi
    const homeIwPi = iwPiState.get(m.home_team)!;
    const awayIwPi = iwPiState.get(m.away_team)!;
    const iwPiResult = updateIwPiRatings(homeIwPi, awayIwPi, homeScore, awayScore, isNeutral, importance);
    iwPiState.set(m.home_team, iwPiResult.homeTeam);
    iwPiState.set(m.away_team, iwPiResult.awayTeam);

    // Update Margin-Optimized Elo
    const homeMoElo = moEloState.get(m.home_team)!;
    const awayMoElo = moEloState.get(m.away_team)!;
    const moEloResult = processMoEloMatch(homeMoElo, awayMoElo, homeScore, awayScore, importance, isNeutral, homeScorePenalties, awayScorePenalties);
    moEloState.set(m.home_team, moEloResult.home);
    moEloState.set(m.away_team, moEloResult.away);

    // Update win rate tracking
    const homeWins = homeScore > awayScore ? 1 : homeScore === awayScore ? 0.5 : 0;
    const awayWins = awayScore > homeScore ? 1 : homeScore === awayScore ? 0.5 : 0;
    // Adjust for PSO
    const homeWRState = winRateState.get(m.home_team)!;
    const awayWRState = winRateState.get(m.away_team)!;
    homeWRState.wins += homeScorePenalties != null && homeScorePenalties > (awayScorePenalties ?? 0) ? 0.75 : homeWins;
    homeWRState.total += 1;
    awayWRState.wins += awayScorePenalties != null && awayScorePenalties > (homeScorePenalties ?? 0) ? 0.75 : awayWins;
    awayWRState.total += 1;

    // Increment actual match counts (never decayed, used for ranking threshold)
    matchCountState.set(m.home_team, (matchCountState.get(m.home_team) ?? 0) + 1);
    matchCountState.set(m.away_team, (matchCountState.get(m.away_team) ?? 0) + 1);

    // Update home/away goal tracking (skip neutral venues)
    if (!isNeutral) {
      const homeHA = homeAwayState.get(m.home_team)!;
      homeHA.homeGoalsScored += homeScore;
      homeHA.homeGoalsConceded += awayScore;
      homeHA.homeMatches += 1;

      const awayHA = homeAwayState.get(m.away_team)!;
      awayHA.awayGoalsScored += awayScore;
      awayHA.awayGoalsConceded += homeScore;
      awayHA.awayMatches += 1;
    }

    // Prepare match record
    matchBatch.push({
      date: new Date(m.date),
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore,
      awayScore,
      homeScorePenalties,
      awayScorePenalties,
      tournament: m.tournament,
      venue: m.city ? `${m.city}, ${m.country}` : null,
      neutralVenue: m.neutral === "TRUE",
      matchImportance: importance as never,
      homeEloOffBefore: homeElo.offensive,
      homeEloDefBefore: homeElo.defensive,
      awayEloOffBefore: awayElo.offensive,
      awayEloDefBefore: awayElo.defensive,
      homeEloOffAfter: result.homeElo.offensive,
      homeEloDefAfter: result.homeElo.defensive,
      awayEloOffAfter: result.awayElo.offensive,
      awayEloDefAfter: result.awayElo.defensive,
      source: "kaggle-martj42",
    });

    // Collect for BT solver
    btRawMatches.push({
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore,
      awayScore,
      homeScorePenalties,
      awayScorePenalties,
      date: new Date(m.date),
      matchImportance: importance as never,
      tournament: m.tournament,
      tournamentStage: null,
      neutralVenue: isNeutral,
    });

    // Update in-memory Elo state
    eloState.set(m.home_team, result.homeElo);
    eloState.set(m.away_team, result.awayElo);

    // Flush batch using bulk insert
    if (matchBatch.length >= BATCH_SIZE) {
      await prisma.match.createMany({ data: matchBatch as any });
      matchBatch.length = 0;
    }

    processedCount++;
    if (processedCount % 5000 === 0) {
      console.log(`   Processed ${processedCount}/${matches.length} matches...`);
    }

    // Create periodic ranking snapshots (monthly)
    if (
      m.date >= DISPLAY_DATE &&
      m.date.substring(0, 7) !== lastSnapshotDate
    ) {
      lastSnapshotDate = m.date.substring(0, 7);
      // We'll batch these after all matches
    }
  }

  // Flush remaining matches
  if (matchBatch.length > 0) {
    await prisma.match.createMany({ data: matchBatch as any });
    matchBatch.length = 0;
  }

  console.log(`   Processed all ${processedCount} matches\n`);

  // 4. Update team ratings in database
  console.log("4. Updating team ratings...");
  const teamRatings: Array<{
    id: string;
    name: string;
    overall: number;
    offensive: number;
    defensive: number;
    eloOff: number;
    eloDef: number;
    matchCount: number;
  }> = [];

  for (const [name, id] of teamMap) {
    const elo = eloState.get(name)!;
    const rating = combinedRating(elo.offensive, elo.defensive, 1500, 1500, guessConfederation(name));

    teamRatings.push({
      id,
      name,
      overall: rating.overall,
      offensive: rating.offensive,
      defensive: rating.defensive,
      eloOff: elo.offensive,
      eloDef: elo.defensive,
      matchCount: matchCountState.get(name) ?? 0,
    });
  }

  // Only rank teams with enough matches; sort by overall rating
  const ranked = teamRatings.filter((t) => t.matchCount >= MIN_MATCHES_FOR_RANKING);
  const unranked = teamRatings.filter((t) => t.matchCount < MIN_MATCHES_FOR_RANKING);
  ranked.sort((a, b) => b.overall - a.overall);

  console.log(`   ${ranked.length} ranked teams, ${unranked.length} unranked (<${MIN_MATCHES_FOR_RANKING} matches)`);

  for (let i = 0; i < ranked.length; i++) {
    const t = ranked[i];
    const ha = computeHomeAdvantage(homeAwayState.get(t.name)!);
    await prisma.team.update({
      where: { id: t.id },
      data: {
        eloOffensive: t.eloOff,
        eloDefensive: t.eloDef,
        currentOffensiveRating: t.offensive,
        currentDefensiveRating: t.defensive,
        currentOverallRating: t.overall,
        currentRank: i + 1,
        rosterOffensive: 1500,
        rosterDefensive: 1500,
        homeAdvantage: ha,
        piHome: (piState.get(t.name) ?? { home: 0 }).home,
        piAway: (piState.get(t.name) ?? { away: 0 }).away,
        piOverall: piOverall(piState.get(t.name) ?? { home: 0, away: 0 }),
        glickoRating: glickoToDisplay(glickoState.get(t.name) ?? initGlicko()),
        glickoRd: rdToDisplay(glickoState.get(t.name) ?? initGlicko()),
        berrarRating: (berrarState.get(t.name) ?? initBerrar()).rating,
        opRating: opToDisplay(opState.get(t.name) ?? initOp()),
        iwPiHome: (iwPiState.get(t.name) ?? initIwPi()).home,
        iwPiAway: (iwPiState.get(t.name) ?? initIwPi()).away,
        iwPiOverall: iwPiOverall(iwPiState.get(t.name) ?? initIwPi()),
        moEloOffensive: (moEloState.get(t.name) ?? initMoElo()).offensive,
        moEloDefensive: (moEloState.get(t.name) ?? initMoElo()).defensive,
      },
    });
  }
  // Unranked teams get rank 0
  for (const t of unranked) {
    const ha = computeHomeAdvantage(homeAwayState.get(t.name)!);
    await prisma.team.update({
      where: { id: t.id },
      data: {
        eloOffensive: t.eloOff,
        eloDefensive: t.eloDef,
        currentOffensiveRating: t.offensive,
        currentDefensiveRating: t.defensive,
        currentOverallRating: t.overall,
        currentRank: 0,
        rosterOffensive: 1500,
        rosterDefensive: 1500,
        homeAdvantage: ha,
        piHome: (piState.get(t.name) ?? { home: 0 }).home,
        piAway: (piState.get(t.name) ?? { away: 0 }).away,
        piOverall: piOverall(piState.get(t.name) ?? { home: 0, away: 0 }),
        glickoRating: glickoToDisplay(glickoState.get(t.name) ?? initGlicko()),
        glickoRd: rdToDisplay(glickoState.get(t.name) ?? initGlicko()),
        berrarRating: (berrarState.get(t.name) ?? initBerrar()).rating,
        opRating: opToDisplay(opState.get(t.name) ?? initOp()),
        iwPiHome: (iwPiState.get(t.name) ?? initIwPi()).home,
        iwPiAway: (iwPiState.get(t.name) ?? initIwPi()).away,
        iwPiOverall: iwPiOverall(iwPiState.get(t.name) ?? initIwPi()),
        moEloOffensive: (moEloState.get(t.name) ?? initMoElo()).offensive,
        moEloDefensive: (moEloState.get(t.name) ?? initMoElo()).defensive,
      },
    });
  }
  console.log(`   Updated ${teamRatings.length} teams\n`);

  // 5. Compute Bradley-Terry ratings
  console.log("5. Computing Bradley-Terry ratings...");
  const btNow = new Date();
  btNow.setUTCHours(0, 0, 0, 0);
  const { teamIds: btTeamIds, matches: btMatches } = prepareMatchesForSolver(btRawMatches, btNow);
  const btResult = solveBradleyTerry(btTeamIds, btMatches);
  console.log(`   BT solver converged in ${btResult.iterations} iterations (maxChange: ${btResult.maxChange.toFixed(4)})`);

  // Build btRating lookup by team name
  const btRatingByName = new Map<string, number>();
  for (const [name, id] of teamMap) {
    btRatingByName.set(name, btResult.ratings.get(id) ?? 1500);
  }

  // Rank teams by BT rating (only those with enough matches)
  const btRanked = ranked
    .map((t) => ({ ...t, btRating: btRatingByName.get(t.name) ?? 1500 }))
    .sort((a, b) => b.btRating - a.btRating);

  // Update teams with BT ratings and ranks
  for (let i = 0; i < btRanked.length; i++) {
    await prisma.team.update({
      where: { id: btRanked[i].id },
      data: {
        btRating: btRanked[i].btRating,
        btRank: i + 1,
      },
    });
  }
  // Unranked teams get btRank 0
  for (const t of unranked) {
    await prisma.team.update({
      where: { id: t.id },
      data: {
        btRating: btRatingByName.get(t.name) ?? 1500,
        btRank: 0,
      },
    });
  }
  console.log(`   Updated ${btRanked.length} teams with BT ratings`);

  // Compute Glicko, Berrar, OP ranks
  console.log("   Computing Glicko-2, Berrar k-NN, and Ordered Probit ranks...");
  const glickoRanked = ranked
    .map(t => ({ ...t, glickoRating: glickoToDisplay(glickoState.get(t.name) ?? initGlicko()) }))
    .sort((a, b) => b.glickoRating - a.glickoRating);
  for (let i = 0; i < glickoRanked.length; i++) {
    await prisma.team.update({ where: { id: glickoRanked[i].id }, data: { glickoRank: i + 1 } });
  }
  for (const t of unranked) {
    await prisma.team.update({ where: { id: t.id }, data: { glickoRank: 0 } });
  }

  const berrarRanked = ranked
    .map(t => ({ ...t, berrarRating: (berrarState.get(t.name) ?? initBerrar()).rating }))
    .sort((a, b) => b.berrarRating - a.berrarRating);
  for (let i = 0; i < berrarRanked.length; i++) {
    await prisma.team.update({ where: { id: berrarRanked[i].id }, data: { berrarRank: i + 1 } });
  }
  for (const t of unranked) {
    await prisma.team.update({ where: { id: t.id }, data: { berrarRank: 0 } });
  }

  const opRanked = ranked
    .map(t => ({ ...t, opRating: opToDisplay(opState.get(t.name) ?? initOp()) }))
    .sort((a, b) => b.opRating - a.opRating);
  for (let i = 0; i < opRanked.length; i++) {
    await prisma.team.update({ where: { id: opRanked[i].id }, data: { opRank: i + 1 } });
  }
  for (const t of unranked) {
    await prisma.team.update({ where: { id: t.id }, data: { opRank: 0 } });
  }

  const iwPiRanked = ranked
    .map(t => ({ ...t, iwPiOverall: iwPiOverall(iwPiState.get(t.name) ?? initIwPi()) }))
    .sort((a, b) => b.iwPiOverall - a.iwPiOverall);
  for (let i = 0; i < iwPiRanked.length; i++) {
    await prisma.team.update({ where: { id: iwPiRanked[i].id }, data: { iwPiRank: i + 1 } });
  }
  for (const t of unranked) {
    await prisma.team.update({ where: { id: t.id }, data: { iwPiRank: 0 } });
  }

  const moEloRanked = ranked
    .map(t => ({ ...t, moEloOverall: moEloOverall(moEloState.get(t.name) ?? initMoElo()) }))
    .sort((a, b) => b.moEloOverall - a.moEloOverall);
  for (let i = 0; i < moEloRanked.length; i++) {
    await prisma.team.update({ where: { id: moEloRanked[i].id }, data: { moEloRank: i + 1 } });
  }
  for (const t of unranked) {
    await prisma.team.update({ where: { id: t.id }, data: { moEloRank: 0 } });
  }
  // Compute composite ratings + ranks
  console.log("   Computing composite market-aligned ratings...");
  const compositeData: Array<{
    id: string; name: string;
    gridOpt: { offensive: number; defensive: number; overall: number };
    top3: { offensive: number; defensive: number; overall: number };
    btMkt: { offensive: number; defensive: number; overall: number };
  }> = [];

  for (const t of ranked) {
    const combOff = t.offensive;
    const combDef = t.defensive;
    const bt = btRatingByName.get(t.name) ?? 1500;
    const op = opToDisplay(opState.get(t.name) ?? initOp());
    const iwPi = iwPiOverall(iwPiState.get(t.name) ?? initIwPi());

    compositeData.push({
      id: t.id, name: t.name,
      gridOpt: gridOptimizedRating(combOff, combDef, bt),
      top3: top3EqualRating(combOff, combDef, bt, op),
      btMkt: backtestedMarketRating(combOff, combDef, iwPi),
    });
  }

  // Grid-Optimized ranks
  const gridSorted = [...compositeData].sort((a, b) => b.gridOpt.overall - a.gridOpt.overall);
  for (let i = 0; i < gridSorted.length; i++) {
    const c = gridSorted[i];
    await prisma.team.update({ where: { id: c.id }, data: {
      gridOptOff: c.gridOpt.offensive, gridOptDef: c.gridOpt.defensive, gridOptRank: i + 1,
    }});
  }
  // Top-3 Equal ranks
  const top3Sorted = [...compositeData].sort((a, b) => b.top3.overall - a.top3.overall);
  for (let i = 0; i < top3Sorted.length; i++) {
    const c = top3Sorted[i];
    await prisma.team.update({ where: { id: c.id }, data: {
      top3Off: c.top3.offensive, top3Def: c.top3.defensive, top3Rank: i + 1,
    }});
  }
  // Backtested+Market ranks
  const btMktSorted = [...compositeData].sort((a, b) => b.btMkt.overall - a.btMkt.overall);
  for (let i = 0; i < btMktSorted.length; i++) {
    const c = btMktSorted[i];
    await prisma.team.update({ where: { id: c.id }, data: {
      btMktOff: c.btMkt.offensive, btMktDef: c.btMkt.defensive, btMktRank: i + 1,
    }});
  }
  for (const t of unranked) {
    await prisma.team.update({ where: { id: t.id }, data: {
      gridOptRank: 0, top3Rank: 0, btMktRank: 0,
    }});
  }
  console.log(`   Updated ranks for all 5 individual + 3 composite models\n`);

  // 6. Create ranking snapshots at key dates (with BT)
  console.log("6. Creating ranking snapshots...");

  // Re-process to create monthly snapshots
  // Reset Elo state
  const snapshotElo = new Map<string, TeamElo>();
  for (const [name] of teamMap) {
    snapshotElo.set(name, { offensive: 1500, defensive: 1500 });
  }

  let lastMonth = "";
  let snapLastYear = "";
  let snapshotCount = 0;
  let btMatchIndex = 0; // tracks how many btRawMatches have been processed up to current snapshot
  let btWarmStart: Map<string, number> | undefined;

  for (const m of matches) {
    // Apply annual mean reversion at year boundaries
    const snapYear = m.date.substring(0, 4);
    if (snapYear !== snapLastYear && snapLastYear !== "") {
      for (const [name, elo] of snapshotElo) {
        snapshotElo.set(name, applyMeanReversion(elo));
      }
    }
    snapLastYear = snapYear;

    const homeScore = parseInt(m.home_score, 10);
    const awayScore = parseInt(m.away_score, 10);
    if (isNaN(homeScore) || isNaN(awayScore)) continue;

    const homeElo = snapshotElo.get(m.home_team)!;
    const awayElo = snapshotElo.get(m.away_team)!;

    const shootoutKey = `${m.date}|${m.home_team}|${m.away_team}`;
    const shootoutWinner = shootoutMap.get(shootoutKey);
    let homeScorePenalties: number | null = null;
    let awayScorePenalties: number | null = null;
    if (shootoutWinner && homeScore === awayScore) {
      homeScorePenalties = shootoutWinner === m.home_team ? 5 : 4;
      awayScorePenalties = shootoutWinner === m.home_team ? 4 : 5;
    }

    const importance = tournamentToImportance(m.tournament);
    const result = calculateElo(homeElo, awayElo, {
      homeScore,
      awayScore,
      homeScorePenalties,
      awayScorePenalties,
      matchImportance: importance as never,
      tournament: m.tournament,
      tournamentStage: null,
      neutralVenue: m.neutral === "TRUE",
      homeConfederation: guessConfederation(m.home_team),
    });

    snapshotElo.set(m.home_team, result.homeElo);
    snapshotElo.set(m.away_team, result.awayElo);
    btMatchIndex++;

    // Create snapshot at month boundaries (from DISPLAY_DATE onward)
    const month = m.date.substring(0, 7);
    if (m.date >= DISPLAY_DATE && month !== lastMonth) {
      if (lastMonth !== "") {
        // Create snapshot for end of previous month
        const snapshotDate = new Date(`${lastMonth}-28`);

        // Run BT solver for this snapshot point (warm-started from previous)
        const btSlice = btRawMatches.slice(0, btMatchIndex);
        const { teamIds: snapBtTeamIds, matches: snapBtMatches } =
          prepareMatchesForSolver(btSlice, snapshotDate);
        const snapBtResult = solveBradleyTerry(snapBtTeamIds, snapBtMatches, { warmStart: btWarmStart });
        btWarmStart = snapBtResult.ratings; // warm-start next month

        const ratings: Array<{
          name: string;
          id: string;
          overall: number;
          off: number;
          def: number;
          eloOff: number;
          eloDef: number;
          btRating: number;
        }> = [];

        for (const [name, id] of teamMap) {
          const elo = snapshotElo.get(name)!;
          const r = combinedRating(elo.offensive, elo.defensive, 1500, 1500, guessConfederation(name));
          ratings.push({
            name,
            id,
            overall: r.overall,
            off: r.offensive,
            def: r.defensive,
            eloOff: elo.offensive,
            eloDef: elo.defensive,
            btRating: snapBtResult.ratings.get(id) ?? 1500,
          });
        }

        ratings.sort((a, b) => b.overall - a.overall);

        // BT ranks for this snapshot
        const btSorted = [...ratings].sort((a, b) => b.btRating - a.btRating);
        const btRankMap = new Map<string, number>();
        for (let i = 0; i < btSorted.length; i++) {
          btRankMap.set(btSorted[i].id, i + 1);
        }

        // Snapshot top 200 teams (covers all WC/continental tournament participants)
        const snapshotBatch = [];
        for (let i = 0; i < Math.min(200, ratings.length); i++) {
          const r = ratings[i];
          snapshotBatch.push({
            teamId: r.id,
            date: snapshotDate,
            rank: i + 1,
            overallRating: r.overall,
            offensiveRating: r.off,
            defensiveRating: r.def,
            eloOffensive: r.eloOff,
            eloDefensive: r.eloDef,
            rosterOffensive: 1500,
            rosterDefensive: 1500,
            btRating: r.btRating,
            btRank: btRankMap.get(r.id) ?? 0,
          });
        }
        await prisma.rankingSnapshot.createMany({ data: snapshotBatch });
        snapshotCount++;

        if (snapshotCount % 24 === 0) {
          console.log(`   Created ${snapshotCount} snapshots (${lastMonth})...`);
        }
      }
      lastMonth = month;
    }
  }

  // Create final snapshot for current date
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  // BT ranks for final snapshot
  const finalBtRankMap = new Map<string, number>();
  for (let i = 0; i < btRanked.length; i++) {
    finalBtRankMap.set(btRanked[i].id, i + 1);
  }

  const finalSnapshotBatch = [];
  for (let i = 0; i < Math.min(200, teamRatings.length); i++) {
    const t = teamRatings[i];
    finalSnapshotBatch.push({
      teamId: t.id,
      date: now,
      rank: i + 1,
      overallRating: t.overall,
      offensiveRating: t.offensive,
      defensiveRating: t.defensive,
      eloOffensive: t.eloOff,
      eloDefensive: t.eloDef,
      rosterOffensive: 1500,
      rosterDefensive: 1500,
      btRating: btRatingByName.get(t.name) ?? 1500,
      btRank: finalBtRankMap.get(t.id) ?? 0,
    });
  }
  await prisma.rankingSnapshot.createMany({ data: finalSnapshotBatch });
  snapshotCount++;

  console.log(`   Created ${snapshotCount} monthly snapshots\n`);

  // 7. Print top 20
  console.log("=== Current Top 20 Rankings ===\n");
  console.log("Rank  Team                     Overall   Off      Def     BT Rating  BT Rank");
  console.log("----  ----                     -------   ---      ---     ---------  -------");
  for (let i = 0; i < 20; i++) {
    const t = teamRatings[i];
    const bt = btRatingByName.get(t.name) ?? 1500;
    const btR = finalBtRankMap.get(t.id) ?? 0;
    console.log(
      `${String(i + 1).padStart(4)}  ${t.name.padEnd(25)} ${t.overall.toFixed(0).padStart(7)}  ${t.offensive.toFixed(0).padStart(7)}  ${t.defensive.toFixed(0).padStart(7)}  ${bt.toFixed(0).padStart(9)}  ${String(btR).padStart(7)}`
    );
  }

  console.log(`\n=== Seed complete! ===`);
  console.log(`Teams: ${teamMap.size}`);
  console.log(`Matches: ${processedCount}`);
  console.log(`Snapshots: ${snapshotCount} months`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
