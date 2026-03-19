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
  type TeamElo,
} from "../lib/ranking-engine";

// --- Config ---
const START_DATE = "1998-01-01"; // Elo burn-in starts here
const DISPLAY_DATE = "2002-06-01"; // Rankings displayed from here
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

  // In-memory Elo state for speed
  const eloState = new Map<string, TeamElo>();
  for (const [name] of teamMap) {
    eloState.set(name, { offensive: 1500, defensive: 1500 });
  }

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

    // Calculate new Elo
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

    // Update in-memory Elo state
    eloState.set(m.home_team, result.homeElo);
    eloState.set(m.away_team, result.awayElo);

    // Flush batch
    if (matchBatch.length >= BATCH_SIZE) {
      for (const data of matchBatch) {
        await prisma.match.create({ data });
      }
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
    for (const data of matchBatch) {
      await prisma.match.create({ data });
    }
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
  }> = [];

  for (const [name, id] of teamMap) {
    const elo = eloState.get(name)!;
    const rating = combinedRating(elo.offensive, elo.defensive, 1500, 1500);

    teamRatings.push({
      id,
      name,
      overall: rating.overall,
      offensive: rating.offensive,
      defensive: rating.defensive,
      eloOff: elo.offensive,
      eloDef: elo.defensive,
    });
  }

  // Sort by overall rating (descending) for ranking
  teamRatings.sort((a, b) => b.overall - a.overall);

  for (let i = 0; i < teamRatings.length; i++) {
    const t = teamRatings[i];
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
      },
    });
  }
  console.log(`   Updated ${teamRatings.length} teams\n`);

  // 5. Create ranking snapshots at key dates
  console.log("5. Creating ranking snapshots...");

  // Re-process to create monthly snapshots
  // Reset Elo state
  const snapshotElo = new Map<string, TeamElo>();
  for (const [name] of teamMap) {
    snapshotElo.set(name, { offensive: 1500, defensive: 1500 });
  }

  let lastMonth = "";
  let snapLastYear = "";
  let snapshotCount = 0;

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

    // Create snapshot at month boundaries (from DISPLAY_DATE onward)
    const month = m.date.substring(0, 7);
    if (m.date >= DISPLAY_DATE && month !== lastMonth) {
      if (lastMonth !== "") {
        // Create snapshot for end of previous month
        const snapshotDate = new Date(`${lastMonth}-28`);
        const ratings: Array<{
          name: string;
          id: string;
          overall: number;
          off: number;
          def: number;
          eloOff: number;
          eloDef: number;
        }> = [];

        for (const [name, id] of teamMap) {
          const elo = snapshotElo.get(name)!;
          const r = combinedRating(elo.offensive, elo.defensive, 1500, 1500);
          ratings.push({
            name,
            id,
            overall: r.overall,
            off: r.offensive,
            def: r.defensive,
            eloOff: elo.offensive,
            eloDef: elo.defensive,
          });
        }

        ratings.sort((a, b) => b.overall - a.overall);

        // Only snapshot top 100 teams (to keep DB size reasonable for monthly)
        for (let i = 0; i < Math.min(100, ratings.length); i++) {
          const r = ratings[i];
          await prisma.rankingSnapshot.create({
            data: {
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
            },
          });
        }
        snapshotCount++;
      }
      lastMonth = month;
    }
  }

  // Create final snapshot for current date
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < Math.min(100, teamRatings.length); i++) {
    const t = teamRatings[i];
    await prisma.rankingSnapshot.create({
      data: {
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
      },
    });
  }
  snapshotCount++;

  console.log(`   Created ${snapshotCount} monthly snapshots\n`);

  // 6. Print top 20
  console.log("=== Current Top 20 Rankings ===\n");
  console.log("Rank  Team                     Overall   Off      Def");
  console.log("----  ----                     -------   ---      ---");
  for (let i = 0; i < 20; i++) {
    const t = teamRatings[i];
    console.log(
      `${String(i + 1).padStart(4)}  ${t.name.padEnd(25)} ${t.overall.toFixed(0).padStart(7)}  ${t.offensive.toFixed(0).padStart(7)}  ${t.defensive.toFixed(0).padStart(7)}`
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
