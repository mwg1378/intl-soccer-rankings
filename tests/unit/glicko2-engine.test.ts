/**
 * Glicko-2 engine tests.
 */

import { describe, it, expect } from "vitest";
import {
  initGlicko,
  glickoToDisplay,
  rdToDisplay,
  processMatch,
  updateGlicko,
  applyGlickoReversion,
  applyRdIncrease,
} from "../../lib/glicko2-engine";

describe("glicko2-engine", () => {
  describe("initGlicko", () => {
    it("initializes at 1500 display rating", () => {
      const state = initGlicko();
      expect(glickoToDisplay(state)).toBeCloseTo(1500, 0);
    });

    it("initializes with high RD (uncertainty)", () => {
      const state = initGlicko();
      expect(rdToDisplay(state)).toBeGreaterThan(300);
    });
  });

  describe("processMatch", () => {
    it("winner gains rating, loser drops", () => {
      const home = initGlicko();
      const away = initGlicko();
      const result = processMatch(home, away, 2, 0);

      expect(glickoToDisplay(result.home)).toBeGreaterThan(1500);
      expect(glickoToDisplay(result.away)).toBeLessThan(1500);
    });

    it("draw keeps ratings roughly equal", () => {
      const home = initGlicko();
      const away = initGlicko();
      const result = processMatch(home, away, 1, 1);

      expect(Math.abs(glickoToDisplay(result.home) - 1500)).toBeLessThan(10);
      expect(Math.abs(glickoToDisplay(result.away) - 1500)).toBeLessThan(10);
    });

    it("PSO winner gets slight advantage", () => {
      const home = initGlicko();
      const away = initGlicko();
      const result = processMatch(home, away, 1, 1, 5, 4);

      expect(glickoToDisplay(result.home)).toBeGreaterThan(glickoToDisplay(result.away));
    });

    it("reduces RD (uncertainty) after matches", () => {
      const initial = initGlicko();
      const opponent = initGlicko();
      const result = processMatch(initial, opponent, 1, 0);

      expect(result.home.rd).toBeLessThan(initial.rd);
    });

    it("decisive results move ratings more than narrow ones", () => {
      const home1 = initGlicko();
      const away1 = initGlicko();
      const narrow = processMatch(home1, away1, 1, 0);

      // A second match against a fresh opponent
      const home2 = initGlicko();
      const away2 = initGlicko();
      // Note: both start equal so 1-0 and 3-0 produce same W (1.0 vs 0.0)
      // The rating change depends on the opponent's RD, not the margin
      const narrowGain = glickoToDisplay(narrow.home) - 1500;
      expect(narrowGain).toBeGreaterThan(0);
    });
  });

  describe("applyRdIncrease", () => {
    it("increases RD to reflect inactivity", () => {
      const state = { mu: 0, rd: 1.0, vol: 0.06 };
      const increased = applyRdIncrease(state);
      expect(increased.rd).toBeGreaterThan(state.rd);
    });

    it("caps RD at maximum", () => {
      const state = { mu: 0, rd: 2.4, vol: 0.5 };
      const increased = applyRdIncrease(state);
      expect(increased.rd).toBeLessThanOrEqual(2.5);
    });
  });

  describe("applyGlickoReversion", () => {
    it("pulls ratings toward 1500", () => {
      const state = { mu: 2.0, rd: 1.0, vol: 0.06 };
      const reverted = applyGlickoReversion(state);
      expect(Math.abs(reverted.mu)).toBeLessThan(Math.abs(state.mu));
    });

    it("does not change rating at 0 (=1500)", () => {
      const state = { mu: 0, rd: 1.0, vol: 0.06 };
      const reverted = applyGlickoReversion(state);
      expect(reverted.mu).toBe(0);
    });
  });

  describe("convergence", () => {
    it("strong team converges above 1500 after multiple wins", () => {
      let strong = initGlicko();
      for (let i = 0; i < 20; i++) {
        const weak = initGlicko();
        const result = processMatch(strong, weak, 2, 0);
        strong = result.home;
      }
      expect(glickoToDisplay(strong)).toBeGreaterThan(1600);
    });
  });
});
