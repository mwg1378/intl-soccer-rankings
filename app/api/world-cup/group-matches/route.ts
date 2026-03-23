import { prisma } from "@/lib/prisma";
import { predictMatch } from "@/lib/prediction-engine";
import { NextResponse } from "next/server";
import {
  GROUPS,
  UEFA_PLAYOFFS,
  FIFA_PLAYOFFS,
  dbName,
  GROUP_HOST,
} from "@/lib/world-cup-data";

// Host nations per group (for home advantage)
const GROUP_HOST_MAP: Record<string, string> = {
  A: "Mexico",
  B: "Canada",
  D: "United States",
};

export const dynamic = "force-dynamic";

interface MatchPrediction {
  home: string;
  away: string;
  homeXg: number;
  awayXg: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  topScorelines: Array<{ home: number; away: number; prob: number }>;
  isPlayoffTeam: boolean; // whether one of the teams is a playoff placeholder
  playoffPath?: string;   // e.g. "UEFA_D" if a playoff team is involved
}

interface GroupMatchesResult {
  [groupId: string]: {
    teams: string[];       // resolved team names
    playoffTeams?: string[]; // possible playoff teams for this group
    playoffPath?: string;
    matches: MatchPrediction[];
  };
}

export async function GET() {
  // Load all teams
  const allTeams = await prisma.team.findMany({
    where: { currentRank: { gt: 0 } },
  });

  const teamByName = new Map(allTeams.map(t => [t.name, t]));

  // Compute rating stats for prediction engine (use gridOpt ratings)
  const n = allTeams.length;
  const avgOff = allTeams.reduce((s, t) => s + t.gridOptOff, 0) / n;
  const avgDef = allTeams.reduce((s, t) => s + t.gridOptDef, 0) / n;
  const stdOff = Math.sqrt(allTeams.reduce((s, t) => s + (t.gridOptOff - avgOff) ** 2, 0) / n);
  const stdDef = Math.sqrt(allTeams.reduce((s, t) => s + (t.gridOptDef - avgDef) ** 2, 0) / n);

  // Build playoff contender map: placeholder → [possible team names]
  const playoffContenders: Record<string, { teams: string[]; path: string }> = {};
  for (const [pathId, path] of Object.entries(UEFA_PLAYOFFS)) {
    playoffContenders[path.placeholder] = {
      teams: [...path.semi1, ...path.semi2].map(dbName),
      path: `UEFA ${pathId}`,
    };
  }
  for (const [pathId, path] of Object.entries(FIFA_PLAYOFFS)) {
    playoffContenders[path.placeholder] = {
      teams: [...path.semi, path.finalOpponent].map(dbName),
      path: `FIFA ${pathId}`,
    };
  }

  function predict(
    homeName: string,
    awayName: string,
    neutral: boolean,
    homeHA?: number,
  ) {
    const home = teamByName.get(homeName);
    const away = teamByName.get(awayName);
    if (!home || !away) return null;

    const result = predictMatch({
      homeTeam: { offensive: home.gridOptOff, defensive: home.gridOptDef },
      awayTeam: { offensive: away.gridOptOff, defensive: away.gridOptDef },
      neutralVenue: neutral,
      matchImportance: "TOURNAMENT_GROUP",
      homeAdvantage: neutral ? undefined : homeHA,
      avgOffensive: avgOff,
      avgDefensive: avgDef,
      stdOffensive: stdOff,
      stdDefensive: stdDef,
    });

    return {
      homeXg: result.homeExpectedGoals,
      awayXg: result.awayExpectedGoals,
      homeWin: result.homeWinProb,
      draw: result.drawProb,
      awayWin: result.awayWinProb,
      topScorelines: result.topScorelines.slice(0, 6).map(s => ({
        home: s.homeGoals,
        away: s.awayGoals,
        prob: s.probability,
      })),
    };
  }

  const groupResults: GroupMatchesResult = {};

  for (const [groupId, groupTeams] of Object.entries(GROUPS)) {
    const hostTeam = GROUP_HOST_MAP[groupId];

    // Check if group has a playoff placeholder
    const playoffSlot = groupTeams.find(t => t.startsWith("__"));
    const playoffInfo = playoffSlot ? playoffContenders[playoffSlot] : undefined;

    // Resolve confirmed teams
    const confirmedTeams = groupTeams.filter(t => !t.startsWith("__")).map(dbName);

    // Generate all match combos for confirmed teams
    const matches: MatchPrediction[] = [];

    // Confirmed vs confirmed
    for (let i = 0; i < confirmedTeams.length; i++) {
      for (let j = i + 1; j < confirmedTeams.length; j++) {
        let homeName = confirmedTeams[i];
        let awayName = confirmedTeams[j];
        let neutral = true;

        // If host is in this matchup, they're "home"
        if (hostTeam && dbName(hostTeam) === homeName) {
          neutral = false;
        } else if (hostTeam && dbName(hostTeam) === awayName) {
          [homeName, awayName] = [awayName, homeName];
          neutral = false;
        }

        const homeTeam = teamByName.get(homeName);
        const pred = predict(homeName, awayName, neutral, neutral ? undefined : homeTeam?.homeAdvantage);
        if (pred) {
          matches.push({ home: homeName, away: awayName, ...pred, isPlayoffTeam: false });
        }
      }
    }

    // Confirmed vs each possible playoff team
    if (playoffInfo) {
      for (const playoffTeamName of playoffInfo.teams) {
        for (const confirmedName of confirmedTeams) {
          // Match 1: confirmed vs playoff
          let home1 = confirmedName;
          let away1 = playoffTeamName;
          let neutral1 = true;

          if (hostTeam && dbName(hostTeam) === home1) {
            neutral1 = false;
          }

          const homeTeam1 = teamByName.get(home1);
          const pred1 = predict(home1, away1, neutral1, neutral1 ? undefined : homeTeam1?.homeAdvantage);
          if (pred1) {
            matches.push({
              home: home1, away: away1, ...pred1,
              isPlayoffTeam: true, playoffPath: playoffInfo.path,
            });
          }

          // Match 2: playoff vs confirmed (reverse)
          let home2 = playoffTeamName;
          let away2 = confirmedName;
          let neutral2 = true;

          if (hostTeam && dbName(hostTeam) === away2) {
            [home2, away2] = [away2, home2];
            neutral2 = false;
          }

          // Skip if same matchup as above (just reversed)
          if (home2 === home1 && away2 === away1) continue;

          const homeTeam2 = teamByName.get(home2);
          const pred2 = predict(home2, away2, neutral2, neutral2 ? undefined : homeTeam2?.homeAdvantage);
          if (pred2) {
            matches.push({
              home: home2, away: away2, ...pred2,
              isPlayoffTeam: true, playoffPath: playoffInfo.path,
            });
          }
        }
      }
    }

    groupResults[groupId] = {
      teams: confirmedTeams,
      playoffTeams: playoffInfo?.teams,
      playoffPath: playoffInfo?.path,
      matches,
    };
  }

  return NextResponse.json(groupResults);
}
