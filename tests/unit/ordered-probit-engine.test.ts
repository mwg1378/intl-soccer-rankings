/**
 * Ordered Probit engine tests.
 */

import { describe, it, expect } from "vitest";
import {
  initOp,
  opToDisplay,
  processOpMatch,
  opProbabilities,
  applyOpReversion,
} from "../../lib/ordered-probit-engine";

describe("ordered-probit-engine", () => {
  describe("initOp", () => {
    it("initializes at 1500 display rating", () => {
      const state = initOp();
      expect(opToDisplay(state)).toBe(1500);
    });

    it("initializes with 0 strength", () => {
      const state = initOp();
      expect(state.strength).toBe(0);
    });
  });

  describe("opProbabilities", () => {
    it("equal strength gives reasonable probabilities", () => {
      const probs = opProbabilities(0);
      // All three outcomes should have meaningful probability
      expect(probs.homeWin).toBeGreaterThan(0.1);
      expect(probs.awayWin).toBeGreaterThan(0.1);
      expect(probs.draw).toBeGreaterThan(0.1);
    });

    it("positive mu favors home team", () => {
      const probs = opProbabilities(1.5);
      expect(probs.homeWin).toBeGreaterThan(probs.awayWin);
    });

    it("negative mu favors away team", () => {
      const probs = opProbabilities(-1.5);
      expect(probs.awayWin).toBeGreaterThan(probs.homeWin);
    });

    it("probabilities sum to 1", () => {
      const probs = opProbabilities(0.8);
      const total = probs.homeWin + probs.draw + probs.awayWin;
      expect(total).toBeCloseTo(1.0, 5);
    });

    it("large positive mu gives very high home win probability", () => {
      const probs = opProbabilities(5.0);
      expect(probs.homeWin).toBeGreaterThan(0.9);
    });
  });

  describe("processOpMatch", () => {
    it("home win increases home strength", () => {
      const home = initOp();
      const away = initOp();
      const result = processOpMatch(home, away, 3, 0, false);

      expect(result.home.strength).toBeGreaterThan(0);
      expect(result.away.strength).toBeLessThan(0);
    });

    it("away win decreases home strength", () => {
      const home = initOp();
      const away = initOp();
      const result = processOpMatch(home, away, 0, 2, false);

      expect(result.home.strength).toBeLessThan(0);
      expect(result.away.strength).toBeGreaterThan(0);
    });

    it("draw keeps strengths near zero", () => {
      const home = initOp();
      const away = initOp();
      const result = processOpMatch(home, away, 1, 1, false);

      // With home advantage (0.3), a draw means away team performed slightly better
      expect(Math.abs(result.home.strength)).toBeLessThan(0.1);
    });

    it("larger margins produce larger updates", () => {
      const home1 = initOp();
      const away1 = initOp();
      const narrow = processOpMatch(home1, away1, 1, 0, true);

      const home2 = initOp();
      const away2 = initOp();
      const wide = processOpMatch(home2, away2, 3, 0, true);

      expect(wide.home.strength).toBeGreaterThan(narrow.home.strength);
    });
  });

  describe("applyOpReversion", () => {
    it("pulls strength toward 0", () => {
      const state = { strength: 2.0 };
      const reverted = applyOpReversion(state);
      expect(reverted.strength).toBeLessThan(2.0);
      expect(reverted.strength).toBeGreaterThan(0);
    });

    it("does not change strength at 0", () => {
      const state = { strength: 0 };
      const reverted = applyOpReversion(state);
      expect(reverted.strength).toBe(0);
    });
  });

  describe("opToDisplay", () => {
    it("maps strength 0 to 1500", () => {
      expect(opToDisplay({ strength: 0 })).toBe(1500);
    });

    it("maps positive strength above 1500", () => {
      expect(opToDisplay({ strength: 1.0 })).toBe(1600);
    });

    it("maps negative strength below 1500", () => {
      expect(opToDisplay({ strength: -1.0 })).toBe(1400);
    });
  });
});
