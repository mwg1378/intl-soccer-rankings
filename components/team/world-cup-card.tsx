"use client";

import Link from "next/link";

export interface WorldCupInfo {
  group: string;
  champProb: number;
  finalProb: number;
  sfProb: number;
  r32Prob: number;
  firstMatch: {
    opponent: string;
    date: string;
    venue: string;
    city: string;
  } | null;
  isPlayoff: boolean;
  qualifyProb?: number;
}

function pct(v: number): string {
  if (v === 0) return "—";
  if (v < 0.001) return "<0.1%";
  return (v * 100).toFixed(1) + "%";
}

export function WorldCupCard({ info }: { info: WorldCupInfo }) {
  return (
    <div className="rounded border border-gray-200 overflow-hidden">
      <div className="bg-[#1a2b4a] px-4 py-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">World Cup 2026</h3>
        <span className="text-xs text-white/70">Group {info.group}</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Advancement odds */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {info.isPlayoff && info.qualifyProb !== undefined && (
            <OddsPill label="Qualify" value={pct(info.qualifyProb)} />
          )}
          <OddsPill label="Advance" value={pct(info.r32Prob)} />
          <OddsPill label="Semifinal" value={pct(info.sfProb)} />
          <OddsPill label="Final" value={pct(info.finalProb)} />
          <OddsPill label="Champion" value={pct(info.champProb)} highlight />
        </div>

        {/* First match */}
        {info.firstMatch && (
          <div className="text-sm">
            <span className="text-gray-400 text-xs">First match: </span>
            <span className="font-medium">vs {info.firstMatch.opponent}</span>
            <span className="text-gray-400 text-xs ml-1">
              {info.firstMatch.date} &middot; {info.firstMatch.city}
            </span>
          </div>
        )}

        <Link
          href="/world-cup/advancement"
          className="text-xs text-gray-400 hover:text-gray-600 hover:underline underline-offset-2"
        >
          Full tournament odds &rarr;
        </Link>
      </div>
    </div>
  );
}

function OddsPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
      <div className={`font-mono text-sm font-bold tabular-nums ${highlight ? "text-[#40C28A]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
