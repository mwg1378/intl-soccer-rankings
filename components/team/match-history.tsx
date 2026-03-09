"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  W: "bg-green-500/15 text-green-700 dark:text-green-400",
  D: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  L: "bg-red-500/15 text-red-700 dark:text-red-400",
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Opponent</TableHead>
          <TableHead className="hidden sm:table-cell">Score</TableHead>
          <TableHead className="hidden md:table-cell">Tournament</TableHead>
          <TableHead className="hidden md:table-cell">Venue</TableHead>
          <TableHead className="text-right">Elo +/-</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((match) => {
          const result = getResult(match);
          return (
            <TableRow key={match.id}>
              <TableCell className="tabular-nums text-muted-foreground">
                {formatDate(match.date)}
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold",
                    resultStyles[result]
                  )}
                >
                  {result}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/team/${match.opponentSlug}`}
                  className="hover:underline"
                >
                  {match.opponentName}
                </Link>
              </TableCell>
              <TableCell className="hidden sm:table-cell tabular-nums">
                {match.homeScore}&ndash;{match.awayScore}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({match.isHome ? "H" : "A"})
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {match.tournament}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {match.venue}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums font-medium",
                  (match.eloChange ?? 0) > 0
                    ? "text-green-600 dark:text-green-400"
                    : (match.eloChange ?? 0) < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                )}
              >
                {match.eloChange != null
                  ? `${match.eloChange > 0 ? "+" : ""}${match.eloChange.toFixed(1)}`
                  : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
