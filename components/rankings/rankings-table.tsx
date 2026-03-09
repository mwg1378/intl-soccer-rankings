"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";

// ISO 3166-1 alpha-2 to regional indicator flag emoji
function fifaCodeToFlag(fifaCode: string): string {
  // Map common FIFA codes that differ from ISO 3166-1 alpha-2
  const fifaToIso: Record<string, string> = {
    // Europe
    ENG: "GB", SCO: "GB", WAL: "GB", NIR: "GB",
    GER: "DE", NED: "NL", CRO: "HR", SUI: "CH",
    POR: "PT", GRE: "GR", DEN: "DK", CZE: "CZ",
    SLO: "SI", SVK: "SK", BUL: "BG", ROU: "RO",
    BIH: "BA", MKD: "MK", KOS: "XK", KVX: "XK",
    MNE: "ME", FRO: "FO", GIB: "GI", LIE: "LI",
    SMR: "SM", AND: "AD", MDA: "MD", BLR: "BY",
    LVA: "LV", LTU: "LT", EST: "EE",
    // Africa
    RSA: "ZA", CIV: "CI", ALG: "DZ", NGA: "NG",
    CMR: "CM", CGO: "CG", COD: "CD", GUI: "GN",
    GAM: "GM", MTN: "MR", BFA: "BF", EQG: "GQ",
    CPV: "CV", CTA: "CF", SEN: "SN", GHA: "GH",
    MAD: "MG", TOG: "TG", BEN: "BJ", NIG: "NE",
    ANG: "AO", MOZ: "MZ", ZAM: "ZM", ZIM: "ZW",
    NAM: "NA", BOT: "BW", LES: "LS", SWZ: "SZ",
    MWI: "MW", TAN: "TZ", UGA: "UG", KEN: "KE",
    RWA: "RW", ETH: "ET", SLE: "SL", LBR: "LR",
    GNB: "GW", COM: "KM", DJI: "DJ", SOM: "SO",
    SDN: "SD", SSD: "SS", LBY: "LY", STP: "ST",
    MRI: "MU", REU: "RE", CHA: "TD",
    // Asia
    KSA: "SA", IRN: "IR", KOR: "KR", PRK: "KP",
    CHN: "CN", TPE: "TW", PHI: "PH", IND: "IN",
    IDN: "ID", THA: "TH", VIE: "VN", MAS: "MY",
    SIN: "SG", UAE: "AE", IRQ: "IQ", SYR: "SY",
    PAL: "PS", JOR: "JO", KUW: "KW", BHR: "BH",
    OMA: "OM", LBN: "LB", UZB: "UZ", KGZ: "KG",
    TJK: "TJ", TKM: "TM", MNG: "MN", BAN: "BD",
    NEP: "NP", SRI: "LK", MDV: "MV", BHU: "BT",
    MYA: "MM", CAM: "KH", LAO: "LA", TLS: "TL",
    HKG: "HK", MAC: "MO", KAZ: "KZ", YEM: "YE",
    // South America
    URU: "UY", PAR: "PY", CHI: "CL", BOL: "BO",
    ECU: "EC", VEN: "VE",
    // CONCACAF
    CRC: "CR", HON: "HN", GUA: "GT", SLV: "SV",
    HAI: "HT", TRI: "TT", JAM: "JM", BER: "BM",
    ANT: "AG", SKN: "KN", DOM: "DO", NCA: "NI",
    USA: "US", MEX: "MX", CAN: "CA", PAN: "PA",
    CUW: "CW", SUR: "SR", GUY: "GY", PUR: "PR",
    CUB: "CU", GRN: "GD", LCA: "LC", VIN: "VC",
    GUF: "GF",
    // Oceania
    NZL: "NZ", AUS: "AU", PNG: "PG", FIJ: "FJ",
    NCL: "NC", TAH: "PF", SAM: "WS", TGA: "TO",
    SOL: "SB", VAN: "VU",
  };

  const code = fifaToIso[fifaCode] || fifaCode;
  const iso = code.slice(0, 2).toUpperCase();

  try {
    return String.fromCodePoint(
      ...Array.from(iso).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
  } catch {
    return "";
  }
}

const confederationConfig: Record<
  string,
  { label: string; className: string }
> = {
  UEFA: {
    label: "UEFA",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  CONMEBOL: {
    label: "CONMEBOL",
    className: "bg-green-500/15 text-green-700 dark:text-green-400",
  },
  CONCACAF: {
    label: "CONCACAF",
    className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  },
  CAF: {
    label: "CAF",
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  },
  AFC: {
    label: "AFC",
    className: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
  OFC: {
    label: "OFC",
    className: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  },
};

export interface RankingsTeam {
  id: string;
  name: string;
  slug: string;
  fifaCode: string;
  confederation: string;
  flagUrl: string | null;
  currentOverallRating: number;
  currentOffensiveRating: number;
  currentDefensiveRating: number;
  currentRank: number;
  updatedAt: Date | string;
}

interface RankingsTableProps {
  teams: RankingsTeam[];
}

function RankChangeIndicator() {
  // Placeholder: will be replaced with actual rank change data
  return (
    <span className="inline-flex w-4 items-center justify-center text-muted-foreground">
      <Minus className="h-3 w-3" />
    </span>
  );
}

export function RankingsTable({ teams }: RankingsTableProps) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[70px]">Rank</TableHead>
          <TableHead>Team</TableHead>
          <TableHead className="w-[100px] text-right">Overall</TableHead>
          <TableHead className="hidden w-[100px] text-right md:table-cell">
            Offensive
          </TableHead>
          <TableHead className="hidden w-[100px] text-right md:table-cell">
            Defensive
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => {
          const confConfig = confederationConfig[team.confederation];
          return (
            <TableRow
              key={team.id}
              className="cursor-pointer"
              onClick={() => router.push(`/team/${team.slug}`)}
            >
              <TableCell>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {team.currentRank}
                  </span>
                  <RankChangeIndicator />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg leading-none" aria-hidden="true">
                    {fifaCodeToFlag(team.fifaCode)}
                  </span>
                  <span className="font-medium">{team.name}</span>
                  {confConfig && (
                    <Badge
                      className={cn(
                        "text-[10px] font-semibold",
                        confConfig.className
                      )}
                    >
                      {confConfig.label}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-mono text-sm tabular-nums">
                  {team.currentOverallRating.toFixed(1)}
                </span>
              </TableCell>
              <TableCell className="hidden text-right md:table-cell">
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {team.currentOffensiveRating.toFixed(1)}
                </span>
              </TableCell>
              <TableCell className="hidden text-right md:table-cell">
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {team.currentDefensiveRating.toFixed(1)}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
