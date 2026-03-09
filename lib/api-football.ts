/**
 * API-Football client — minimal wrapper for fetching international match results.
 *
 * Free plan: 100 requests/day. We use ~1 request/day (fixtures by date).
 * All filtering for international matches is done client-side to minimize API calls.
 */

const API_BASE = "https://v3.football.api-sports.io";

// International competition league IDs in API-Football
// These cover all major international "A" team competitions
export const INTERNATIONAL_LEAGUE_IDS = new Set([
  // World Cup & Qualifiers
  1,    // World Cup
  32,   // World Cup Qualification - Europe
  33,   // World Cup Qualification - South America
  34,   // World Cup Qualification - CONCACAF
  35,   // World Cup Qualification - Africa
  36,   // World Cup Qualification - Asia
  37,   // World Cup Qualification - Oceania

  // Continental tournaments
  4,    // Euro Championship
  9,    // Copa America
  6,    // Africa Cup of Nations
  7,    // Asian Cup
  29,   // CONCACAF Gold Cup

  // Nations Leagues & qualifiers
  5,    // UEFA Nations League
  10,   // CONMEBOL/AFC intercontinental
  15,   // Friendlies (international)

  // Continental qualifiers
  30,   // Euro Qualification
  31,   // AFCON Qualification
]);

// Map API-Football league IDs to our MatchImportance enum
export function leagueToImportance(
  leagueId: number,
  round?: string
): string {
  if (leagueId === 15) return "FRIENDLY";

  if (leagueId === 5) return "NATIONS_LEAGUE";

  if ([32, 33, 34, 35, 36, 37, 30, 31].includes(leagueId))
    return "QUALIFIER";

  // Tournament matches — check round for group vs knockout
  if ([1, 4, 9, 6, 7, 29, 10].includes(leagueId)) {
    const r = (round ?? "").toLowerCase();
    if (
      r.includes("quarter") ||
      r.includes("semi") ||
      r.includes("final") ||
      r.includes("round of")
    ) {
      return "TOURNAMENT_KNOCKOUT";
    }
    return "TOURNAMENT_GROUP";
  }

  return "FRIENDLY";
}

interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    venue: { name: string; city: string } | null;
    status: { short: string };
  };
  league: {
    id: number;
    name: string;
    round: string;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface ParsedMatch {
  apiFootballId: number;
  date: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homeScoreExtraTime: number | null;
  awayScoreExtraTime: number | null;
  homeScorePenalties: number | null;
  awayScorePenalties: number | null;
  tournament: string;
  tournamentStage: string;
  venue: string | null;
  neutralVenue: boolean;
  matchImportance: string;
  source: string;
}

/**
 * Fetch all finished fixtures for a given date.
 * This is ONE API call regardless of how many matches happened.
 *
 * Cost: 1 request
 */
async function fetchFixturesByDate(date: string): Promise<ApiFixture[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error("API_FOOTBALL_KEY not set");

  const res = await fetch(`${API_BASE}/fixtures?date=${date}`, {
    headers: {
      "x-apisports-key": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`API-Football returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.response ?? [];
}

/**
 * Fetch yesterday's international match results.
 *
 * Total API cost: 1 request per day.
 * All filtering is done client-side.
 */
export async function fetchInternationalMatches(
  date?: string
): Promise<ParsedMatch[]> {
  // Default to yesterday
  const targetDate =
    date ??
    new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // 1 API call — get ALL fixtures for the date
  const allFixtures = await fetchFixturesByDate(targetDate);

  // Filter client-side: only international matches that are finished
  const finished = allFixtures.filter(
    (f) =>
      INTERNATIONAL_LEAGUE_IDS.has(f.league.id) &&
      ["FT", "AET", "PEN"].includes(f.fixture.status.short)
  );

  // Parse into our format — no additional API calls needed
  return finished.map((f) => ({
    apiFootballId: f.fixture.id,
    date: targetDate,
    homeTeamName: f.teams.home.name,
    awayTeamName: f.teams.away.name,
    homeScore: f.score.fulltime.home ?? f.goals.home ?? 0,
    awayScore: f.score.fulltime.away ?? f.goals.away ?? 0,
    homeScoreExtraTime: f.score.extratime.home,
    awayScoreExtraTime: f.score.extratime.away,
    homeScorePenalties: f.score.penalty.home,
    awayScorePenalties: f.score.penalty.away,
    tournament: f.league.name,
    tournamentStage: f.league.round,
    venue: f.fixture.venue
      ? `${f.fixture.venue.name}, ${f.fixture.venue.city}`
      : null,
    neutralVenue: false, // API doesn't reliably provide this; manual override needed for tournament venues
    matchImportance: leagueToImportance(f.league.id, f.league.round),
    source: `api-football:${f.fixture.id}`,
  }));
}
