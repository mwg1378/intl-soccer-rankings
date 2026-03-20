/**
 * Compute roster-based ratings for World Cup 2026 teams.
 *
 * Uses estimated squad league quality profiles — the average quality of
 * leagues where each team's players compete. This is well-documented
 * public information (e.g., Spain's squad is ~90% top-5 European leagues,
 * Iran's squad is ~60% domestic league).
 *
 * The 70/30 Elo/roster blend then adjusts the combined ratings:
 * - Teams with players in top leagues (Spain, England) get a roster boost
 * - Teams with mostly domestic-league players (Iran, Jordan) get pulled down
 *
 * Usage: npx tsx scripts/fetch-rosters.ts
 * No API calls required.
 */

import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { combinedRating } from "../lib/ranking-engine";

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

/**
 * Squad league quality profiles for WC 2026 teams.
 *
 * Each value represents the weighted average league coefficient of the
 * team's likely starting XI + key rotation players (scale: 0-1 where
 * 1.0 = entirely Premier League caliber).
 *
 * Sources: transfermarkt.com squad pages, known club affiliations.
 * Format: [offensiveQuality, defensiveQuality]
 * - Offensive: weighted toward forwards/midfielders' league quality
 * - Defensive: weighted toward defenders/goalkeeper's league quality
 *
 * Teams with players spread across top-5 leagues score 0.85+.
 * Teams with mostly domestic-league players score 0.35-0.50.
 */
