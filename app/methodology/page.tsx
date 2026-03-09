import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — International Soccer Rankings",
  description:
    "How our international soccer ranking system works: Elo ratings, roster-based strength, and Dixon-Coles score predictions.",
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold">Methodology</h1>
        <p className="text-sm text-gray-400">
          How we rank international soccer teams and predict match outcomes
        </p>
      </div>

      <section className="overflow-hidden rounded border border-gray-200">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Overview</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            Our ranking system is a hybrid of two independently strong
            approaches, optimized for predicting major tournament outcomes:
          </p>
          <ol>
            <li>
              <strong>Match-Based Elo Ratings (70% weight)</strong> — A modified
              Elo system processing all international &quot;A&quot; matches back to 1998,
              with offensive/defensive sub-ratings, goal difference multipliers,
              home advantage, and match importance weighting.
            </li>
            <li>
              <strong>Roster-Based Strength Estimate (30% weight)</strong> — An
              aggregation of individual player quality derived from club
              performance data across 30+ leagues, weighted by position.
            </li>
          </ol>
          <p>
            This mirrors the general architecture used by FiveThirtyEight&apos;s SPI
            system but with a more granular player model and a separate
            offensive/defensive decomposition at every level.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-gray-200">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Component 1: Match-Based Elo</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            Each team maintains two Elo sub-ratings &mdash;{" "}
            <strong>Offensive Elo</strong> and <strong>Defensive Elo</strong>{" "}
            &mdash; rather than a single number.
          </p>
          <h4>Core Formula</h4>
          <pre className="font-mono text-sm bg-gray-50 p-3 rounded">
            R_new = R_old + K * G * (W - W_e)
          </pre>
          <ul>
            <li>
              <strong>K (importance weight):</strong> Ranges from 15 (friendlies)
              to 55 (World Cup knockouts)
            </li>
            <li>
              <strong>G (goal difference multiplier):</strong> 1.0 for 1-goal wins,
              up to 3.0 for large margins
            </li>
            <li>
              <strong>W:</strong> 1 (win), 0.5 (draw), 0 (loss). Penalty shootouts:
              0.75/0.25
            </li>
            <li>
              <strong>W_e (expected result):</strong> 1 / (1 + 10^((R_opp -
              R_team) / 400))
            </li>
          </ul>
          <h4>Home Advantage</h4>
          <p>
            +100 Elo points for competitive home matches, +75 for friendlies.
            Neutral venues receive no bonus.
          </p>
          <h4>Offensive/Defensive Split</h4>
          <p>
            After each match, the adjustment is applied to both sub-ratings with
            a 60/40 split based on the scoring pattern. A 2-0 win adjusts
            Offensive Elo by 60% and Defensive Elo by 40%.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-gray-200">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Component 2: Roster-Based Strength</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            Each national team&apos;s squad is rated by aggregating individual player
            scores derived from club performance. Player ratings are
            position-dependent, using metrics like:
          </p>
          <ul>
            <li>
              <strong>Forwards:</strong> npxG/90, xA/90, shot-creating actions,
              progressive carries
            </li>
            <li>
              <strong>Midfielders:</strong> Progressive passes, xA/90, tackles +
              interceptions
            </li>
            <li>
              <strong>Defenders:</strong> Tackles + interceptions, aerial duels,
              progressive passes, clean sheets
            </li>
            <li>
              <strong>Goalkeepers:</strong> PSxG-GA/90, save %, distribution
            </li>
          </ul>
          <p>
            All per-90 stats are multiplied by a league quality coefficient
            (e.g., Premier League: 1.00, La Liga: 0.98, MLS: 0.72) derived from
            continental competition results.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-gray-200">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Score Prediction Model</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            Match predictions use a <strong>Dixon-Coles + Poisson</strong> model:
          </p>
          <ol>
            <li>
              Calculate expected goals for each team based on offensive/defensive
              ratings
            </li>
            <li>
              Generate a Poisson probability matrix for each possible scoreline
            </li>
            <li>
              Apply Dixon-Coles correction to adjust low-scoring outcomes (0-0,
              1-0, 0-1, 1-1)
            </li>
            <li>
              Apply diagonal inflation (~9%) to correct for underestimated draw
              probabilities
            </li>
          </ol>
          <p>
            The output is a full matrix of P(home_score, away_score) for all
            plausible scorelines, summed to produce win/draw/loss probabilities.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-gray-200">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Final Rating</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <pre className="font-mono text-sm bg-gray-50 p-3 rounded">
{`Team_Offensive = 0.70 * Elo_Offensive + 0.30 * Roster_Offensive
Team_Defensive = 0.70 * Elo_Defensive + 0.30 * Roster_Defensive
Team_Overall = (Team_Offensive + (3000 - Team_Defensive)) / 2`}
          </pre>
          <p>
            The defensive rating is inverted (lower = better defense), then
            combined with the offensive rating to produce the overall score that
            determines ranking order.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-gray-200">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Data Sources</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <ul>
            <li>
              <strong>Match results:</strong> Kaggle international football
              results dataset (1872&ndash;present) + API-Football for recent matches
            </li>
            <li>
              <strong>Player statistics:</strong> FBref (via web scraping) for
              Big 5 leagues + 15 additional leagues
            </li>
            <li>
              <strong>Rosters & market values:</strong> Transfermarkt datasets
            </li>
          </ul>
          <h4>References</h4>
          <ul>
            <li>Dixon, M.J. & Coles, S.G. (1997). Modelling Association Football Scores and Inefficiencies in the Football Betting Market</li>
            <li>Elo, A. (1978). The Rating of Chessplayers, Past and Present</li>
            <li>FiveThirtyEight SPI Methodology</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
