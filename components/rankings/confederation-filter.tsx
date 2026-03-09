"use client";

const confederations = [
  { value: "ALL", label: "All" },
  { value: "UEFA", label: "UEFA" },
  { value: "CONMEBOL", label: "CONMEBOL" },
  { value: "CONCACAF", label: "CONCACAF" },
  { value: "CAF", label: "CAF" },
  { value: "AFC", label: "AFC" },
  { value: "OFC", label: "OFC" },
] as const;

export type Confederation = (typeof confederations)[number]["value"];

interface ConfederationFilterProps {
  selected: Confederation;
  onSelect: (confederation: Confederation) => void;
}

export function ConfederationFilter({
  selected,
  onSelect,
}: ConfederationFilterProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {confederations.map((conf) => (
        <button
          key={conf.value}
          onClick={() => onSelect(conf.value)}
          className={`px-2.5 py-1 text-xs font-semibold rounded ${
            selected === conf.value
              ? "bg-[#1a2b4a] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {conf.label}
        </button>
      ))}
    </div>
  );
}
