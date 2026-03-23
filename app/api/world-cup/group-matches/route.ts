import { prisma } from "@/lib/prisma";
import { predictMatch } from "@/lib/prediction-engine";
import { NextResponse } from "next/server";
import {
  UEFA_PLAYOFFS,
  FIFA_PLAYOFFS,
  dbName,
} from "@/lib/world-cup-data";
import { GROUP_STAGE_SCHEDULE } from "@/lib/world-cup-group-schedule";

export const dynamic = "force-dynamic";

interface MatchPrediction {
  matchNum: number;
  home: string;
  away: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  homeXg: number;
  awayXg: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  topScorelines: Array<{ home: number; away: number; prob: number }>;
  isPlayoffTeam: boolean;
  playoffPath?: string;
}

// Build placeholder → { contenders, path } map
function buildPlayoffMap() {
  const map: Record<string, { teams: string[]; path: string }> = {};
  for (const [pathId, path] of Object.entries(UEFA_PLAYOFFS)) {
    map[path.placeholder] = {
      teams: [...path.semi1, ...path.semi2].map(dbName),
      path: `UEFA ${pathId}`,
    };
  }
  for (const [pathId, path] of Object.entries(FIFA_PLAYOFFS)) {
    map[path.placeholder] = {
      teams: [...path.semi, path.finalOpponent].map(dbName),
      path: `FIFA ${pathId}`,
    };
  }
  return map;
}

// Host nations that get home advantage
const HOST_TEAMS = new Set(["Mexico", "Canada", "United States"]);

export async function GET() {
  const allTeams = await prisma.team.findMany({
    where: { currentRank: { gt: 0 } },
  });
  const teamByName = new Map(allTeams.map(t => [t.name, t]));

  const n = allTeams.length;
  const avgOff = allTeams.reduce((s, t) => s + t.gridOptOff, 0) / n;
  const avgDef = allTeams.reduce((s, t) => s + t.gridOptDef, 0) / n;
  const stdOff = Math.sqrt(allTeams.reduce((s, t) => s + (t.gridOptOff - avgOff) ** 2, 0) / n);
  const stdDef = Math.sqrt(allTeams.reduce((s, t) => s + (t.gridOptDef - avgDef) ** 2, 0) / n);

  const playoffMap = buildPlayoffMap();

  function predict(homeName: string, awayName: string) {
    const home = teamByName.get(homeName);
    const away = teamByName.get(awayName);
    if (!home || !away) return null;

    // Host nations playing in their country get home advantage
    const homeIsHost = HOST_TEAMS.has(homeName);
    const neutral = !homeIsHost;

    const result = predictMatch({
      homeTeam: { offensive: home.gridOptOff, defensive: home.gridOptDef },
      awayTeam: { offensive: away.gridOptOff, defensive: away.gridOptDef },
      neutralVenue: neutral,
      matchImportance: "TOURNAMENT_GROUP",
      homeAdvantage: neutral ? undefined : home.homeAdvantage,
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

  // Group matches by group
  const result: Record<string, {
    teams: string[];
    playoffTeams?: string[];
    playoffPath?: string;
    matches: MatchPrediction[];
  }> = {};

  // Initialize groups
  const groups = new Set(GROUP_STAGE_SCHEDULE.map(m => m.group));
  for (const g of groups) {
    result[g] = { teams: [], matches: [] };
  }

  for (const match of GROUP_STAGE_SCHEDULE) {
    const isHomePlaceholder = match.home.startsWith("__");
    const isAwayPlaceholder = match.away.startsWith("__");

    if (!isHomePlaceholder && !isAwayPlaceholder) {
      // Both teams confirmed — single prediction
      const homeName = dbName(match.home);
      const awayName = dbName(match.away);
      const pred = predict(homeName, awayName);
      if (pred) {
        result[match.group].matches.push({
          matchNum: match.matchNum,
          home: homeName,
          away: awayName,
          date: match.date,
          time: match.time,
          venue: match.venue,
          city: match.city,
          ...pred,
          isPlayoffTeam: false,
        });
      }
    } else {
      // One team is a playoff placeholder — expand to all contenders
      const placeholder = isHomePlaceholder ? match.home : match.away;
      const info = playoffMap[placeholder];
      if (!info) continue;

      result[match.group].playoffTeams = info.teams;
      result[match.group].playoffPath = info.path;

      for (const contender of info.teams) {
        const homeName = isHomePlaceholder ? contender : dbName(match.home);
        const awayName = isAwayPlaceholder ? contender : dbName(match.away);
        const pred = predict(homeName, awayName);
        if (pred) {
          result[match.group].matches.push({
            matchNum: match.matchNum,
            home: homeName,
            away: awayName,
            date: match.date,
            time: match.time,
            venue: match.venue,
            city: match.city,
            ...pred,
            isPlayoffTeam: true,
            playoffPath: info.path,
          });
        }
      }
    }
  }

  // Collect confirmed team names per group
  for (const match of GROUP_STAGE_SCHEDULE) {
    const g = result[match.group];
    for (const t of [match.home, match.away]) {
      if (!t.startsWith("__")) {
        const name = dbName(t);
        if (!g.teams.includes(name)) g.teams.push(name);
      }
    }
  }

  return NextResponse.json(result);
}
