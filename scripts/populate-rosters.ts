/**
 * Populate team rosters from EA FC player data.
 *
 * Reads male_players.csv, filters to the latest FIFA edition with
 * national team data, and creates Player + TeamRoster records.
 *
 * Usage: npx tsx scripts/populate-rosters.ts
 */

import "dotenv/config";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Map EA FC nationality to our DB team names
const NATIONALITY_MAP: Record<string, string> = {
  "England": "England", "France": "France", "Germany": "Germany",
  "Spain": "Spain", "Italy": "Italy", "Netherlands": "Netherlands",
  "Portugal": "Portugal", "Brazil": "Brazil", "Argentina": "Argentina",
  "Belgium": "Belgium", "Croatia": "Croatia", "Denmark": "Denmark",
  "Sweden": "Sweden", "Switzerland": "Switzerland", "Austria": "Austria",
  "Poland": "Poland", "Czech Republic": "Czech Republic", "Romania": "Romania",
  "Hungary": "Hungary", "Greece": "Greece", "Scotland": "Scotland",
  "Wales": "Wales", "Norway": "Norway", "Finland": "Finland",
  "Iceland": "Iceland", "Turkey": "Turkey", "Ukraine": "Ukraine",
  "Russia": "Russia", "Serbia": "Serbia", "Slovakia": "Slovakia",
  "Slovenia": "Slovenia", "Bosnia Herzegovina": "Bosnia and Herzegovina",
  "Bosnia and Herzegovina": "Bosnia and Herzegovina",
  "Montenegro": "Montenegro", "North Macedonia": "North Macedonia",
  "Albania": "Albania", "Bulgaria": "Bulgaria", "Georgia": "Georgia",
  "Armenia": "Armenia", "Azerbaijan": "Azerbaijan", "Estonia": "Estonia",
  "Latvia": "Latvia", "Lithuania": "Lithuania", "Moldova": "Moldova",
  "Kosovo": "Kosovo", "Northern Ireland": "Northern Ireland",
  "Republic of Ireland": "Republic of Ireland",
  "Japan": "Japan", "Korea Republic": "South Korea",
  "Australia": "Australia", "Iran": "Iran",
  "Saudi Arabia": "Saudi Arabia", "Qatar": "Qatar",
  "United Arab Emirates": "United Arab Emirates",
  "Iraq": "Iraq", "China PR": "China PR",
  "Uzbekistan": "Uzbekistan", "Thailand": "Thailand",
  "Vietnam": "Vietnam", "India": "India",
  "United States": "United States", "Mexico": "Mexico",
  "Canada": "Canada", "Colombia": "Colombia", "Chile": "Chile",
  "Peru": "Peru", "Ecuador": "Ecuador", "Uruguay": "Uruguay",
  "Paraguay": "Paraguay", "Venezuela": "Venezuela",
  "Bolivia": "Bolivia", "Costa Rica": "Costa Rica",
  "Panama": "Panama", "Honduras": "Honduras", "Jamaica": "Jamaica",
  "El Salvador": "El Salvador",
  "Nigeria": "Nigeria", "Cameroon": "Cameroon", "Ghana": "Ghana",
  "Senegal": "Senegal", "Egypt": "Egypt", "Morocco": "Morocco",
  "Algeria": "Algeria", "Tunisia": "Tunisia",
  "South Africa": "South Africa", "Ivory Coast": "Ivory Coast",
  "Côte d'Ivoire": "Ivory Coast",
  "Mali": "Mali", "Guinea": "Guinea", "Burkina Faso": "Burkina Faso",
  "Congo DR": "DR Congo", "DR Congo": "DR Congo",
  "Cape Verde": "Cape Verde", "Gabon": "Gabon",
  "Mozambique": "Mozambique", "Zambia": "Zambia", "Zimbabwe": "Zimbabwe",
  "Tanzania": "Tanzania", "Uganda": "Uganda", "Kenya": "Kenya",
  "Ethiopia": "Ethiopia", "Madagascar": "Madagascar",
  "New Zealand": "New Zealand",
  "Jordan": "Jordan", "Bahrain": "Bahrain", "Oman": "Oman",
  "Kuwait": "Kuwait", "Syria": "Syria", "Lebanon": "Lebanon",
  "Palestine": "Palestine",
  "Indonesia": "Indonesia", "Malaysia": "Malaysia",
  "Philippines": "Philippines", "Singapore": "Singapore",
  "Curaçao": "Curaçao", "Suriname": "Suriname",
  "Trinidad and Tobago": "Trinidad and Tobago",
  "Haiti": "Haiti", "Guatemala": "Guatemala",
  "Cuba": "Cuba", "Dominican Republic": "Dominican Republic",
};

