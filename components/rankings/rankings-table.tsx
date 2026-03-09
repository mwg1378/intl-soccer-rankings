"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ISO 3166-1 alpha-2 to regional indicator flag emoji
function fifaCodeToFlag(fifaCode: string): string {
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

const confederationColors: Record<string, string> = {
  UEFA: "text-blue-600",
  CONMEBOL: "text-green-600",
  CONCACAF: "text-yellow-600",
  CAF: "text-orange-600",
  AFC: "text-red-600",
  OFC: "text-teal-600",
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

export function RankingsTable({ teams }: RankingsTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="tr-table">
        <thead>
          <tr>
            <th className="w-[50px]">Rank</th>
            <th>Team</th>
            <th className="w-[70px]">Conf</th>
            <th className="text-right w-[80px]">Overall</th>
            <th className="text-right w-[80px] hidden md:table-cell">Off</th>
            <th className="text-right w-[80px] hidden md:table-cell">Def</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr
              key={team.id}
              className="cursor-pointer"
              onClick={() => router.push(`/team/${team.slug}`)}
            >
              <td>
                <span className="font-semibold tabular-nums">
                  {team.currentRank}
                </span>
              </td>
              <td>
                <span className="mr-1.5" aria-hidden="true">
                  {fifaCodeToFlag(team.fifaCode)}
                </span>
                <span className="font-medium">{team.name}</span>
              </td>
              <td>
                <span className={cn("text-[11px] font-semibold", confederationColors[team.confederation])}>
                  {team.confederation}
                </span>
              </td>
              <td className="text-right">
                <span className="font-mono font-semibold tabular-nums">
                  {team.currentOverallRating.toFixed(1)}
                </span>
              </td>
              <td className="text-right hidden md:table-cell">
                <span className="font-mono tabular-nums text-gray-500">
                  {team.currentOffensiveRating.toFixed(1)}
                </span>
              </td>
              <td className="text-right hidden md:table-cell">
                <span className="font-mono tabular-nums text-gray-500">
                  {team.currentDefensiveRating.toFixed(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
