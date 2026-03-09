/**
 * 2026 FIFA World Cup static data.
 *
 * Groups, bracket structure, playoff paths, team name mappings.
 * Source: FIFA official draw (Dec 2025) + qualification results.
 */

// Map World Cup team names → our database team names (where they differ)
export const WC_NAME_TO_DB: Record<string, string> = {
  "Korea Republic": "South Korea",
  "Cote d'Ivoire": "Ivory Coast",
  "Cabo Verde": "Cape Verde",
  "Czechia": "Czech Republic",
  "Curacao": "Curaçao",
};

// Resolve a WC name to our DB name
export function dbName(wcName: string): string {
  return WC_NAME_TO_DB[wcName] ?? wcName;
}

// Placeholder constants for unresolved playoff spots
export const PLAYOFF_UEFA_A = "__UEFA_A__";
export const PLAYOFF_UEFA_B = "__UEFA_B__";
export const PLAYOFF_UEFA_C = "__UEFA_C__";
export const PLAYOFF_UEFA_D = "__UEFA_D__";
export const PLAYOFF_FIFA_1 = "__FIFA_1__";
export const PLAYOFF_FIFA_2 = "__FIFA_2__";

// --- GROUP STAGE ---
export const GROUPS: Record<string, string[]> = {
  A: ["Mexico", "South Africa", "Korea Republic", PLAYOFF_UEFA_D],
  B: ["Canada", PLAYOFF_UEFA_A, "Qatar", "Switzerland"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", PLAYOFF_UEFA_C],
  E: ["Germany", "Curacao", "Cote d'Ivoire", "Ecuador"],
  F: ["Netherlands", "Japan", PLAYOFF_UEFA_B, "Tunisia"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cabo Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", PLAYOFF_FIFA_2, "Norway"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", PLAYOFF_FIFA_1, "Uzbekistan", "Colombia"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};

// --- UEFA EUROPEAN PLAYOFFS (March 2026) ---
// Single-leg semifinals + single-leg final
export interface PlayoffPath {
  semi1: [string, string]; // [home, away]
  semi2: [string, string];
  targetGroup: string;
  placeholder: string;
}

export const UEFA_PLAYOFFS: Record<string, PlayoffPath> = {
  A: {
    semi1: ["Italy", "Northern Ireland"],
    semi2: ["Wales", "Bosnia and Herzegovina"],
    targetGroup: "B",
    placeholder: PLAYOFF_UEFA_A,
  },
  B: {
    semi1: ["Ukraine", "Sweden"],
    semi2: ["Poland", "Albania"],
    targetGroup: "F",
    placeholder: PLAYOFF_UEFA_B,
  },
  C: {
    semi1: ["Turkey", "Romania"],
    semi2: ["Slovakia", "Kosovo"],
    targetGroup: "D",
    placeholder: PLAYOFF_UEFA_C,
  },
  D: {
    semi1: ["Denmark", "North Macedonia"],
    semi2: ["Czechia", "Republic of Ireland"],
    targetGroup: "A",
    placeholder: PLAYOFF_UEFA_D,
  },
};

// --- FIFA INTERCONTINENTAL PLAYOFFS ---
export interface FifaPlayoffPath {
  semi: [string, string]; // [team1, team2]
  finalOpponent: string; // team waiting in the final
  targetGroup: string;
  placeholder: string;
}

export const FIFA_PLAYOFFS: Record<string, FifaPlayoffPath> = {
  "1": {
    semi: ["New Caledonia", "Jamaica"],
    finalOpponent: "DR Congo",
    targetGroup: "K",
    placeholder: PLAYOFF_FIFA_1,
  },
  "2": {
    semi: ["Bolivia", "Suriname"],
    finalOpponent: "Iraq",
    targetGroup: "I",
    placeholder: PLAYOFF_FIFA_2,
  },
};

// --- ROUND OF 32 BRACKET ---
// Each match specifies: home source, away source
// Sources: "1X" = winner of group X, "2X" = runner-up of group X
// "3rd" with eligible groups means one of the qualifying 3rd-place teams
export interface R32Match {
  num: number;
  home: string; // e.g. "2A", "1E"
  away: string; // e.g. "2B", "3rd"
  eligible3rd?: string[]; // groups eligible for the 3rd-place slot
}

export const R32_MATCHES: R32Match[] = [
  // Left pathway
  { num: 73, home: "2A", away: "2B" },
  { num: 74, home: "1E", away: "3rd", eligible3rd: ["A", "B", "C", "D", "F"] },
  { num: 75, home: "1F", away: "2C" },
  { num: 76, home: "1C", away: "2F" },
  { num: 77, home: "1I", away: "3rd", eligible3rd: ["C", "D", "F", "G", "H"] },
  { num: 78, home: "2E", away: "2I" },
  { num: 79, home: "1A", away: "3rd", eligible3rd: ["C", "E", "F", "H", "I"] },
  { num: 80, home: "1L", away: "3rd", eligible3rd: ["E", "H", "I", "J", "K"] },
  // Right pathway
  { num: 81, home: "1D", away: "3rd", eligible3rd: ["B", "E", "F", "I", "J"] },
  { num: 82, home: "1G", away: "3rd", eligible3rd: ["A", "E", "H", "I", "J"] },
  { num: 83, home: "2K", away: "2L" },
  { num: 84, home: "1H", away: "2J" },
  { num: 85, home: "1B", away: "3rd", eligible3rd: ["E", "F", "G", "I", "J"] },
  { num: 86, home: "1J", away: "2H" },
  { num: 87, home: "1K", away: "3rd", eligible3rd: ["D", "E", "I", "J", "L"] },
  { num: 88, home: "2D", away: "2G" },
];

// Round of 16 bracket
export const R16_MATCHES = [
  { num: 89, home: 74, away: 77 },
  { num: 90, home: 73, away: 75 },
  { num: 91, home: 76, away: 78 },
  { num: 92, home: 79, away: 80 },
  { num: 93, home: 83, away: 84 },
  { num: 94, home: 81, away: 82 },
  { num: 95, home: 86, away: 88 },
  { num: 96, home: 85, away: 87 },
];

// Quarterfinals
export const QF_MATCHES = [
  { num: 97, home: 89, away: 90 },
  { num: 98, home: 93, away: 94 },
  { num: 99, home: 91, away: 92 },
  { num: 100, home: 95, away: 96 },
];

// Semifinals
export const SF_MATCHES = [
  { num: 101, home: 97, away: 98 },
  { num: 102, home: 99, away: 100 },
];

// Final
export const FINAL_MATCH = { num: 104, home: 101, away: 102 };
export const THIRD_PLACE_MATCH = { num: 103, homeLoss: 101, awayLoss: 102 };

// --- KNOCKOUT MATCH SCHEDULE ---
// Dates and venues for all knockout matches (2026 FIFA World Cup)
export const MATCH_SCHEDULE: Record<number, { date: string; venue: string; city: string }> = {
  // R32 — June 28 – July 3
  73: { date: "Jun 28", venue: "MetLife Stadium", city: "New York/NJ" },
  74: { date: "Jun 28", venue: "Lumen Field", city: "Seattle" },
  75: { date: "Jun 28", venue: "AT&T Stadium", city: "Dallas" },
  76: { date: "Jun 29", venue: "Hard Rock Stadium", city: "Miami" },
  77: { date: "Jun 29", venue: "NRG Stadium", city: "Houston" },
  78: { date: "Jun 29", venue: "SoFi Stadium", city: "Los Angeles" },
  79: { date: "Jun 30", venue: "Estadio Azteca", city: "Mexico City" },
  80: { date: "Jun 30", venue: "Gillette Stadium", city: "Boston" },
  81: { date: "Jun 30", venue: "Levi's Stadium", city: "Santa Clara" },
  82: { date: "Jul 1", venue: "Mercedes-Benz Stadium", city: "Atlanta" },
  83: { date: "Jul 1", venue: "SoFi Stadium", city: "Los Angeles" },
  84: { date: "Jul 1", venue: "BMO Field", city: "Toronto" },
  85: { date: "Jul 2", venue: "BBVA Stadium", city: "Monterrey" },
  86: { date: "Jul 2", venue: "Arrowhead Stadium", city: "Kansas City" },
  87: { date: "Jul 2", venue: "BC Place", city: "Vancouver" },
  88: { date: "Jul 3", venue: "AT&T Stadium", city: "Dallas" },
  // R16 — July 4–7
  89: { date: "Jul 4", venue: "Lincoln Financial Field", city: "Philadelphia" },
  90: { date: "Jul 4", venue: "NRG Stadium", city: "Houston" },
  91: { date: "Jul 5", venue: "MetLife Stadium", city: "New York/NJ" },
  92: { date: "Jul 5", venue: "Estadio Azteca", city: "Mexico City" },
  93: { date: "Jul 6", venue: "Lumen Field", city: "Seattle" },
  94: { date: "Jul 6", venue: "AT&T Stadium", city: "Dallas" },
  95: { date: "Jul 7", venue: "Mercedes-Benz Stadium", city: "Atlanta" },
  96: { date: "Jul 7", venue: "BC Place", city: "Vancouver" },
  // QF — July 9–11
  97: { date: "Jul 9", venue: "Gillette Stadium", city: "Boston" },
  98: { date: "Jul 10", venue: "SoFi Stadium", city: "Los Angeles" },
  99: { date: "Jul 10", venue: "Hard Rock Stadium", city: "Miami" },
  100: { date: "Jul 11", venue: "Arrowhead Stadium", city: "Kansas City" },
  // SF — July 14–15
  101: { date: "Jul 14", venue: "AT&T Stadium", city: "Dallas" },
  102: { date: "Jul 15", venue: "Mercedes-Benz Stadium", city: "Atlanta" },
  // 3rd Place & Final
  103: { date: "Jul 18", venue: "Hard Rock Stadium", city: "Miami" },
  104: { date: "Jul 19", venue: "MetLife Stadium", city: "New York/NJ" },
};

// All confirmed teams (not in playoffs)
export const CONFIRMED_TEAMS = [
  "Mexico", "South Africa", "Korea Republic",
  "Canada", "Qatar", "Switzerland",
  "Brazil", "Morocco", "Haiti", "Scotland",
  "United States", "Paraguay", "Australia",
  "Germany", "Curacao", "Cote d'Ivoire", "Ecuador",
  "Netherlands", "Japan", "Tunisia",
  "Belgium", "Egypt", "Iran", "New Zealand",
  "Spain", "Cabo Verde", "Saudi Arabia", "Uruguay",
  "France", "Senegal", "Norway",
  "Argentina", "Algeria", "Austria", "Jordan",
  "Portugal", "Uzbekistan", "Colombia",
  "England", "Croatia", "Ghana", "Panama",
];

// All playoff contenders
export const PLAYOFF_TEAMS = [
  // UEFA
  "Italy", "Northern Ireland", "Wales", "Bosnia and Herzegovina",
  "Ukraine", "Sweden", "Poland", "Albania",
  "Turkey", "Romania", "Slovakia", "Kosovo",
  "Denmark", "North Macedonia", "Czechia", "Republic of Ireland",
  // FIFA
  "New Caledonia", "Jamaica", "DR Congo",
  "Bolivia", "Suriname", "Iraq",
];
