"use client";

import { useState } from "react";
import { RankingsTable } from "@/components/rankings/rankings-table";
import {
  ConfederationFilter,
  type Confederation,
} from "@/components/rankings/confederation-filter";
import useSWR from "swr";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const json = await r.json();
  if (!r.ok) throw new Error(json.details ?? json.error ?? "Unknown error");
  return json;
};

export default function RankingsPage() {
  const [confederation, setConfederation] = useState<Confederation>("ALL");

  const params = new URLSearchParams({
    pageSize: "all",
    sortBy: "gridOptOff",
    ...(confederation !== "ALL" && { confederation }),
  });

  const { data, error, isLoading } = useSWR(
    `/api/rankings?${params.toString()}`,
    fetcher,
    { errorRetryCount: 3, errorRetryInterval: 1000 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Full Rankings</h1>
        <p className="text-sm text-gray-400">
          Grid-Optimized composite (70% Combined + 30% Bradley-Terry) &mdash; best alignment with betting market odds
        </p>
        <div className="flex gap-3 mt-1">
          <a href="/rankings/compare" className="text-xs text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline">
            Compare all 12 ranking systems &rarr;
          </a>
          <a href="/rankings/elo" className="text-xs text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline">
            Elo-only &rarr;
          </a>
          <a href="/rankings/bt" className="text-xs text-gray-400 hover:text-gray-700 underline-offset-4 hover:underline">
            Bradley-Terry &rarr;
          </a>
        </div>
      </div>

      <ConfederationFilter
        selected={confederation}
        onSelect={setConfederation}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a2b4a]" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-800">Failed to load rankings</p>
          <p className="mt-1 text-sm text-red-600">{error.message}</p>
        </div>
      ) : data?.teams?.length ? (
        <>
          <RankingsTable teams={data.teams} />
          <p className="text-xs text-gray-400 text-center">
            {data.teams.length} teams
          </p>
        </>
      ) : (
        <p className="text-gray-400">No teams found.</p>
      )}
    </div>
  );
}
