/**
 * Market odds module tests.
 *
 * Ensures odds normalization, consensus computation, and data integrity.
 */

import { describe, it, expect } from "vitest";
import {
  SPORTSBOOK_ODDS,
  POLYMARKET_ODDS,
  CONSENSUS_ODDS,
  topTeams,
} from "../../lib/market-odds";

describe("market odds", () => {
  describe("normalization", () => {
    it("sportsbook odds should sum to ~1", () => {
      const sum = Object.values(SPORTSBOOK_ODDS).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1.0, 4);
    });

    it("polymarket odds should sum to ~1", () => {
      const sum = Object.values(POLYMARKET_ODDS).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1.0, 4);
    });

    it("consensus odds should sum to ~1", () => {
      const sum = Object.values(CONSENSUS_ODDS).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1.0, 4);
    });
  });

  describe("data integrity", () => {
    it("Spain should be the favorite in all sources", () => {
      const sbMax = Object.entries(SPORTSBOOK_ODDS).sort((a, b) => b[1] - a[1])[0];
      const pmMax = Object.entries(POLYMARKET_ODDS).sort((a, b) => b[1] - a[1])[0];
      expect(sbMax[0]).toBe("Spain");
      expect(pmMax[0]).toBe("Spain");
    });

    it("top 5 favorites should include Spain, England, France, Argentina, Brazil", () => {
      const top5 = topTeams(5).map(t => t.team);
      expect(top5).toContain("Spain");
      expect(top5).toContain("England");
      expect(top5).toContain("France");
      // Argentina and Brazil should both be in the top 5
      expect(top5).toContain("Argentina");
      expect(top5).toContain("Brazil");
    });

    it("all probabilities should be positive", () => {
      for (const [team, prob] of Object.entries(SPORTSBOOK_ODDS)) {
        expect(prob).toBeGreaterThan(0);
      }
      for (const [team, prob] of Object.entries(POLYMARKET_ODDS)) {
        expect(prob).toBeGreaterThan(0);
      }
    });

    it("no team should have > 25% probability", () => {
      for (const [, prob] of Object.entries(CONSENSUS_ODDS)) {
        expect(prob).toBeLessThan(0.25);
      }
    });
  });

  describe("consensus computation", () => {
    it("consensus should be between sportsbook and polymarket for shared teams", () => {
      for (const [team, consensus] of Object.entries(CONSENSUS_ODDS)) {
        const sb = SPORTSBOOK_ODDS[team];
        const pm = POLYMARKET_ODDS[team];
        if (sb !== undefined && pm !== undefined) {
          const low = Math.min(sb, pm);
          const high = Math.max(sb, pm);
          // Consensus is the average (before re-normalization), so it may be
          // slightly outside [low, high] after normalization — allow 0.5pp tolerance
          expect(consensus).toBeGreaterThan(low - 0.005);
          expect(consensus).toBeLessThan(high + 0.005);
        }
      }
    });
  });

  describe("topTeams helper", () => {
    it("should return requested number of teams", () => {
      expect(topTeams(10)).toHaveLength(10);
      expect(topTeams(5)).toHaveLength(5);
    });

    it("should be sorted by consensus probability descending", () => {
      const teams = topTeams(20);
      for (let i = 1; i < teams.length; i++) {
        expect(teams[i].consensus).toBeLessThanOrEqual(teams[i - 1].consensus);
      }
    });

    it("should include source divergence", () => {
      const teams = topTeams(5);
      for (const t of teams) {
        expect(t.sourceDivergence).toBeGreaterThanOrEqual(0);
        expect(t.sourceDivergence).toBe(Math.abs(t.sportsbook - t.polymarket));
      }
    });
  });
});
