"use client";

import { useState } from "react";
import { RankingsTable } from "@/components/rankings/rankings-table";
import {
  ConfederationFilter,
  type Confederation,
} from "@/components/rankings/confederation-filter";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RankingsPage() {
  const [confederation, setConfederation] = useState<Confederation>("ALL");

  const params = new URLSearchParams({
    pageSize: "all",
    ...(confederation !== "ALL" && { confederation }),
  });

  const { data, isLoading } = useSWR(
    `/api/rankings?${params.toString()}`,
    fetcher
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Full Rankings</h1>
        <p className="text-sm text-gray-400">
          All FIFA member nations ranked
        </p>
      </div>

      <ConfederationFilter
        selected={confederation}
        onSelect={setConfederation}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#1a2b4a]" />
        </div>
      ) : data?.teams ? (
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
