"""CSV data loading and team name normalization.

Ported from scripts/seed.ts — parses results.csv and shootouts.csv,
classifies tournament importance, and normalizes team names.
"""

import csv
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).resolve().parents[3] / "scripts" / "data"

KNOWN_CODES: dict[str, str] = {
    "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT", "Belgium": "BEL",
    "Bolivia": "BOL", "Brazil": "BRA", "Cameroon": "CMR", "Canada": "CAN",
    "Chile": "CHI", "China": "CHN", "Colombia": "COL", "Costa Rica": "CRC",
    "Croatia": "CRO", "Czech Republic": "CZE", "Czechia": "CZE", "Denmark": "DEN",
    "Ecuador": "ECU", "Egypt": "EGY", "England": "ENG", "Finland": "FIN",
    "France": "FRA", "Germany": "GER", "Ghana": "GHA", "Greece": "GRE",
    "Honduras": "HON", "Hungary": "HUN", "Iceland": "ISL", "India": "IND",
    "Indonesia": "IDN", "Iran": "IRN", "Iraq": "IRQ", "Ireland": "IRL",
    "Israel": "ISR", "Italy": "ITA", "Ivory Coast": "CIV",
    "Côte d'Ivoire": "CIV", "Jamaica": "JAM", "Japan": "JPN",
    "Korea Republic": "KOR", "South Korea": "KOR",
    "Korea DPR": "PRK", "North Korea": "PRK",
    "Mexico": "MEX", "Morocco": "MAR", "Netherlands": "NED",
    "New Zealand": "NZL", "Nigeria": "NGA", "Norway": "NOR",
    "Panama": "PAN", "Paraguay": "PAR", "Peru": "PER", "Poland": "POL",
    "Portugal": "POR", "Qatar": "QAT", "Romania": "ROU", "Russia": "RUS",
    "Saudi Arabia": "KSA", "Scotland": "SCO", "Senegal": "SEN",
    "Serbia": "SRB", "Slovakia": "SVK", "Slovenia": "SVN",
    "South Africa": "RSA", "Spain": "ESP", "Sweden": "SWE",
    "Switzerland": "SUI", "Thailand": "THA", "Tunisia": "TUN",
    "Turkey": "TUR", "Ukraine": "UKR", "United States": "USA",
    "Uruguay": "URU", "Uzbekistan": "UZB", "Venezuela": "VEN",
    "Vietnam": "VNM", "Wales": "WAL", "Algeria": "ALG", "Angola": "ANG",
    "Bosnia and Herzegovina": "BIH", "Burkina Faso": "BFA",
    "Cape Verde": "CPV", "China PR": "CHN",
    "Congo DR": "COD", "DR Congo": "COD",
    "El Salvador": "SLV", "Ethiopia": "ETH", "Gabon": "GAB",
    "Georgia": "GEO", "Guatemala": "GUA", "Guinea": "GUI",
    "Haiti": "HAI", "Kenya": "KEN", "Kuwait": "KUW",
    "Lebanon": "LBN", "Libya": "LBY", "Luxembourg": "LUX",
    "Mali": "MLI", "Mozambique": "MOZ", "Myanmar": "MYA",
    "Namibia": "NAM", "Niger": "NIG", "Oman": "OMA",
    "Palestine": "PLE", "Philippines": "PHI",
    "Republic of Ireland": "IRL",
    "Rwanda": "RWA", "Sierra Leone": "SLE",
    "Singapore": "SIN", "Sudan": "SDN", "Syria": "SYR",
    "Tanzania": "TAN", "Togo": "TOG", "Trinidad and Tobago": "TRI",
    "Uganda": "UGA", "United Arab Emirates": "UAE",
    "Yemen": "YEM", "Zambia": "ZAM", "Zimbabwe": "ZIM",
    "Montenegro": "MNE", "North Macedonia": "MKD",
    "Kosovo": "KVX", "Curaçao": "CUW", "Suriname": "SUR",
    "Malta": "MLT", "Cyprus": "CYP", "Estonia": "EST",
    "Latvia": "LVA", "Lithuania": "LTU", "Albania": "ALB",
    "Armenia": "ARM", "Azerbaijan": "AZE", "Belarus": "BLR",
    "Faroe Islands": "FRO", "Gibraltar": "GIB",
    "Kazakhstan": "KAZ", "Liechtenstein": "LIE",
    "Moldova": "MDA", "San Marino": "SMR",
    "Andorra": "AND", "Bahrain": "BHR",
    "Bangladesh": "BAN", "Benin": "BEN",
    "Bermuda": "BER", "Bhutan": "BHU",
    "Botswana": "BOT", "Central African Republic": "CTA",
    "Chad": "CHA", "Comoros": "COM", "Congo": "CGO",
    "Cuba": "CUB", "Djibouti": "DJI",
    "Dominican Republic": "DOM", "Eritrea": "ERI",
    "Eswatini": "SWZ", "Fiji": "FIJ",
    "French Guiana": "GUF", "Gambia": "GAM",
    "Grenada": "GRN", "Guam": "GUM",
    "Guinea-Bissau": "GNB", "Guyana": "GUY",
    "Hong Kong": "HKG", "Jordan": "JOR",
    "Kyrgyzstan": "KGZ", "Laos": "LAO",
    "Lesotho": "LES", "Liberia": "LBR",
    "Macau": "MAC", "Madagascar": "MAD",
    "Malawi": "MWI", "Malaysia": "MAS",
    "Maldives": "MDV", "Mauritania": "MTN",
    "Mauritius": "MRI", "Mongolia": "MNG",
    "Nepal": "NEP", "Nicaragua": "NCA",
    "Northern Ireland": "NIR",
    "Papua New Guinea": "PNG",
    "Puerto Rico": "PUR",
    "Samoa": "SAM", "São Tomé and Príncipe": "STP",
    "Solomon Islands": "SOL",
    "Somalia": "SOM", "South Sudan": "SSD",
    "Sri Lanka": "SRI", "St Kitts and Nevis": "SKN",
    "St Lucia": "LCA", "St Vincent and the Grenadines": "VIN",
    "Tajikistan": "TJK", "Timor-Leste": "TLS",
    "Tonga": "TGA", "Turkmenistan": "TKM",
    "Vanuatu": "VAN",
    "Chinese Taipei": "TPE", "Taiwan": "TPE",
    "Cambodia": "CAM",
}

