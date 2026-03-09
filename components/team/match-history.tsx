"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  date: string;
  opponentName: string;
  opponentSlug: string;
  tournament: string;
  venue: string;
  homeScore: number;
  awayScore: number;
  isHome: boolean;
  eloChange: number | null;
}

interface MatchHistoryProps {
  matches: Match[];
}

function getResult(match: Match): "W" | "D" | "L" {
  const teamScore = match.isHome ? match.homeScore : match.awayScore;
  const opponentScore = match.isHome ? match.awayScore : match.homeScore;
  if (teamScore > opponentScore) return "W";
  if (teamScore === opponentScore) return "D";
  return "L";
}

const resultStyles: Record<string, string> = {
  W: "bg-green-500/15 text-green-700",
  D: "bg-yellow-500/15 text-yellow-700",
  L: "bg-red-500/15 text-red-700",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MatchHistory({ matches }: MatchHistoryProps) {
  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="tr-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Result</th>
            <th>Opponent</th>
            <th className="hidden sm:table-cell">Score</th>
            <th className="hidden md:table-cell">Tournament</th>
            <th className="hidden md:table-cell">Venue</th>
            <th className="text-right">Elo +/-</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const result = getResult(match);
            return (
              <tr key={match.id}>
                <td className="tabular-nums text-gray-400">
                  {formatDate(match.date)}
                </td>
                <td>
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold",
                      resultStyles[result]
                    )}
                  >
                    {result}
                  </span>
                </td>
                <td className="font-medium">
                  <Link
                    href={`/team/${match.opponentSlug}`}
                    className="hover:underline"
                  >
                    {match.opponentName}
                  </Link>
                </td>
                <td className="hidden sm:table-cell tabular-nums">
                  {match.homeScore}&ndash;{match.awayScore}
                  <span className="ml-1.5 text-xs text-gray-400">
                    ({match.isHome ? "H" : "A"})
                  </span>
                </td>
                <td className="hidden md:table-cell text-gray-400">
                  {match.tournament}
                </td>
                <td className="hidden md:table-cell text-gray-400">
                  {match.venue}
                </td>
                <td
                  className={cn(
                    "text-right tabular-nums font-medium",
                    (match.eloChange ?? 0) > 0
                      ? "text-green-600"
                      : (match.eloChange ?? 0) < 0
                        ? "text-red-600"
                        : "text-gray-400"
                  )}
                >
                  {match.eloChange != null
                    ? `${match.eloChange > 0 ? "+" : ""}${match.eloChange.toFixed(1)}`
                    : "\u2014"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
