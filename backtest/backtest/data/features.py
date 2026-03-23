"""Feature engineering for ML and composite feature models.

Builds a feature vector for each (home, away) matchup from:
- Rolling form (last N matches)
- Home/away performance
- Goals per game
- Head-to-head record
- Elo-based strength estimate
"""

import math
from collections import defaultdict
from datetime import date, timedelta

from backtest.data.loader import MatchRecord


def build_team_features(
    team: str,
    matches: list[MatchRecord],
    cutoff_date: date,
    window_days: int = 730,
) -> dict[str, float]:
    """Build feature vector for a team based on match history before cutoff."""
    recent = [
        m for m in matches
        if m.date < cutoff_date
        and (m.date >= cutoff_date - timedelta(days=window_days))
        and (m.home_team == team or m.away_team == team)
    ]

    if not recent:
        return {
            "form_w": 0.33, "form_d": 0.33, "form_l": 0.33,
            "goals_scored_pg": 1.3, "goals_conceded_pg": 1.3,
            "home_win_rate": 0.5, "away_win_rate": 0.3,
            "matches_played": 0, "avg_goal_diff": 0.0,
            "recent_form_5": 0.5, "recent_form_10": 0.5,
        }

    wins = draws = losses = 0
    goals_scored = goals_conceded = 0
    home_wins = home_matches = 0
    away_wins = away_matches = 0
    goal_diffs = []

    for m in recent:
        if m.home_team == team:
            gs, gc = m.home_score, m.away_score
            if gs > gc:
                wins += 1
                home_wins += 1
            elif gs == gc:
                draws += 1
            else:
                losses += 1
            home_matches += 1
        else:
            gs, gc = m.away_score, m.home_score
            if gs > gc:
                wins += 1
                away_wins += 1
            elif gs == gc:
                draws += 1
            else:
                losses += 1
            away_matches += 1
        goals_scored += gs
        goals_conceded += gc
        goal_diffs.append(gs - gc)

    n = len(recent)
    last_5 = recent[-5:]
    last_10 = recent[-10:]

    def _form(matches_subset):
        if not matches_subset:
            return 0.5
        pts = 0
        for m in matches_subset:
            if m.home_team == team:
                if m.home_score > m.away_score:
                    pts += 1.0
                elif m.home_score == m.away_score:
                    pts += 0.5
            else:
                if m.away_score > m.home_score:
                    pts += 1.0
                elif m.home_score == m.away_score:
                    pts += 0.5
        return pts / len(matches_subset)

    return {
        "form_w": wins / n,
        "form_d": draws / n,
        "form_l": losses / n,
        "goals_scored_pg": goals_scored / n,
        "goals_conceded_pg": goals_conceded / n,
        "home_win_rate": home_wins / home_matches if home_matches > 0 else 0.5,
        "away_win_rate": away_wins / away_matches if away_matches > 0 else 0.3,
        "matches_played": n,
        "avg_goal_diff": sum(goal_diffs) / n,
        "recent_form_5": _form(last_5),
        "recent_form_10": _form(last_10),
    }


def build_matchup_features(
    home: str, away: str,
    matches: list[MatchRecord],
    cutoff_date: date,
) -> list[float]:
    """Build a feature vector for a home vs away matchup.

    Returns ~22 features combining both teams' stats and head-to-head.
    """
    hf = build_team_features(home, matches, cutoff_date)
    af = build_team_features(away, matches, cutoff_date)

    # Head-to-head in last 4 years
    h2h = [
        m for m in matches
        if m.date < cutoff_date
        and m.date >= cutoff_date - timedelta(days=1460)
        and ((m.home_team == home and m.away_team == away)
             or (m.home_team == away and m.away_team == home))
    ]

    h2h_home_wins = 0
    h2h_draws = 0
    h2h_n = len(h2h)
    for m in h2h:
        if m.home_team == home:
            if m.home_score > m.away_score:
                h2h_home_wins += 1
            elif m.home_score == m.away_score:
                h2h_draws += 1
        else:
            if m.away_score > m.home_score:
                h2h_home_wins += 1
            elif m.home_score == m.away_score:
                h2h_draws += 1

    h2h_rate = h2h_home_wins / h2h_n if h2h_n > 0 else 0.5

    features = [
        # Home team features
        hf["form_w"], hf["form_d"], hf["goals_scored_pg"],
        hf["goals_conceded_pg"], hf["home_win_rate"],
        hf["avg_goal_diff"], hf["recent_form_5"], hf["recent_form_10"],
        min(hf["matches_played"], 50) / 50.0,
        # Away team features
        af["form_w"], af["form_d"], af["goals_scored_pg"],
        af["goals_conceded_pg"], af["away_win_rate"],
        af["avg_goal_diff"], af["recent_form_5"], af["recent_form_10"],
        min(af["matches_played"], 50) / 50.0,
        # Differential features
        hf["goals_scored_pg"] - af["goals_scored_pg"],
        hf["goals_conceded_pg"] - af["goals_conceded_pg"],
        hf["recent_form_5"] - af["recent_form_5"],
        # Head-to-head
        h2h_rate,
    ]

    return features


FEATURE_NAMES = [
    "home_form_w", "home_form_d", "home_goals_pg",
    "home_conceded_pg", "home_win_rate",
    "home_avg_gd", "home_form5", "home_form10",
    "home_experience",
    "away_form_w", "away_form_d", "away_goals_pg",
    "away_conceded_pg", "away_win_rate",
    "away_avg_gd", "away_form5", "away_form10",
    "away_experience",
    "diff_goals_pg", "diff_conceded_pg", "diff_form5",
    "h2h_rate",
]