_UEFA = {
    "England", "France", "Germany", "Spain", "Italy", "Netherlands", "Portugal",
    "Belgium", "Croatia", "Denmark", "Sweden", "Switzerland", "Austria",
    "Poland", "Czech Republic", "Czechia", "Romania", "Hungary", "Greece",
    "Scotland", "Wales", "Ireland", "Republic of Ireland", "Northern Ireland",
    "Norway", "Finland", "Iceland", "Turkey", "Ukraine", "Russia", "Serbia",
    "Slovakia", "Slovenia", "Bosnia and Herzegovina", "Montenegro",
    "North Macedonia", "Albania", "Bulgaria", "Georgia", "Armenia",
    "Azerbaijan", "Belarus", "Estonia", "Latvia", "Lithuania", "Moldova",
    "Kazakhstan", "Cyprus", "Malta", "Luxembourg", "Liechtenstein",
    "Faroe Islands", "Gibraltar", "San Marino", "Andorra", "Kosovo",
}
_CONMEBOL = {
    "Brazil", "Argentina", "Uruguay", "Colombia", "Chile", "Peru",
    "Ecuador", "Bolivia", "Paraguay", "Venezuela",
}
_CONCACAF = {
    "Mexico", "United States", "Canada", "Costa Rica", "Panama",
    "Honduras", "Jamaica", "El Salvador", "Trinidad and Tobago",
    "Guatemala", "Haiti", "Cuba", "Curaçao", "Suriname", "Nicaragua",
    "Dominican Republic", "Bermuda", "Grenada", "Guyana",
    "St Kitts and Nevis", "St Lucia", "St Vincent and the Grenadines",
    "Puerto Rico",
}
_AFC = {
    "Japan", "Korea Republic", "South Korea", "Australia", "Iran",
    "Saudi Arabia", "Qatar", "United Arab Emirates", "Iraq", "China PR",
    "China", "Uzbekistan", "Thailand", "Vietnam", "India", "Oman",
    "Bahrain", "Jordan", "Syria", "Lebanon", "Palestine", "Kuwait",
    "Indonesia", "Malaysia", "Philippines", "Singapore", "Myanmar",
    "Korea DPR", "North Korea", "Hong Kong", "Macau", "Chinese Taipei",
    "Taiwan", "Bangladesh", "Nepal", "Sri Lanka", "Maldives", "Bhutan",
    "Mongolia", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Cambodia",
    "Laos", "Timor-Leste", "Yemen",
}
_OFC = {
    "New Zealand", "Fiji", "Papua New Guinea", "Solomon Islands",
    "Vanuatu", "Samoa", "Tonga",
}


