import { describe, expect, it } from 'vitest';
import { runCorpusBootstrap } from '../../src/analysis/corpus';

/**
 * Nonparametric bootstrap over respondents (Section III-G of the manuscript).
 * Addresses the "six datasets, in-sample model selection" concern: it reports
 * how stable each dataset's model-selection outcome is under respondent
 * sampling noise, which aggregate contingency tables do permit even though
 * respondent-level cross-validation does not.
 */
describe('corpus bootstrap', () => {
  const result = runCorpusBootstrap({ seed: 42, replicates: 400 });

  it('prints bootstrap CIs and win rates per dataset', () => {
    for (const d of result.datasets) {
      // eslint-disable-next-line no-console
      console.log(
        `${d.datasetId}: dAIC(q vs pooled)=${d.observed.deltaAicQuantumVsPooled} ` +
          `CI95=[${d.ci95.deltaAicQuantumVsPooled[0]}, ${d.ci95.deltaAicQuantumVsPooled[1]}] ` +
          `winRate=${d.quantumBeatsPooledRate} | ` +
          `dAIC(q vs anchor)=${d.observed.deltaAicQuantumVsAnchor} ` +
          `CI95=[${d.ci95.deltaAicQuantumVsAnchor[0]}, ${d.ci95.deltaAicQuantumVsAnchor[1]}] ` +
          `winRate=${d.quantumBeatsAnchorRate} | ` +
          `class=${d.observed.advantageClass} detectedRate=${d.advantageDetectedRate}`,
      );
    }
    expect(result.datasets).toHaveLength(6);
  });

  it('is deterministic for a fixed seed', () => {
    // Deliberately small: determinism does not need the full replicate budget,
    // and the fit is expensive enough that re-running 400 would dominate the suite.
    const a = runCorpusBootstrap({ seed: 7, replicates: 25 });
    const b = runCorpusBootstrap({ seed: 7, replicates: 25 });
    expect(a).toEqual(b);
  });

  it('brackets each observed point estimate within its bootstrap interval', () => {
    for (const d of result.datasets) {
      const [lo, hi] = d.ci95.deltaAicQuantumVsPooled;
      expect(lo, `${d.datasetId} lower bound`).toBeLessThanOrEqual(hi);
      expect(d.observed.deltaAicQuantumVsPooled, `${d.datasetId} observed within CI`).toBeGreaterThanOrEqual(lo - 1e-6);
      expect(d.observed.deltaAicQuantumVsPooled, `${d.datasetId} observed within CI`).toBeLessThanOrEqual(hi + 1e-6);
    }
  });
});
