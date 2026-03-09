"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface Player {
  id: string;
  name: string;
  position: string;
  detailedPosition: string | null;
  currentClub: string | null;
  currentLeague: string | null;
  marketValue: number | null;
  compositeRating: number | null;
  caps: number;
  internationalGoals: number;
  isStartingXI: boolean;
  rosterRole: string;
}

interface RosterTableProps {
  players: Player[];
}

type SortField = "position" | "compositeRating" | "marketValue";
type SortDir = "asc" | "desc";

const positionOrder: Record<string, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
};

const positionColors: Record<string, string> = {
  GK: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  DEF: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  MID: "bg-green-500/15 text-green-700 dark:text-green-400",
  FWD: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function formatMarketValue(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `\u20AC${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `\u20AC${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
  }
  return `\u20AC${value}`;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) {
    return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-muted-foreground/50" />;
  }
  return sortDir === "asc"
    ? <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
    : <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
}

export function RosterTable({ players }: RosterTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "position" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...players];
    if (!sortField) return copy;

    copy.sort((a, b) => {
      let cmp: number;
      if (sortField === "position") {
        cmp = (positionOrder[a.position] ?? 99) - (positionOrder[b.position] ?? 99);
      } else {
        cmp = ((a[sortField] as number) ?? 0) - ((b[sortField] as number) ?? 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [players, sortField, sortDir]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead
            className="cursor-pointer select-none"
            onClick={() => handleSort("position")}
          >
            Pos <SortIcon field="position" sortField={sortField} sortDir={sortDir} />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="hidden md:table-cell">Detailed Pos</TableHead>
          <TableHead className="hidden lg:table-cell">Club</TableHead>
          <TableHead className="hidden lg:table-cell">League</TableHead>
          <TableHead
            className="cursor-pointer select-none text-right"
            onClick={() => handleSort("compositeRating")}
          >
            Rating <SortIcon field="compositeRating" sortField={sortField} sortDir={sortDir} />
          </TableHead>
          <TableHead
            className="cursor-pointer select-none text-right"
            onClick={() => handleSort("marketValue")}
          >
            Value <SortIcon field="marketValue" sortField={sortField} sortDir={sortDir} />
          </TableHead>
          <TableHead className="hidden sm:table-cell text-right">Caps</TableHead>
          <TableHead className="hidden sm:table-cell text-right">Goals</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((player) => (
          <TableRow key={player.id}>
            <TableCell>
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold",
                  positionColors[player.position] ?? "bg-muted text-muted-foreground"
                )}
              >
                {player.position}
              </span>
            </TableCell>
            <TableCell className="font-medium">
              <span className="flex items-center gap-2">
                {player.name}
                {player.isStartingXI && (
                  <Badge variant="default" className="text-[10px] leading-none">
                    XI
                  </Badge>
                )}
              </span>
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">
              {player.detailedPosition}
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              {player.currentClub}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-muted-foreground">
              {player.currentLeague}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {player.compositeRating?.toFixed(1) ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMarketValue(player.marketValue)}
            </TableCell>
            <TableCell className="hidden sm:table-cell text-right tabular-nums">
              {player.caps}
            </TableCell>
            <TableCell className="hidden sm:table-cell text-right tabular-nums">
              {player.internationalGoals}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
