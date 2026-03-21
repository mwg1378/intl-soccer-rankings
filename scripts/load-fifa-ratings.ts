/**
 * Load EA FC player ratings from Kaggle CSV into the database.
 *
 * Implements the Razali/Yeung aggregation: 35 player sub-attributes →
 * 7 clusters → summed by position role → 28 team features → off/def ratings.
 *
 * Usage: npx tsx scripts/load-fifa-ratings.ts
 *
 * Prerequisite: Download the Kaggle dataset and place male_players.csv in
 * scripts/data/fifa-ratings/
 */

import "dotenv/config";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  computeClusterSums,
  mapPositionRole,
  aggregateTeamFeatures,
  deriveRawOffensive,
  deriveRawDefensive,
  razaliToEloScale,
  editionToYear,
  type PositionRole,
  type PlayerClusterSums,
  type TeamRazaliFeatures,
} from "../lib/razali-engine";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const url = new URL(connectionString);
const pool = new pg.Pool({
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  host: url.hostname,
  port: parseInt(url.port || "5432", 10),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
  max: 5,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Map Kaggle nationality names to our DB team names
const NATIONALITY_MAP: Record<string, string> = {
  "Korea Republic": "South Korea",
  "Côte d'Ivoire": "Ivory Coast",
  "China PR": "China",
  "IR Iran": "Iran",
  "Korea DPR": "North Korea",
  "Republic of Ireland": "Republic of Ireland",
  "Cabo Verde": "Cape Verde",
  "Curaçao": "Curaçao",
  "Bosnia Herzegovina": "Bosnia and Herzegovina",
  "Trinidad & Tobago": "Trinidad and Tobago",
  "St Kitts Nevis": "St Kitts and Nevis",
  "São Tomé & Príncipe": "São Tomé and Príncipe",
  "Central African Rep.": "Central African Republic",
};

function dbTeamName(kaggleName: string): string {
  return NATIONALITY_MAP[kaggleName] ?? kaggleName;
}

async function main() {
  console.log("=== Load EA FC Player Ratings (Razali/Yeung Method) ===\n");

  const csvPath = join(__dirname, "data/fifa-ratings/male_players.csv");
  console.log("1. Parsing CSV...");
  const raw = readFileSync(csvPath, "utf-8");
  const allRows: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
  console.log(`   ${allRows.length} total player rows\n`);

  // Load team name → id mapping
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
  });
  const teamIdByName = new Map(teams.map((t) => [t.name, t.id]));

  // Clear old Razali data
  console.log("2. Clearing old Razali data...");
  await prisma.$executeRawUnsafe('DELETE FROM "TeamSeasonRazali"');
  console.log("   Done.\n");

  // Process each edition
  const editions = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
  let totalTeamSeasons = 0;

  for (const edition of editions) {
    const year = editionToYear(edition);
    const editionStr = `${edition}.0`;
    const editionRows = allRows.filter(
      (r) => r.fifa_version === editionStr
    );

    // Filter to national team players only
    const nationalPlayers = editionRows.filter(
      (r) => r.nation_team_id && r.nation_position && r.nation_team_id !== "0"
    );

    console.log(
      `   FIFA ${edition} (${year}): ${editionRows.length} players, ${nationalPlayers.length} on national teams`
    );

    // Group by nation_team_id
    const teamGroups = new Map<
      string,
      Array<{ role: PositionRole; clusters: PlayerClusterSums; nationality: string }>
    >();

    for (const row of nationalPlayers) {
      const nationTeamId = row.nation_team_id;
      if (!teamGroups.has(nationTeamId)) {
        teamGroups.set(nationTeamId, []);
      }
      teamGroups.get(nationTeamId)!.push({
        role: mapPositionRole(row.nation_position),
        clusters: computeClusterSums(row),
        nationality: row.nationality_name,
      });
    }

    // For each national team, aggregate and store
    const teamRazaliData: Array<{
      teamId: string;
      teamName: string;
      features: TeamRazaliFeatures;
      playerCount: number;
    }> = [];

    for (const [, players] of teamGroups) {
      if (players.length < 11) continue; // need at least a starting XI

      // Infer team name from most common nationality
      const nationalityCounts = new Map<string, number>();
      for (const p of players) {
        nationalityCounts.set(
          p.nationality,
          (nationalityCounts.get(p.nationality) ?? 0) + 1
        );
      }
      const teamNationality = [...nationalityCounts.entries()].sort(
        (a, b) => b[1] - a[1]
      )[0][0];

      const teamName = dbTeamName(teamNationality);
      const teamId = teamIdByName.get(teamName);
      if (!teamId) continue;

      const features = aggregateTeamFeatures(players);
      teamRazaliData.push({ teamId, teamName, features, playerCount: players.length });
    }

    // Z-score normalize offensive and defensive across all teams this edition
    const rawOffs = teamRazaliData.map((t) => deriveRawOffensive(t.features));
    const rawDefs = teamRazaliData.map((t) => deriveRawDefensive(t.features));

    const meanOff = rawOffs.reduce((a, b) => a + b, 0) / rawOffs.length;
    const meanDef = rawDefs.reduce((a, b) => a + b, 0) / rawDefs.length;
    const stdOff = Math.sqrt(
      rawOffs.reduce((s, x) => s + (x - meanOff) ** 2, 0) / rawOffs.length
    );
    const stdDef = Math.sqrt(
      rawDefs.reduce((s, x) => s + (x - meanDef) ** 2, 0) / rawDefs.length
    );

    // Store in DB
    for (let i = 0; i < teamRazaliData.length; i++) {
      const t = teamRazaliData[i];
      const razaliOff = razaliToEloScale(rawOffs[i], meanOff, stdOff, false);
      const razaliDef = razaliToEloScale(rawDefs[i], meanDef, stdDef, true);

      await prisma.teamSeasonRazali.create({
        data: {
          teamId: t.teamId,
          fifaEdition: edition,
          ...t.features,
          razaliOffensive: razaliOff,
          razaliDefensive: razaliDef,
          playerCount: t.playerCount,
        },
      });
    }

    totalTeamSeasons += teamRazaliData.length;
    console.log(`     → ${teamRazaliData.length} teams stored`);
  }

  // Print sample results
  console.log(`\n3. Total team-seasons stored: ${totalTeamSeasons}\n`);

  const samples = await prisma.teamSeasonRazali.findMany({
    where: { fifaEdition: 24 },
    include: { team: { select: { name: true } } },
    orderBy: { razaliOffensive: "desc" },
    take: 15,
  });

  console.log("=== Top 15 Teams by Razali Offensive (FIFA 24) ===\n");
  console.log("Team".padEnd(25) + "Off".padStart(7) + "Def".padStart(7) + "Players".padStart(9));
  for (const s of samples) {
    console.log(
      s.team.name.padEnd(25) +
        s.razaliOffensive.toFixed(0).padStart(7) +
        s.razaliDefensive.toFixed(0).padStart(7) +
        String(s.playerCount).padStart(9)
    );
  }

  await prisma.$disconnect();
  await pool.end();
  console.log("\n=== Done! ===");
}

main().catch((err) => {
  console.error("Load failed:", err);
  process.exit(1);
});