const SQUAD_PROFILES: Record<string, [number, number]> = {
  // --- UEFA ---
  // Spain: Yamal, Pedri, Rodri, Morata, Olmo (La Liga, PL, Bundesliga)
  "Spain":           [0.94, 0.93],
  // France: Mbappé, Griezmann, Dembélé, Tchouaméni (La Liga, PL, Serie A)
  "France":          [0.95, 0.92],
  // England: Bellingham, Saka, Foden, Rice, Kane (PL, La Liga, Bundesliga)
  "England":         [0.96, 0.95],
  // Germany: Musiala, Wirtz, Havertz, Sané (Bundesliga, PL)
  "Germany":         [0.92, 0.90],
  // Portugal: B.Silva, B.Fernandes, R.Dias, Cancelo (PL, La Liga, Ligue 1)
  "Portugal":        [0.93, 0.91],
  // Netherlands: Gakpo, Simons, de Ligt, Dumfries (PL, Bundesliga, Serie A)
  "Netherlands":     [0.90, 0.88],
  // Belgium: De Bruyne, Doku, Trossard, Lukaku (PL, Serie A)
  "Belgium":         [0.90, 0.85],
  // Italy: Barella, Bastoni, Donnarumma, Chiesa (Serie A, PL, Ligue 1)
  "Italy":           [0.90, 0.90],
  // Croatia: Modrić, Kovačić, Gvardiol, Brozović (PL, La Liga, Saudi)
  "Croatia":         [0.85, 0.82],
  // Switzerland: Xhaka, Akanji, Shaqiri, Embolo (Bundesliga, PL, Serie A)
  "Switzerland":     [0.82, 0.80],
  // Denmark: Eriksen, Højlund, Hjulmand, Christensen (PL, La Liga, Bundesliga)
  "Denmark":         [0.84, 0.82],
  // Austria: Sabitzer, Laimer, Arnautović (Bundesliga, Serie A)
  "Austria":         [0.78, 0.76],
  // Turkey: Çalhanoğlu, Yıldız, Güler (Serie A, La Liga, Super Lig)
  "Turkey":          [0.74, 0.68],
  // Ukraine: Mudryk, Zinchenko, Dovbyk (PL, La Liga, Serie A mix)
  "Ukraine":         [0.76, 0.70],
  // Sweden: Isak, Kulusevski, Lindelöf (PL, Serie A, Allsvenskan)
  "Sweden":          [0.74, 0.68],
  // Poland: Lewandowski, Zieliński, Szczęsny (La Liga, Serie A)
  "Poland":          [0.78, 0.72],
  // Norway: Haaland, Ødegaard, Saliba connection (PL, Bundesliga, domestic)
  "Norway":          [0.82, 0.62],
  // Scotland: Robertson, McGinn, McTominay, Tierney (PL, Serie A)
  "Scotland":        [0.76, 0.74],
  // Romania: mostly domestic + a few Bundesliga/Serie A
  "Romania":         [0.55, 0.52],
  // Wales: some PL players + domestic/Championship
  "Wales":           [0.62, 0.58],
  // Slovakia: mostly mid-European leagues
  "Slovakia":        [0.52, 0.50],
  // Kosovo: scattered across smaller European leagues
  "Kosovo":          [0.48, 0.46],
  // Albania: some Serie A + domestic
  "Albania":         [0.52, 0.50],
  // Czech Republic: some Bundesliga/PL + domestic
  "Czech Republic":  [0.60, 0.58],
  "Republic of Ireland": [0.62, 0.60],
  "Northern Ireland":    [0.48, 0.48],
  "North Macedonia":     [0.48, 0.46],
  "Bosnia and Herzegovina": [0.55, 0.52],

  // --- CONMEBOL ---
  // Argentina: Messi, Di María retired but Álvarez, Mac Allister, Enzo (PL, La Liga)
  "Argentina":       [0.92, 0.88],
  // Brazil: Vinícius, Rodrygo, Endrick, Marquinhos (La Liga, PL, Ligue 1)
  "Brazil":          [0.93, 0.90],
  // Colombia: Luis Díaz, James, Arias (PL, La Liga, Liga MX)
  "Colombia":        [0.78, 0.68],
  // Uruguay: Valverde, Araújo, Núñez, Bentancur (La Liga, PL)
  "Uruguay":         [0.82, 0.78],
  // Ecuador: some PL/Bundesliga + domestic
  "Ecuador":         [0.65, 0.58],
  // Paraguay: mostly domestic + some European
  "Paraguay":        [0.52, 0.50],
  // Bolivia: almost entirely domestic league
  "Bolivia":         [0.35, 0.34],

  // --- CONCACAF ---
  // Mexico: mix of Liga MX + some European (Lozano, Edson Álvarez)
  "Mexico":          [0.62, 0.58],
  // USA: Pulisic (Milan), McKennie (Juve), Reyna (Dortmund), Dest, Adams
  "United States":   [0.72, 0.68],
  // Canada: Davies (Bayern), David (Lille), Buchanan (Inter/Club Brugge)
  "Canada":          [0.68, 0.58],
  // Panama: mostly Liga MX + domestic
  "Panama":          [0.45, 0.42],
  // Jamaica: some PL/Championship + domestic
  "Jamaica":         [0.50, 0.45],
  // Haiti: mostly domestic + MLS fringe
  "Haiti":           [0.35, 0.34],
  // Costa Rica: Liga MX + domestic
  "Costa Rica":      [0.45, 0.42],
  "Curaçao":         [0.38, 0.36],
  "Suriname":        [0.40, 0.38],

  // --- CAF ---
  // Morocco: Hakimi, Amrabat, En-Nesyri, Ziyech (Ligue 1, PL, La Liga)
  "Morocco":         [0.80, 0.78],
  // Senegal: Koulibaly (retired?), Mané, Gueye — PL/Ligue 1/Saudi
  "Senegal":         [0.70, 0.65],
  // Nigeria: Osimhen, Lookman, Iwobi (Serie A, PL)
  "Nigeria":         [0.72, 0.58],
  // Algeria: some Ligue 1 + domestic
  "Algeria":         [0.58, 0.52],
  // Egypt: Salah (PL), rest mostly domestic/Saudi
  "Egypt":           [0.58, 0.45],
  // Ivory Coast: Haller, Kessié, Bailly — mix of European + domestic
  "Ivory Coast":     [0.62, 0.55],
  // Ghana: scattered European leagues + domestic
  "Ghana":           [0.55, 0.48],
  // South Africa: mostly domestic league
  "South Africa":    [0.38, 0.36],
  // Cape Verde: some Portuguese league + domestic
  "Cape Verde":      [0.42, 0.40],
  // Tunisia: some Ligue 1 + domestic
  "Tunisia":         [0.50, 0.45],
  // DR Congo: some European + domestic
  "DR Congo":        [0.50, 0.45],
  // Cameroon: scattered European leagues
  "Cameroon":        [0.58, 0.52],

  // --- AFC ---
  // Japan: Kubo, Mitoma, Endo, Tomiyasu (PL, La Liga, Bundesliga + J-League)
  "Japan":           [0.75, 0.70],
  // South Korea: Son (PL), Hwang, Kim (Bundesliga, Serie A + K-League)
  "South Korea":     [0.68, 0.60],
  // Iran: mostly domestic league + a few European
  "Iran":            [0.45, 0.42],
  // Australia: some PL/Championship + A-League
  "Australia":       [0.55, 0.50],
  // Saudi Arabia: mostly domestic (Saudi Pro League, well-funded)
  "Saudi Arabia":    [0.48, 0.45],
  // Qatar: almost entirely domestic
  "Qatar":           [0.42, 0.40],
  // Uzbekistan: mostly domestic + some Russian/Turkish leagues
  "Uzbekistan":      [0.40, 0.38],
  // Jordan: mostly domestic
  "Jordan":          [0.35, 0.34],
  // Iraq: mostly domestic
  "Iraq":            [0.38, 0.36],

  // --- OFC ---
  "New Zealand":     [0.42, 0.40],
  "New Caledonia":   [0.25, 0.25],
};