function mapPosition(pos: string): "GK" | "DEF" | "MID" | "FWD" {
  const p = pos.toUpperCase().trim();
  if (p === "GK") return "GK";
  if (["CB", "LB", "RB", "LWB", "RWB"].includes(p)) return "DEF";
  if (["CDM", "CM", "CAM", "LM", "RM"].includes(p)) return "MID";
  if (["ST", "CF", "LW", "RW", "LF", "RF"].includes(p)) return "FWD";
  return "MID"; // fallback
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  console.log("=== Populate Team Rosters from EA FC Data ===\n");

  const csvPath = join(__dirname, "data/fifa-ratings/male_players.csv");

  // Use line-by-line reading to avoid stack overflow on 180k rows
  const { createReadStream } = await import("fs");
  const { parse: csvParse } = await import("csv-parse");
  const rows: any[] = [];

  await new Promise<void>((resolve, reject) => {
    createReadStream(csvPath)
      .pipe(csvParse({ columns: true, skip_empty_lines: true, relax_column_count: true }))
      .on("data", (row: any) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`Parsed ${rows.length} player records`);

  // Filter to latest FIFA edition with national team data
  let latestEdition = 0;
  for (const r of rows) {
    const v = parseFloat(r.fifa_version) || 0;
    if (v > latestEdition) latestEdition = v;
  }
  console.log(`Latest FIFA edition: ${latestEdition}`);

  const nationalPlayers = rows.filter((r: any) => {
    return parseFloat(r.fifa_version) === latestEdition
      && r.nation_team_id
      && parseInt(r.nation_team_id) > 0
      && r.nation_position
      && r.nation_position.trim() !== "";
  });

  console.log(`National team players in edition ${latestEdition}: ${nationalPlayers.length}`);

  // Group by team
  const teamPlayers = new Map<string, any[]>();
  for (const p of nationalPlayers) {
    const teamName = NATIONALITY_MAP[p.nationality_name];
    if (!teamName) continue;
    if (!teamPlayers.has(teamName)) teamPlayers.set(teamName, []);
    teamPlayers.get(teamName)!.push(p);
  }

  console.log(`Teams with players: ${teamPlayers.size}\n`);

  // Load team IDs from DB
  const dbTeams = await prisma.team.findMany({ select: { id: true, name: true } });
  const teamIdMap = new Map<string, string>();
  for (const t of dbTeams) teamIdMap.set(t.name, t.id);

  // Clear existing roster data
  console.log("Clearing existing roster data...");
  await prisma.teamRoster.deleteMany();
  await prisma.playerSeasonStats.deleteMany();
  await prisma.player.deleteMany();

  const asOfDate = new Date("2024-01-01");
  let playerCount = 0;
  let rosterCount = 0;

  for (const [teamName, players] of teamPlayers) {
    const teamId = teamIdMap.get(teamName);
    if (!teamId) continue;

    // Sort by overall rating descending
    players.sort((a: any, b: any) => parseInt(b.overall) - parseInt(a.overall));

    // Take top 30 players
    const squad = players.slice(0, 30);

    for (let i = 0; i < squad.length; i++) {
      const p = squad[i];
      const overall = parseInt(p.overall) || 0;
      const positions = (p.player_positions || "").replace(/"/g, "").split(",").map((s: string) => s.trim()).filter(Boolean);
      const primaryPos = p.nation_position || positions[0] || "CM";
      const position = mapPosition(primaryPos);

      // Determine roster role
      let rosterRole: "STARTER" | "ROTATION" | "BENCH" = "BENCH";
      if (i < 11) rosterRole = "STARTER";
      else if (i < 18) rosterRole = "ROTATION";

      const playerSlug = slugify(`${p.long_name || p.short_name}-${p.player_id}`);

      // Create player
      const player = await prisma.player.create({
        data: {
          name: p.long_name || p.short_name,
          slug: playerSlug,
          nationality: p.nationality_name,
          position,
          detailedPosition: primaryPos,
          currentClub: p.club_name || null,
          currentLeague: p.league_name || null,
          marketValue: parseInt(p.value_eur) || null,
          dateOfBirth: p.dob ? new Date(p.dob) : null,
        },
      });
      playerCount++;

      // Create roster entry
      await prisma.teamRoster.create({
        data: {
          teamId,
          playerId: player.id,
          asOfDate,
          isStartingXI: i < 11,
          rosterRole: rosterRole as any,
          caps: 0,
          internationalGoals: 0,
        },
      });
      rosterCount++;

      // Create season stats
      await prisma.playerSeasonStats.create({
        data: {
          playerId: player.id,
          season: "2023-24",
          league: p.league_name || "Unknown",
          compositeRating: overall,
          offensiveSubRating: overall, // simplified
          defensiveSubRating: overall,
        },
      });
    }

    if (teamPlayers.size > 20 && rosterCount % 200 === 0) {
      process.stdout.write(`  ${rosterCount} roster entries...\r`);
    }
  }

  console.log(`\nCreated ${playerCount} players`);
  console.log(`Created ${rosterCount} roster entries`);
  console.log(`Teams populated: ${teamPlayers.size}`);

  await prisma.$disconnect();
  console.log("\n=== Done! ===");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
