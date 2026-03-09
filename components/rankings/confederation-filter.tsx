"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-wrap gap-1.5">
      {confederations.map((conf) => (
        <Button
          key={conf.value}
          variant="outline"
          size="sm"
          className={cn(
            selected === conf.value &&
              "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
          )}
          onClick={() => onSelect(conf.value)}
        >
          {conf.label}
        </Button>
      ))}
    </div>
  );
}
