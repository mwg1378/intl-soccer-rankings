import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — International Soccer Rankings",
  description:
    "How our international soccer ranking system works: 12 ranking models backtested against tournament results, market-optimized composites, and Dixon-Coles match predictions.",
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold">Methodology</h1>
        <p className="text-sm text-gray-400">
          How we rank international soccer teams, predict match outcomes, and simulate the World Cup
        </p>
      </div>

      {/* Table of Contents */}
      <nav className="rounded border border-gray-200 p-4 text-sm">
        <h2 className="font-semibold text-xs uppercase tracking-wide text-gray-500 mb-2">Contents</h2>
        <ol className="space-y-1 text-gray-600">
          <li><a href="#overview" className="hover:text-[#1a2b4a] hover:underline">1. Overview</a></li>
          <li><a href="#individual-models" className="hover:text-[#1a2b4a] hover:underline">2. Individual Rating Models (9)</a></li>
          <li><a href="#composites" className="hover:text-[#1a2b4a] hover:underline">3. Composite Rankings (3)</a></li>
          <li><a href="#backtesting" className="hover:text-[#1a2b4a] hover:underline">4. Backtesting</a></li>
          <li><a href="#prediction" className="hover:text-[#1a2b4a] hover:underline">5. Score Prediction Model</a></li>
          <li><a href="#simulation" className="hover:text-[#1a2b4a] hover:underline">6. World Cup Simulation</a></li>
          <li><a href="#home-advantage" className="hover:text-[#1a2b4a] hover:underline">7. Home Advantage</a></li>
          <li><a href="#data-sources" className="hover:text-[#1a2b4a] hover:underline">8. Data Sources</a></li>
          <li><a href="#limitations" className="hover:text-[#1a2b4a] hover:underline">9. Known Limitations</a></li>
        </ol>
      </nav>

      <section id="overview" className="overflow-hidden rounded border border-gray-200 scroll-mt-4">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Overview</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            We maintain <strong>12 ranking models</strong> spanning Elo variants,
            Bayesian ratings, pairwise solvers, ordinal regression, and
            market-optimized composites. Each model was backtested against 2,083
            matches across 22 major tournaments and World Cup qualifiers (2013&ndash;2024).
          </p>
          <p>
            Our <strong>primary ranking</strong> is the <strong>Grid-Optimized Blend</strong>:
            a 70/30 weighted average of the Combined rating and Bradley-Terry rating.
            This composite was selected by running 5,000-iteration Monte Carlo World Cup
            simulations with each of 9 individual models, comparing the resulting
            championship probabilities against sportsbook consensus odds (FanDuel,
            DraftKings, bet365), and grid-searching optimal blend weights to minimize
            mean squared error vs. the market.
          </p>
          <p>
            In-sample market calibration: <strong>MSE = 0.000274</strong>, Spearman rank correlation{" "}
            <strong>r = 0.907</strong>, 100% overlap with the sportsbooks&apos; top 5 favorites.
            Note: composite weights and prediction sensitivity were calibrated against
            these same odds, so these metrics reflect calibration fit rather than
            independent validation. See{" "}
            <a href="/market-alignment" className="underline">Market Odds</a> for
            the full comparison and{" "}
            <a href="#backtesting" className="underline">Backtesting</a> for
            out-of-sample accuracy.
          </p>
        </div>
      </section>

      <section id="individual-models" className="overflow-hidden rounded border border-gray-200 scroll-mt-4">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Individual Rating Models (9)</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p className="text-xs text-gray-500 italic">
            Backtest metrics shown below are from walk-forward evaluation across 2,083
            tournament matches. Brier score measures prediction quality (lower is better;
            random guessing = 0.667, always picking the favorite &asymp; 0.58).
          </p>

          <h4>Elo (FIFA-aligned)</h4>
          <p>
            Modified Elo processing all international matches from 2014 onward.
            Uses <strong>600-point scaling</strong> (FIFA standard, not 400),
            offensive/defensive sub-ratings with a <strong>50/50 split</strong>,
            and adaptive goal-difference multipliers that scale with a team&apos;s
            win rate lopsidedness.
          </p>
          <pre className="font-mono text-xs bg-gray-50 p-3 rounded">
{`R_new = R_old + K * G * (W - W_e)
W_e = 1 / (1 + 10^((R_opp - R_team) / 600))

K values:  Friendly=10, Nations League=15, Qualifier=25
           Tournament Group=35, Tournament KO=40
           WC Group=50, WC KO=60

PSO: Winner W=0.75, Loser W=0.5 (treated as draw)
Knockout loss protection: negative deltas clamped to 0
Annual mean reversion: 8% pull toward 1500`}
          </pre>
          <p className="text-xs text-gray-500">
            Backtest: Brier = 0.552, Accuracy = 58.0%
          </p>

          <h4>Bradley-Terry (Equilibrium MLE)</h4>
          <p>
            Batch Newton-Raphson solver finding ratings where each team&apos;s weighted
            expected wins equal their weighted actual wins. Uses 2-year half-life
            time decay, empirical scoreline W-values (sigmoid fit on 49,000+ matches),
            and fixed 50-point home bonus. Single rating per team (not off/def split).
          </p>
          <p className="text-xs text-gray-500">
            Backtest: Not independently backtested (batch solver requires full match
            history). Evaluated via market alignment: MSE = 0.000545, r = 0.891.
          </p>

          <h4>Glicko-2</h4>
          <p>
            Bayesian rating with uncertainty tracking (rating deviation) and volatility.
            Teams with fewer matches have wider confidence intervals. Per-match updates
            via the full Glicko-2 algorithm (Illinois method for volatility estimation).
          </p>
          <p className="text-xs text-gray-500">
            Backtest: Brier = 0.541, Accuracy = 59.3% (best individual accuracy)
          </p>

          <h4>Berrar k-NN</h4>
          <p>
            Elo base rating augmented with k-nearest-neighbor adjustments: when predicting
            a match, each team&apos;s recent results against opponents of similar strength
            modify the prediction. Uses 10 nearest neighbors with a distance kernel,
            storing the last 50 matches per team.
          </p>
          <p className="text-xs text-gray-500">
            Backtest: Brier = 0.540, Accuracy = 58.8%
          </p>

          <h4>Pi-Ratings (Constantinou &amp; Fenton, 2013)</h4>
          <p>
            Separate home/away ratings with log-scaled error updates (c = 3) and
            cross-context learning (home results nudge away rating and vice versa,
            mu1 = 0.1, mu2 = 0.3). Ratings are bounded by the log transform,
            preventing indefinite drift. Annual 8% mean reversion toward 0.
          </p>
          <p className="text-xs text-gray-500">
            Backtest: Evaluated as part of IW-Pi composite (see below).
          </p>

          <h4>Importance-Weighted Pi-Ratings</h4>
          <p>
            Pi-ratings with match importance scaling: learning rate is multiplied by
            an importance weight (Friendly = 0.5x, Nations League = 0.75x,
            Qualifier = 1.0x, Tournament Group = 1.25x, Tournament Knockout = 1.5x).
            World Cup knockout matches produce 3x larger updates than friendlies.
          </p>
          <p className="text-xs text-gray-500">
            Backtest: Brier = 0.536, Accuracy = 57.6% (best composite score)
          </p>

          <h4>Margin-Optimized Elo</h4>
          <p>
            Elo variant with heavy goal-difference multiplier: G = 1 + 0.5 &middot; ln(1 + |gd|).
            Unlike standard Elo&apos;s capped multiplier (max 1.25x), this goes higher,
            emphasizing margin of victory for better score prediction.
          </p>
          <p className="text-xs text-gray-500">
            Backtest: Brier = 0.548, Accuracy = 57.2%, Margin MAE = 1.336 (best margin prediction among Elo variants)
          </p>

          <h4>Ordered Probit</h4>
          <p>
            Models goal difference directly as an ordinal outcome with latent team
            strengths and threshold cutpoints (&minus;2.5 to +2.5 for 7 GD categories).
            Gradient descent updates (lr = 0.05). Display rating: 1500 + strength &times; 100.
          </p>
          <p className="text-xs text-gray-500">
            Backtest: Brier = 0.555, Accuracy = 56.8% (best margin prediction overall)
          </p>

          <h4>Combined (Elo + Roster)</h4>
          <p>
            50/50 blend of match-based Elo and EA FC squad quality ratings (Razali/Yeung
            methodology: 35 player attributes &rarr; 7 clusters &rarr; 4 positions &rarr;
            offensive/defensive decomposition). Confederation penalty applied
            (UEFA/CONMEBOL: 0, CONCACAF: 15, CAF/AFC: 30, OFC: 40 Elo points).
            These penalties are empirical estimates designed to correct for Elo inflation
            from intra-confederation play against weaker opponents; see{" "}
            <a href="#limitations" className="underline">Known Limitations</a> for caveats.
          </p>
          <p className="text-xs text-gray-500">
            Market alignment: MSE = 0.000397 (best individual model), r = 0.824
          </p>
        </div>
      </section>

      <section id="composites" className="overflow-hidden rounded border border-gray-200 scroll-mt-4">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Composite Rankings (3)</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            Composites were optimized by comparing Monte Carlo World Cup championship
            probabilities against sportsbook consensus odds.
          </p>
          <table>
            <thead>
              <tr>
                <th>Composite</th>
                <th>Formula</th>
                <th>MSE vs Market</th>
                <th>Corr</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Grid-Optimized</strong></td>
                <td>70% Combined + 30% BT</td>
                <td>0.000274</td>
                <td>0.907</td>
              </tr>
              <tr>
                <td>Top-3 Equal</td>
                <td>33% Combined + 33% BT + 33% OP</td>
                <td>0.000438</td>
                <td>0.877</td>
              </tr>
              <tr>
                <td>Backtested+Market</td>
                <td>50% IW Pi + 50% Combined</td>
                <td>0.000484</td>
                <td>0.808</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            MSE = mean squared error between model championship probabilities and
            sportsbook consensus odds (lower is better). Corr = Spearman rank
            correlation (higher is better). These are in-sample calibration metrics
            since the composite weights were optimized against these same odds.
          </p>
        </div>
      </section>

      <section id="backtesting" className="overflow-hidden rounded border border-gray-200 scroll-mt-4">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Backtesting</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            All models were evaluated via <strong>walk-forward backtesting</strong> across
            22 tournament windows totaling 2,083 test matches:
          </p>
          <ul>
            <li>World Cup 2014, 2018, 2022</li>
            <li>Euro 2016, 2020, 2024</li>
            <li>Copa Am&eacute;rica 2015&ndash;2024 (5 editions)</li>
            <li>AFCON 2015&ndash;2023 (5 editions)</li>
            <li>Asian Cup 2015, 2019, 2023</li>
            <li>World Cup Qualifiers (3 cycles)</li>
          </ul>
          <p>
            For each window, models train on all matches before the tournament,
            then predict each tournament match. Metrics:
          </p>
          <ul>
            <li>
              <strong>Brier score:</strong> Squared error on 3-way outcome probabilities
              (H/D/A). Lower is better &mdash; random guessing scores 0.667, always
              picking the favorite &asymp; 0.58, and our best model scores 0.536
            </li>
            <li><strong>Margin MAE:</strong> Absolute error on predicted goal difference</li>
            <li><strong>Goals MAE:</strong> Absolute error on predicted total goals</li>
          </ul>
          <p>
            Penalty shootout matches are treated as <strong>draws</strong> for evaluation
            (the model predicts regulation-time outcome). World Cup matches are
            weighted <strong>3x</strong> in all metrics.
          </p>
          <p>
            Composite score: 60% Brier + 25% Margin MAE + 15% Goals MAE
            (min-max normalized across models per tournament, then match-weighted
            average across all windows).
          </p>
        </div>
      </section>

      <section id="prediction" className="overflow-hidden rounded border border-gray-200 scroll-mt-4">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Score Prediction Model</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            Match predictions use a <strong>Dixon-Coles + Poisson</strong> log-linear model:
          </p>
          <pre className="font-mono text-xs bg-gray-50 p-3 rounded">
{`z_off = (team_off - avg_off) / std_off
z_def = (team_def - avg_def) / std_def

λ_home = baseline * exp(0.38 * (z_off_home + z_def_away)) * HA
λ_away = baseline * exp(0.38 * (z_off_away + z_def_home))

Baseline goals: Friendly=1.42, Nations League=1.38,
                Qualifier=1.32, Group=1.30, Knockout=1.18
Home advantage: per-team Bayesian estimate (default 1.22x)
Dixon-Coles rho: -0.06 (adjusts 0-0, 1-0, 0-1, 1-1)
Diagonal inflation: 2-10% (context-dependent draw boost)
Sensitivity: 0.38 (calibrated to match WC sportsbook odds)`}
          </pre>
          <p>
            Output: full scoreline probability matrix (up to 10&times;10 goals),
            summed to produce win/draw/loss probabilities and expected goals.
          </p>
        </div>
      </section>

      <section id="simulation" className="overflow-hidden rounded border border-gray-200 scroll-mt-4">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">World Cup Simulation</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            World Cup 2026 odds are produced via{" "}
            <strong>100,000 Monte Carlo simulations</strong> of the full tournament:
          </p>
          <ol>
            <li>
              <strong>Playoffs:</strong> Simulate 4 UEFA and 2 FIFA intercontinental
              playoff finals (semifinals already decided)
            </li>
            <li>
              <strong>Group stage:</strong> Round-robin within 12 groups of 4.
              Host nations (US, Mexico, Canada) receive their per-team home
              advantage when playing in their country
            </li>
            <li>
              <strong>3rd-place qualifying:</strong> Best 8 of 12 third-place teams
              advance, assigned to R32 slots via constraint satisfaction
            </li>
            <li>
              <strong>Knockout rounds:</strong> R32 &rarr; R16 &rarr; QF &rarr; SF &rarr; Final.
              Drawn matches go to extra time (0.27x scoring rate) then penalties
            </li>
            <li>
              <strong>Penalty model:</strong> Base 50% + quality edge (sigmoid of
              Elo gap, &plusmn;150 Elo = &plusmn;8%) + 4% crowd advantage for
              non-neutral venues
            </li>
          </ol>
          <p>
            Ratings used: <strong>Grid-Optimized</strong> (70% Combined + 30% BT).
            Per-team home advantage is the Bayesian estimate from each
            host nation&apos;s match history.
          </p>
        </div>
      </section>

      <section id="home-advantage" className="overflow-hidden rounded border border-gray-200 scroll-mt-4">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Home Advantage</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            Per-team home advantage is a <strong>Bayesian estimate</strong> from
            each team&apos;s home vs. away goal-scoring ratio:
          </p>
          <pre className="font-mono text-xs bg-gray-50 p-3 rounded">
{`Prior: 1.22x (global mean), weight of 30 equivalent matches
Observed: home goals/game ÷ away goals/game
Posterior: (prior_weight * prior + n * observed) / (prior_weight + n)
Clamped to [0.80, 2.00]
Annual decay: 15%`}
          </pre>
          <p>
            Applied as an xG multiplier in the prediction engine. Converted to
            Elo points for the Elo expected result calculation:
            HA_bonus = ln(homeAdvantage) &times; 150.
          </p>
        </div>
      </section>

      <section id="data-sources" className="overflow-hidden rounded border border-gray-200 scroll-mt-4">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Data Sources</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <ul>
            <li>
              <strong>Match results:</strong> Kaggle international football results
              dataset (49,000+ matches, 1872&ndash;present)
            </li>
            <li>
              <strong>Penalty shootouts:</strong> Kaggle shootouts dataset (665 PSO records)
            </li>
            <li>
              <strong>Squad quality:</strong> EA FC 24 player ratings (180,000+ players,
              35 attributes per player) via stefanoleone992/ea-sports-fc-24 dataset
            </li>
            <li>
              <strong>Betting market odds:</strong> Sportsbook consensus (DraftKings,
              FanDuel, BetMGM via NBC Sports, March 2026) and Polymarket prediction
              market ($389M+ traded volume) for WC 2026 championship futures
            </li>
          </ul>
          <h4>References</h4>
          <ul>
            <li>Dixon, M.J. &amp; Coles, S.G. (1997). Modelling Association Football Scores and Inefficiencies in the Football Betting Market</li>
            <li>Constantinou, A.C. &amp; Fenton, N.E. (2013). Determining the number of goals in association football using Pi-ratings</li>
            <li>Glickman, M.E. (2001). Dynamic paired comparison models with stochastic variances</li>
            <li>Berrar, D. et al. (2019). Incorporating domain knowledge in machine learning for soccer outcome prediction</li>
            <li>Razali, N. &amp; Yeung, C.Y. (2023). Framework of interpretable match results prediction in football with FIFA ratings</li>
            <li>Elo, A. (1978). The Rating of Chessplayers, Past and Present</li>
          </ul>
        </div>
      </section>

      <section id="limitations" className="overflow-hidden rounded border border-gray-200 scroll-mt-4">
        <div className="bg-[#1a2b4a] px-4 py-2">
          <h2 className="text-sm font-semibold text-white">Known Limitations</h2>
        </div>
        <div className="prose prose-neutral max-w-none p-4 text-sm">
          <p>
            We aim to be transparent about the limitations of our methodology:
          </p>
          <ul>
            <li>
              <strong>Market alignment is in-sample.</strong> The composite weights
              and prediction sensitivity (0.38) were calibrated against the same
              sportsbook odds used to measure market alignment. MSE and correlation
              metrics reflect calibration fit, not independent predictive accuracy.
              Our <a href="#backtesting" className="underline">backtesting</a> provides
              the out-of-sample evaluation.
            </li>
            <li>
              <strong>Backtesting uses current-period rating statistics.</strong> The
              z-score normalization in the prediction engine uses global mean and
              standard deviation computed from current ratings, even when predicting
              historical tournament matches. This introduces a mild lookahead bias
              that may make backtested Brier scores slightly optimistic. Future work:
              compute per-period statistics using only data available before each
              tournament.
            </li>
            <li>
              <strong>Confederation penalties are empirical, not derived.</strong> The
              flat Elo deductions (CONCACAF: 15, CAF/AFC: 30, OFC: 40 points) correct
              for rating inflation from intra-confederation play, but they are manually
              estimated rather than derived from cross-confederation match analysis.
              They are consequential (30 points can shift a team several ranks) and may
              over- or under-correct for specific teams.
            </li>
            <li>
              <strong>Offensive/defensive split is symmetric.</strong> Elo updates
              apply the same delta to both offensive and defensive sub-ratings (50/50).
              A 5-0 win and a 1-0 win produce different magnitudes but the same
              off/def balance, even though they imply different offensive vs. defensive
              strength. The prediction engine treats these sub-ratings as meaningful
              signals.
            </li>
            <li>
              <strong>Monte Carlo sampling error.</strong> At 100,000 iterations,
              championship probabilities for favorites (~15%) have a 95% CI of
              approximately &plusmn;0.22 percentage points (Wilson interval). For
              long-shot teams (&lt;1%), the relative error is larger. Advancement
              probabilities for earlier rounds are more precise.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
