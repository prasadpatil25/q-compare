import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  CORPUS_DATASETS,
  OUTCOME_CELLS,
  datasetCounts,
  runCorpusBenchmark,
  writeCorpusBenchmark,
} from '../../src/analysis/corpus';
import type { CorpusBenchmarkResult } from '../../src/analysis/corpus';

const BENCH_PATH = 'data/results/corpus-benchmark.json';

describe('corpus benchmark', () => {
  it('contains the six published datasets with the published sample sizes', () => {
    expect(CORPUS_DATASETS.map((d) => d.id)).toEqual([
      'consistency',
      'contrast',
      'additive',
      'subtractive',
      'racial-hostility-lab',
      'aa-support-lab',
    ]);
    expect(CORPUS_DATASETS.map((d) => [d.nAB, d.nBA])).toEqual([
      [447, 432],
      [437, 377],
      [459, 486],
      [506, 462],
      [116, 108],
      [118, 106],
    ]);
  });

  it('reproduces the published QQ-values (diagonal-sum index)', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    const byId = new Map(result.datasets.map((d) => [d.datasetId, d]));
    // Consistency: 0.4899-0.5625 + 0.2886-0.2130 = 0.0030 (Kellen et al. report .0030)
    expect(byId.get('consistency')!.qqValue).toBeCloseTo(0.003, 4);
    // Subtractive (Rose-Jackson): 0.3379-0.4156 + 0.3202-0.3939 = -0.1514 (paper: q = -.1514)
    expect(byId.get('subtractive')!.qqValue).toBeCloseTo(-0.1514, 4);
  });

  it('is deterministic for a fixed seed', () => {
    const a = runCorpusBenchmark({ seed: 7 });
    const b = runCorpusBenchmark({ seed: 7 });
    expect(a).toEqual(b);
    const c = runCorpusBenchmark({ seed: 8 });
    expect(a).not.toEqual(c);
  });

  it('order-invariant families predict identically for both orders', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      for (const family of ['classical-marginal', 'classical-pooled', 'bayesian'] as const) {
        expect(d.models[family].predictions.AB).toEqual(d.models[family].predictions.BA);
        for (const cell of OUTCOME_CELLS) {
          expect(d.models[family].predictions.AB[cell]).toBeGreaterThanOrEqual(0);
          expect(d.models[family].predictions.AB[cell]).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('classical-marginal predictions equal the marginal products', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      const pred = d.models['classical-marginal'].predictions.AB;
      const pAy = pred.AyBy + pred.AyBn;
      const pBy = pred.AyBy + pred.AnBy;
      expect(pred.AyBy).toBeCloseTo(pAy * pBy, 8);
    }
  });

  it('classical-pooled and bayesian predictions equal the pooled joint frequencies (up to shrinkage)', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      const byId = CORPUS_DATASETS.find((x) => x.id === d.datasetId)!;
      const counts = datasetCounts(byId);
      for (let i = 0; i < 4; i++) {
        const cell = OUTCOME_CELLS[i];
        const freq = (counts.ab[cell] + counts.ba[cell]) / d.total;
        expect(d.models['classical-pooled'].predictions.AB[cell]).toBeCloseTo(freq, 6);
        expect(d.models.bayesian.predictions.AB[cell]).toBeCloseTo(
          (1 + counts.ab[cell] + counts.ba[cell]) / (d.total + 4),
          6,
        );
      }
    }
  });

  it('quantum predictions are normalized per condition and can differ between orders', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      for (const order of ['AB', 'BA'] as const) {
        const sum = OUTCOME_CELLS.reduce((acc, cell) => acc + d.models.quantum.predictions[order][cell], 0);
        expect(sum).toBeCloseTo(1, 6);
      }
    }
    // The fitted quantum model must be able to produce order effects;
    // the average |Δ| across datasets should be non-trivial.
    const deltas = result.datasets.map((d) =>
      OUTCOME_CELLS.reduce(
        (acc, cell) => acc + Math.abs(d.models.quantum.predictions.AB[cell] - d.models.quantum.predictions.BA[cell]),
        0,
      ) / 2,
    );
    expect(Math.max(...deltas)).toBeGreaterThan(1e-4);
  });

  it('quantum in-sample NLL never exceeds the pooled classical NLL (same prior information)', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      expect(d.models.quantum.nll).toBeLessThanOrEqual(d.models['classical-pooled'].nll + 1e-9);
      expect(d.models.quantum.nll).toBeLessThanOrEqual(d.models.bayesian.nll + 1e-9);
    }
  });

  it('saturated per-order model achieves the lowest in-sample NLL on every dataset', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      expect(d.models.saturated.nll).toBeLessThanOrEqual(d.models.quantum.nll + 1e-9);
      expect(d.models.saturated.nll).toBeLessThanOrEqual(d.models['classical-pooled'].nll + 1e-9);
    }
  });

  it('AIC winner is one of the five candidate models and matches the minimum', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      const families = ['classical-marginal', 'classical-pooled', 'bayesian', 'classical-anchor', 'quantum'] as const;
      expect(families).toContain(d.aicWinner);
      const min = Math.min(...families.map((f) => d.models[f].aic));
      expect(d.models[d.aicWinner].aic).toBeCloseTo(min, 6);
    }
    expect(result.summary.nDatasets).toBe(6);
    const totalWins =
      result.summary.wins['classical-marginal'] +
      result.summary.wins['classical-pooled'] +
      result.summary.wins.bayesian +
      result.summary.wins['classical-anchor'] +
      result.summary.wins.quantum;
    expect(totalWins).toBe(6);
  });

  it('classical-anchor is order-sensitive and matched in complexity (k=2) to quantum', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      const anchor = d.models['classical-anchor'];
      expect(anchor.k).toBe(2);
      expect(anchor.predictions.AB).not.toEqual(anchor.predictions.BA);
      // k matched to quantum (also k=2): AIC delta and BIC delta must coincide exactly.
      const bicDelta = d.models.quantum.bic - anchor.bic;
      expect(d.deltaAicQuantumVsAnchor).toBeCloseTo(bicDelta, 4);
    }
  });

  it('BIC winner is one of the five candidate models and matches the minimum', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      const families = ['classical-marginal', 'classical-pooled', 'bayesian', 'classical-anchor', 'quantum'] as const;
      expect(families).toContain(d.bicWinner);
      const min = Math.min(...families.map((f) => d.models[f].bic));
      expect(d.models[d.bicWinner].bic).toBeCloseTo(min, 6);
    }
  });

  it('classifies advantage: detected only when the fitted model uses order sensitivity', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    for (const d of result.datasets) {
      const q = d.models.quantum;
      const used = Math.abs(q.contextStrength) + Math.abs(q.rotationStrength) > 1e-6;
      expect(d.advantageClass === 'detected').toBe(used);
      if (d.advantageClass === 'null') {
        // A null result must coincide with the pooled baseline fit (k=2 <= k=3
        // then explains the AIC win without any genuine advantage).
        expect(q.nll).toBeCloseTo(d.models['classical-pooled'].nll, 6);
      }
    }
    expect(result.summary.advantageDetected + result.summary.advantageNull).toBe(6);
  });

  it('writes a parseable JSON artifact', () => {
    const result = runCorpusBenchmark({ seed: 42 });
    const written = writeCorpusBenchmark(result, BENCH_PATH);
    expect(fs.existsSync(written)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(written, 'utf8')) as CorpusBenchmarkResult;
    expect(parsed.version).toBe('corpus-v1');
    expect(parsed.datasets).toHaveLength(6);
    expect(parsed.summary.nDatasets).toBe(6);
  });
});