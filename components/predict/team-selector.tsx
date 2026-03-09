"use client"

import * as React from "react"
import { ChevronsUpDownIcon, CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export interface Team {
  id: string
  name: string
  slug: string
  fifaCode: string
  confederation: string
}

interface TeamSelectorProps {
  teams: Team[]
  selected: string | null
  onSelect: (teamId: string | null) => void
  label: string
}

export function TeamSelector({
  teams,
  selected,
  onSelect,
  label,
}: TeamSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const selectedTeam = teams.find((t) => t.id === selected)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className="w-full justify-between"
            />
          }
        >
          {selectedTeam ? (
            <span className="flex items-center gap-2">
              <span>{selectedTeam.name}</span>
              <span className="text-xs text-gray-400">
                ({selectedTeam.fifaCode})
              </span>
            </span>
          ) : (
            <span className="text-gray-400">Select {label.toLowerCase()}...</span>
          )}
          <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No team found.</CommandEmpty>
              <CommandGroup>
                {teams.map((team) => (
                  <CommandItem
                    key={team.id}
                    value={`${team.name} ${team.fifaCode}`}
                    data-checked={selected === team.id}
                    onSelect={() => {
                      onSelect(selected === team.id ? null : team.id)
                      setOpen(false)
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span>{team.name}</span>
                      <span className="text-xs text-gray-400">
                        {team.fifaCode}
                      </span>
                    </span>
                    <CheckIcon
                      className={cn(
                        "ml-auto size-4",
                        selected === team.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