/**
 * Convert squad quality (0-1) to an Elo-scale rating for the roster component.
 * 1.0 → 1800 (world class squad)
 * 0.5 → 1500 (average)
 * 0.25 → 1350 (weak squad)
 */
function qualityToRating(q: number): number {
  return 1200 + q * 600;
}

async function main() {
  console.log("=== Computing Roster Ratings for WC 2026 Teams ===\n");

  const allTeams = await prisma.team.findMany();
  const teamByName = new Map(allTeams.map((t) => [t.name, t]));

  let updated = 0;

  for (const [teamName, [offQ, defQ]] of Object.entries(SQUAD_PROFILES)) {
    const team = teamByName.get(teamName);
    if (!team) {
      console.log(`  SKIP: ${teamName} not in DB`);
      continue;
    }

    const rosterOff = qualityToRating(offQ);
    // Defensive: lower = better, so invert the quality
    const rosterDef = qualityToRating(1 - defQ);

    const combined = combinedRating(
      team.eloOffensive,
      team.eloDefensive,
      rosterOff,
      rosterDef,
      team.confederation
    );

    await prisma.team.update({
      where: { id: team.id },
      data: {
        rosterOffensive: rosterOff,
        rosterDefensive: rosterDef,
        currentOffensiveRating: combined.offensive,
        currentDefensiveRating: combined.defensive,
        currentOverallRating: combined.overall,
      },
    });

    updated++;
  }

  // Re-rank all teams
  console.log("Re-ranking teams...");
  const ranked = await prisma.team.findMany({
    orderBy: { currentOverallRating: "desc" },
  });
  for (let i = 0; i < ranked.length; i++) {
    await prisma.team.update({
      where: { id: ranked[i].id },
      data: { currentRank: i + 1 },
    });
  }

  // Print top 30
  console.log("\n=== Rankings with Roster Component ===\n");
  console.log("Rank  Team                     Overall  EloOvr  RstrOff  RstrDef  Conf");
  console.log("----  ----                     -------  ------  -------  -------  ----");
  for (let i = 0; i < 30 && i < ranked.length; i++) {
    const t = ranked[i];
    const eloOvr = (t.eloOffensive + (3000 - t.eloDefensive)) / 2;
    console.log(
      `${String(i + 1).padStart(4)}  ${t.name.padEnd(25)} ${t.currentOverallRating.toFixed(0).padStart(7)}  ${eloOvr.toFixed(0).padStart(6)}  ${t.rosterOffensive.toFixed(0).padStart(7)}  ${t.rosterDefensive.toFixed(0).padStart(7)}  ${t.confederation}`
    );
  }

  console.log(`\nTeams with roster data: ${updated}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Roster computation failed:", err);
  process.exit(1);
});
