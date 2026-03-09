"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

interface RankingDataPoint {
  date: string;
  rank: number;
  rating: number;
}

interface RankingChartProps {
  data: RankingDataPoint[];
}

function formatDateTick(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "2-digit",
    month: "short",
  });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  const date = new Date(label);
  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const rank = payload.find((p) => p.dataKey === "rank")?.value;
  const rating = payload.find((p) => p.dataKey === "rating")?.value;

  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium">{formatted}</p>
      {rank != null && (
        <p className="text-gray-500">
          Rank: <span className="font-semibold text-[#1a2b4a]">#{rank}</span>
        </p>
      )}
      {rating != null && (
        <p className="text-gray-500">
          Rating:{" "}
          <span className="font-semibold text-[#1a2b4a]">
            {rating.toFixed(1)}
          </span>
        </p>
      )}
    </div>
  );
}

export function RankingChart({ data }: RankingChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        No ranking data available.
      </div>
    );
  }

  const maxRank = Math.max(...data.map((d) => d.rank));
  const minRating = Math.min(...data.map((d) => d.rating));
  const maxRating = Math.max(...data.map((d) => d.rating));

  const ratingPadding = (maxRating - minRating) * 0.1 || 50;

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
        />
        <YAxis
          yAxisId="rank"
          orientation="left"
          reversed
          domain={[1, Math.max(maxRank + 5, 10)]}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          label={{
            value: "Rank",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12, fill: "#9ca3af" },
          }}
        />
        <YAxis
          yAxisId="rating"
          orientation="right"
          domain={[
            Math.floor(minRating - ratingPadding),
            Math.ceil(maxRating + ratingPadding),
          ]}
          tick={{ fontSize: 12, fill: "#9ca3af" }}
          label={{
            value: "Rating",
            angle: 90,
            position: "insideRight",
            style: { fontSize: 12, fill: "#9ca3af" },
          }}
        />
        <RechartsTooltip content={<CustomTooltip />} />
        <Line
          yAxisId="rank"
          type="monotone"
          dataKey="rank"
          stroke="#1a2b4a"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          yAxisId="rating"
          type="monotone"
          dataKey="rating"
          stroke="#9ca3af"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
