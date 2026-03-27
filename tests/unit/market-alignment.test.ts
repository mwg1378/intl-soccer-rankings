/**
 * Market alignment analysis tests.
 *
 * Tests the comparison engine, metrics computation, and disagreement
 * report generation against mock model output.
 */

import { describe, it, expect } from "vitest";
import {
  compareToMarket,
  computeMetrics,
  generateDisagreementReport,
} from "../../lib/market-alignment";
import { CONSENSUS_ODDS } from "../../lib/market-odds";

// Mock model odds that roughly match market consensus
const MOCK_MODEL_ODDS: Record<string, number> = {
  "Spain": 0.14,
  "England": 0.12,
  "France": 0.10,
  "Argentina": 0.09,
  "Brazil": 0.08,
  "Portugal": 0.07,
  "Germany": 0.06,
  "Netherlands": 0.04,
  "Norway": 0.03,
  "Italy": 0.025,
  "Belgium": 0.02,
  "Colombia": 0.015,
  "United States": 0.02,   // model higher than market
  "Morocco": 0.01,
  "Uruguay": 0.012,
  "Japan": 0.01,
  "Mexico": 0.015,         // model higher (host advantage)
  "Croatia": 0.008,
};

describe("market alignment", () => {
  describe("compareToMarket", () => {
    it("should produce comparisons for all teams in model and market", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      // Should include all teams from both model and consensus
      expect(comparisons.length).toBeGreaterThan(Object.keys(MOCK_MODEL_ODDS).length);
    });

    it("should categorize aligned teams correctly", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      const spain = comparisons.find(c => c.team === "Spain");
      expect(spain).toBeDefined();
      // Spain: model 14% vs market ~15.5% — within a couple pp
      expect(spain!.absDiff).toBeLessThan(0.05);
    });

    it("should flag teams with zero model probability", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      // Teams in market but not in model should have modelProb = 0
      const marketOnly = comparisons.filter(c =>
        c.modelProb === 0 && c.consensusProb > 0
      );
      expect(marketOnly.length).toBeGreaterThan(0);
    });

    it("should sort by consensus probability by default", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      for (let i = 1; i < comparisons.length; i++) {
        expect(comparisons[i].consensusProb).toBeLessThanOrEqual(
          comparisons[i - 1].consensusProb
        );
      }
    });

    it("should assign correct direction", () => {
      const comparisons = compareToMarket({
        "Spain": 0.20, // way higher than market
        "England": 0.01, // way lower than market
      });
      const spain = comparisons.find(c => c.team === "Spain");
      const england = comparisons.find(c => c.team === "England");
      expect(spain!.direction).toBe("MODEL_HIGHER");
      expect(england!.direction).toBe("MODEL_LOWER");
    });
  });

  describe("computeMetrics", () => {
    it("should compute MSE >= 0", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      const metrics = computeMetrics(comparisons);
      expect(metrics.mse).toBeGreaterThanOrEqual(0);
    });

    it("should compute Spearman correlation between -1 and 1", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      const metrics = computeMetrics(comparisons);
      expect(metrics.spearmanCorrelation).toBeGreaterThanOrEqual(-1);
      expect(metrics.spearmanCorrelation).toBeLessThanOrEqual(1);
    });

    it("should have high correlation for similar odds", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      const metrics = computeMetrics(comparisons);
      // Our mock odds are close to market, so correlation should be high
      expect(metrics.spearmanCorrelation).toBeGreaterThan(0.5);
    });

    it("should compute top-N overlap between 0 and 1", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      const metrics = computeMetrics(comparisons);
      expect(metrics.top5Overlap).toBeGreaterThanOrEqual(0);
      expect(metrics.top5Overlap).toBeLessThanOrEqual(1);
      expect(metrics.top10Overlap).toBeGreaterThanOrEqual(0);
      expect(metrics.top10Overlap).toBeLessThanOrEqual(1);
    });

    it("should have perfect metrics when model equals market", () => {
      const comparisons = compareToMarket(CONSENSUS_ODDS);
      const metrics = computeMetrics(comparisons);
      expect(metrics.mse).toBeCloseTo(0, 10);
      expect(metrics.spearmanCorrelation).toBeCloseTo(1, 5);
      expect(metrics.top5Overlap).toBe(1);
    });
  });

  describe("generateDisagreementReport", () => {
    it("should only include teams with meaningful disagreements", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      const report = generateDisagreementReport(comparisons);
      for (const d of report) {
        // All reported disagreements should have absDiff > 1.5pp
        expect(Math.abs(d.diff)).toBeGreaterThan(0.015);
      }
    });

    it("should include justifications for all disagreements", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      const report = generateDisagreementReport(comparisons);
      for (const d of report) {
        expect(d.justification).toBeTruthy();
        expect(d.justification.length).toBeGreaterThan(20);
      }
    });

    it("should assign correct severity levels", () => {
      const comparisons = compareToMarket(MOCK_MODEL_ODDS);
      const report = generateDisagreementReport(comparisons);
      for (const d of report) {
        const abs = Math.abs(d.diff);
        if (abs <= 0.03) expect(d.severity).toBe("mild");
        else if (abs <= 0.05) expect(d.severity).toBe("notable");
        else expect(d.severity).toBe("significant");
      }
    });

    it("should produce known-team justifications for major teams", () => {
      // Create a large disagreement for Spain to trigger the custom justification
      const comparisons = compareToMarket({ "Spain": 0.25 });
      const report = generateDisagreementReport(comparisons);
      const spain = report.find(d => d.team === "Spain");
      if (spain) {
        // Should have a specific justification, not the generic fallback
        expect(spain.justification).not.toContain("residual credit");
        expect(spain.justification.length).toBeGreaterThan(50);
      }
    });
  });
});
