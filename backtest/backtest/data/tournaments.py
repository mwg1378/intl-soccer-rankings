"""Tournament test set definitions for walk-forward backtesting.

~22 test windows across major tournaments and World Cup qualifiers (2013-2024).
"""

from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass
class TournamentWindow:
    name: str
    start: date
    end: date
    tournament_pattern: str  # substring match against tournament field
    exclude_pattern: Optional[str] = None  # exclude matches containing this
    min_matches: int = 5  # skip window if fewer matches found

    def matches_tournament(self, tournament: str) -> bool:
        t = tournament.lower()
        if self.tournament_pattern.lower() not in t:
            return False
        if self.exclude_pattern and self.exclude_pattern.lower() in t:
            return False
        return True


# --- Major Tournament Test Sets ---

MAJOR_TOURNAMENTS: list[TournamentWindow] = [
    # World Cups (exclude qualifiers that contain "FIFA World Cup" in name)
    TournamentWindow("WC 2014", date(2014, 6, 12), date(2014, 7, 14), "FIFA World Cup", exclude_pattern="qualification"),
    TournamentWindow("WC 2018", date(2018, 6, 14), date(2018, 7, 16), "FIFA World Cup", exclude_pattern="qualification"),
    TournamentWindow("WC 2022", date(2022, 11, 20), date(2022, 12, 19), "FIFA World Cup", exclude_pattern="qualification"),

    # European Championships
    TournamentWindow("Euro 2016", date(2016, 6, 10), date(2016, 7, 11), "UEFA Euro", exclude_pattern="qualification"),
    TournamentWindow("Euro 2020", date(2021, 6, 11), date(2021, 7, 12), "UEFA Euro", exclude_pattern="qualification"),
    TournamentWindow("Euro 2024", date(2024, 6, 14), date(2024, 7, 15), "UEFA Euro", exclude_pattern="qualification"),

    # Copa America
    TournamentWindow("Copa 2015", date(2015, 6, 11), date(2015, 7, 5), "Copa América", exclude_pattern="qualification"),
    TournamentWindow("Copa 2016", date(2016, 6, 3), date(2016, 6, 27), "Copa América", exclude_pattern="qualification"),
    TournamentWindow("Copa 2019", date(2019, 6, 14), date(2019, 7, 8), "Copa América", exclude_pattern="qualification"),
    TournamentWindow("Copa 2021", date(2021, 6, 13), date(2021, 7, 11), "Copa América", exclude_pattern="qualification"),
    TournamentWindow("Copa 2024", date(2024, 6, 20), date(2024, 7, 15), "Copa América", exclude_pattern="qualification"),

    # Africa Cup of Nations
    TournamentWindow("AFCON 2015", date(2015, 1, 17), date(2015, 2, 9), "African Cup of Nations", exclude_pattern="qualification"),
    TournamentWindow("AFCON 2017", date(2017, 1, 14), date(2017, 2, 6), "African Cup of Nations", exclude_pattern="qualification"),
    TournamentWindow("AFCON 2019", date(2019, 6, 21), date(2019, 7, 20), "African Cup of Nations", exclude_pattern="qualification"),
    TournamentWindow("AFCON 2021", date(2022, 1, 9), date(2022, 2, 7), "African Cup of Nations", exclude_pattern="qualification"),
    TournamentWindow("AFCON 2023", date(2024, 1, 13), date(2024, 2, 12), "African Cup of Nations", exclude_pattern="qualification"),

    # Asian Cup
    TournamentWindow("Asian Cup 2015", date(2015, 1, 9), date(2015, 1, 31), "AFC Asian Cup", exclude_pattern="qualification"),
    TournamentWindow("Asian Cup 2019", date(2019, 1, 5), date(2019, 2, 2), "AFC Asian Cup", exclude_pattern="qualification"),
    TournamentWindow("Asian Cup 2023", date(2024, 1, 12), date(2024, 2, 11), "AFC Asian Cup", exclude_pattern="qualification"),
]

# --- World Cup Qualifier Windows ---

WC_QUALIFIER_WINDOWS: list[TournamentWindow] = [
    TournamentWindow(
        "WCQ 2014", date(2013, 6, 1), date(2013, 11, 30),
        "FIFA World Cup qualification", min_matches=20,
    ),
    TournamentWindow(
        "WCQ 2018", date(2017, 6, 1), date(2017, 11, 30),
        "FIFA World Cup qualification", min_matches=20,
    ),
    TournamentWindow(
        "WCQ 2022", date(2021, 6, 1), date(2022, 3, 31),
        "FIFA World Cup qualification", min_matches=20,
    ),
]

ALL_TOURNAMENT_WINDOWS = MAJOR_TOURNAMENTS + WC_QUALIFIER_WINDOWS


def get_tournament_windows(
    names: Optional[list[str]] = None,
) -> list[TournamentWindow]:
    """Get tournament windows, optionally filtered by name substring."""
    if names is None:
        return ALL_TOURNAMENT_WINDOWS
    result = []
    for tw in ALL_TOURNAMENT_WINDOWS:
        if any(n.lower() in tw.name.lower() for n in names):
            result.append(tw)
    return result
