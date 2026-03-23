/**
 * Berrar k-NN engine tests.
 */

import { describe, it, expect } from "vitest";
import {
  initBerrar,
  processBerrarMatch,
  knnAdjustment,
  effectiveRating,
  applyBerrarReversion,
} from "../../lib/berrar-engine";

describe("berrar-engine", () => {
  describe("initBerrar", () => {
    it("initializes at 1500 rating", () => {
      const state = initBerrar();
      expect(state.rating).toBe(1500);
    });

    it("initializes with empty history", () => {
      const state = initBerrar();
      expect(state.history).toHaveLength(0);
    });
  });

  describe("processBerrarMatch", () => {
    it("winner gains rating, loser drops", () => {
      const home = initBerrar();
      const away = initBerrar();
      const result = processBerrarMatch(home, away, 2, 0);

      expect(result.home.rating).toBeGreaterThan(1500);
      expect(result.away.rating).toBeLessThan(1500);
    });

    it("records match in history", () => {
      const home = initBerrar();
      const away = initBerrar();
      const result = processBerrarMatch(home, away, 1, 0);

      expect(result.home.history).toHaveLength(1);
      expect(result.away.history).toHaveLength(1);
    });

    it("draw keeps ratings roughly equal", () => {
      const home = initBerrar();
      const away = initBerrar();
      const result = processBerrarMatch(home, away, 1, 1);

      expect(Math.abs(result.home.rating - result.away.rating)).toBeLessThan(1);
    });

    it("PSO winner gets W=0.75", () => {
      const home = initBerrar();
      const away = initBerrar();
      const result = processBerrarMatch(home, away, 1, 1, 5, 4);

      expect(result.home.rating).toBeGreaterThan(result.away.rating);
    });

    it("limits history to 50 entries", () => {
      let team = initBerrar();
      for (let i = 0; i < 60; i++) {
        const opp = initBerrar();
        const result = processBerrarMatch(team, opp, 1, 0);
        team = result.home;
      }
      expect(team.history.length).toBeLessThanOrEqual(50);
    });
  });

  describe("knnAdjustment", () => {
    it("returns 0 with insufficient history", () => {
      const state = initBerrar();
      expect(knnAdjustment(state, 1500)).toBe(0);
    });

    it("returns positive adjustment for team that beats similar opponents", () => {
      const state = {
        rating: 1500,
        history: Array.from({ length: 10 }, () => ({
          oppRating: 1500,
          w: 0.8, // mostly winning
          weight: 1.0,
        })),
      };
      expect(knnAdjustment(state, 1500)).toBeGreaterThan(0);
    });

    it("returns negative adjustment for team that loses to similar opponents", () => {
      const state = {
        rating: 1500,
        history: Array.from({ length: 10 }, () => ({
          oppRating: 1500,
          w: 0.2, // mostly losing
          weight: 1.0,
        })),
      };
      expect(knnAdjustment(state, 1500)).toBeLessThan(0);
    });
  });

  describe("effectiveRating", () => {
    it("equals base rating with no history", () => {
      const state = initBerrar();
      expect(effectiveRating(state, 1500)).toBe(1500);
    });
  });

  describe("applyBerrarReversion", () => {
    it("pulls rating toward 1500", () => {
      const state = { rating: 1600, history: [] };
      const reverted = applyBerrarReversion(state);
      expect(reverted.rating).toBeLessThan(1600);
      expect(reverted.rating).toBeGreaterThan(1500);
    });

    it("decays history weights", () => {
      const state = {
        rating: 1500,
        history: [{ oppRating: 1500, w: 1.0, weight: 1.0 }],
      };
      const reverted = applyBerrarReversion(state);
      expect(reverted.history[0].weight).toBeLessThan(1.0);
    });
  });
});
