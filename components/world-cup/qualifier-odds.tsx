"use client";

interface QualifierOddsProps {
  qualifierOdds: Record<string, {
    description: string;
    teams: Record<string, number>;
  }>;
}

function ProbBar({ prob, color }: { prob: number; color: string }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${prob * 100}%` }}
        />
      </div>
      <span className="text-sm font-mono w-14 text-right">
        {(prob * 100).toFixed(1)}%
      </span>
    </div>
  );
}

const PATH_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-purple-500",
];

export function QualifierOdds({ qualifierOdds }: QualifierOddsProps) {
  const paths = Object.entries(qualifierOdds);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Playoff Qualification Odds</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paths.map(([pathId, data], pathIdx) => {
          const sorted = Object.entries(data.teams).sort((a, b) => b[1] - a[1]);
          return (
            <div key={pathId} className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">{data.description}</h3>
              {sorted.map(([name, prob]) => (
                <div key={name} className="space-y-1">
                  <span className="text-sm">{name}</span>
                  <ProbBar prob={prob} color={PATH_COLORS[pathIdx % PATH_COLORS.length]} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
