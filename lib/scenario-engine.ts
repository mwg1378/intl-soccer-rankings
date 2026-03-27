/**
 * Scenario Engine — Client-side "What If" group stage calculator.
 *
 * Given a set of user-specified match results for a group, computes
 * the resulting standings, which teams qualify, and downstream bracket
 * implications. Works entirely in the browser with no API calls.
 */

export interface ScenarioMatch {
  home: string;
  away: string;
  homeGoals: number | null; // null = not yet set
  awayGoals: number | null;
}

export interface ScenarioStanding {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  position: number;
  qualified: "group_winner" | "runner_up" | "third_possible" | "eliminated";
}

/**
 * Generate all 6 round-robin matches for a 4-team group.
 */
export function generateGroupMatches(teams: string[]): ScenarioMatch[] {
  const matches: ScenarioMatch[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        home: teams[i],
        away: teams[j],
        homeGoals: null,
        awayGoals: null,
      });
    }
  }
  return matches;
}

/**
 * Compute group standings from the current set of results.
 * Matches with null goals are skipped.
 */
export function computeStandings(
  teams: string[],
  matches: ScenarioMatch[]
): ScenarioStanding[] {
  const stats = new Map<string, Omit<ScenarioStanding, "position" | "qualified">>();

  for (const team of teams) {
    stats.set(team, {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.homeGoals === null || match.awayGoals === null) continue;

    const home = stats.get(match.home)!;
    const away = stats.get(match.away)!;

    home.played++;
    away.played++;
    home.gf += match.homeGoals;
    home.ga += match.awayGoals;
    away.gf += match.awayGoals;
    away.ga += match.homeGoals;

    if (match.homeGoals > match.awayGoals) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (match.homeGoals < match.awayGoals) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    }
  }

  // Compute GD
  for (const s of stats.values()) {
    s.gd = s.gf - s.ga;
  }

  // Sort: points → GD → GF → alphabetical
  const sorted = [...stats.values()].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.gd !== b.gd) return b.gd - a.gd;
    if (a.gf !== b.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });

  return sorted.map((s, idx) => ({
    ...s,
    position: idx + 1,
    qualified:
      idx === 0
        ? "group_winner" as const
        : idx === 1
          ? "runner_up" as const
          : idx === 2
            ? "third_possible" as const
            : "eliminated" as const,
  }));
}

/**
 * Check how many matches have been completed.
 */
export function completedMatchCount(matches: ScenarioMatch[]): number {
  return matches.filter(
    (m) => m.homeGoals !== null && m.awayGoals !== null
  ).length;
}

/**
 * Determine the maximum points a team can still achieve.
 */
export function maxPossiblePoints(
  team: string,
  matches: ScenarioMatch[],
  currentPoints: number
): number {
  const remaining = matches.filter(
    (m) =>
      (m.home === team || m.away === team) &&
      (m.homeGoals === null || m.awayGoals === null)
  );
  return currentPoints + remaining.length * 3;
}

/**
 * Can a team still mathematically qualify (finish top 2)?
 */
export function canStillQualify(
  team: string,
  standings: ScenarioStanding[],
  matches: ScenarioMatch[]
): boolean {
  const teamStanding = standings.find((s) => s.team === team);
  if (!teamStanding) return false;
  if (teamStanding.position <= 2) return true;

  const maxPts = maxPossiblePoints(team, matches, teamStanding.points);
  // If we can get more points than the 2nd-place team currently has, still possible
  const secondPlace = standings[1];
  if (!secondPlace) return true;
  return maxPts >= secondPlace.points;
}
