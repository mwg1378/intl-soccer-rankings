"use client";

import { useState, useEffect } from "react";
import { RankingsTable } from "@/components/rankings/rankings-table";
import {
  ConfederationFilter,
  type Confederation,
} from "@/components/rankings/confederation-filter";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RankingsPage() {
  const [confederation, setConfederation] = useState<Confederation>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...(confederation !== "ALL" && { confederation }),
  });

  const { data, isLoading } = useSWR(
    `/api/rankings?${params.toString()}`,
    fetcher
  );

  useEffect(() => {
    setPage(1);
  }, [confederation]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Full Rankings</h1>
        <p className="text-muted-foreground">
          All 211 FIFA member nations ranked
        </p>
      </div>

      <ConfederationFilter
        selected={confederation}
        onSelect={setConfederation}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      ) : data?.teams ? (
        <>
          <RankingsTable teams={data.teams} />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, data.total)} of {data.total} teams
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= (data.total ?? 0)}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">No teams found.</p>
      )}
    </div>
  );
}
