"use client";

interface QualifierOddsProps {
  qualifierOdds: Record<string, {
    description: string;
    teams: Record<string, number>;
  }>;
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function probColor(v: number): string {
  if (v >= 0.5) return "text-green-700 font-semibold";
  if (v >= 0.3) return "text-green-600";
  if (v >= 0.15) return "text-gray-700";
  if (v >= 0.05) return "text-gray-400";
  return "text-gray-300";
}

export function QualifierOdds({ qualifierOdds }: QualifierOddsProps) {
  const paths = Object.entries(qualifierOdds);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paths.map(([pathId, data]) => {
          const sorted = Object.entries(data.teams).sort((a, b) => b[1] - a[1]);
          return (
            <div key={pathId} className="overflow-hidden rounded border border-gray-200">
              <table className="tr-table">
                <thead>
                  <tr>
                    <th colSpan={2} className="!text-[13px] !normal-case !tracking-normal">
                      {data.description}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(([name, prob]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className={`text-right font-mono ${probColor(prob)}`}>
                        {pct(prob)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
