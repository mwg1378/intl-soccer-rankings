"use client";

import { LineChart, Line, YAxis } from "recharts";

interface SparklineDataPoint {
  date: string;
  rating: number;
}

interface RatingSparklineProps {
  data: SparklineDataPoint[];
}

export function RatingSparkline({ data }: RatingSparklineProps) {
  if (!data || data.length < 2) {
    return <span className="inline-block h-5 w-[50px]" />;
  }

  const ratings = data.map((d) => d.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const padding = (max - min) * 0.1 || 1;

  return (
    <span className="inline-block align-middle">
      <LineChart width={50} height={20} data={data}>
        <YAxis domain={[min - padding, max + padding]} hide />
        <Line
          type="monotone"
          dataKey="rating"
          stroke="currentColor"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </span>
  );
}