def guess_confederation(name: str) -> str:
    if name in _UEFA:
        return "UEFA"
    if name in _CONMEBOL:
        return "CONMEBOL"
    if name in _CONCACAF:
        return "CONCACAF"
    if name in _AFC:
        return "AFC"
    if name in _OFC:
        return "OFC"
    return "CAF"


def tournament_to_importance(tournament: str) -> str:
    t = tournament.lower()
    if "friendly" in t:
        return "FRIENDLY"
    if "nations league" in t:
        return "NATIONS_LEAGUE"
    if any(w in t for w in ("qualification", "qualif", "qualifier")):
        return "QUALIFIER"
    if any(w in t for w in ("world cup", "euro", "copa am", "african cup",
                            "asian cup", "gold cup", "concacaf")):
        return "TOURNAMENT_GROUP"
    if any(w in t for w in ("cup", "championship", "tournament")):
        return "TOURNAMENT_GROUP"
    return "FRIENDLY"


@dataclass
class MatchRecord:
    date: date
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    tournament: str
    neutral: bool
    importance: str
    shootout_winner: Optional[str] = None
    home_penalties: Optional[int] = None
    away_penalties: Optional[int] = None
    city: str = ""
    country: str = ""

    @property
    def goal_diff(self) -> int:
        return self.home_score - self.away_score

    @property
    def is_draw(self) -> bool:
        return self.home_score == self.away_score

    @property
    def home_win(self) -> bool:
        return self.home_score > self.away_score

    @property
    def away_win(self) -> bool:
        return self.away_score > self.home_score

    @property
    def outcome(self) -> str:
        if self.home_score > self.away_score:
            return "H"
        elif self.home_score < self.away_score:
            return "A"
        return "D"


def load_matches(
    start_date: str = "2002-01-01",
    data_dir: Optional[Path] = None,
) -> list[MatchRecord]:
    """Load all matches from results.csv, optionally filtered by start date."""
    data_dir = data_dir or DATA_DIR
    results_path = data_dir / "results.csv"
    shootouts_path = data_dir / "shootouts.csv"

    # Build shootout lookup
    shootout_map: dict[str, str] = {}
    with open(shootouts_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = f"{row['date']}|{row['home_team']}|{row['away_team']}"
            shootout_map[key] = row["winner"]

    matches: list[MatchRecord] = []
    with open(results_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["date"] < start_date:
                continue
            home_score = int(row["home_score"])
            away_score = int(row["away_score"])

            shootout_key = f"{row['date']}|{row['home_team']}|{row['away_team']}"
            shootout_winner = shootout_map.get(shootout_key)

            home_pen = None
            away_pen = None
            if shootout_winner and home_score == away_score:
                if shootout_winner == row["home_team"]:
                    home_pen, away_pen = 5, 4
                else:
                    home_pen, away_pen = 4, 5

            matches.append(MatchRecord(
                date=date.fromisoformat(row["date"]),
                home_team=row["home_team"],
                away_team=row["away_team"],
                home_score=home_score,
                away_score=away_score,
                tournament=row["tournament"],
                neutral=row["neutral"].upper() == "TRUE",
                importance=tournament_to_importance(row["tournament"]),
                shootout_winner=shootout_winner if home_score == away_score else None,
                home_penalties=home_pen,
                away_penalties=away_pen,
                city=row.get("city", ""),
                country=row.get("country", ""),
            ))

    matches.sort(key=lambda m: m.date)
    return matches


def get_all_teams(matches: list[MatchRecord]) -> set[str]:
    """Get all unique team names from matches."""
    teams: set[str] = set()
    for m in matches:
        teams.add(m.home_team)
        teams.add(m.away_team)
    return teams
