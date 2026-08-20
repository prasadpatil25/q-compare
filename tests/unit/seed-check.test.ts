import { describe, expect, it, beforeEach } from 'vitest';
import { loadStore, resetStore } from '../../src/services/store';

describe('Seed quality', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });
  it('prints and validates seed QAI values', () => {
    const store = loadStore();
    for (const e of store.experiments) {
      const r = e.results!;
      console.log(
        e.name.padEnd(44),
        'QAI:', r.qai.value.toFixed(3),
        '| rec:', r.recommendation.modelId.padEnd(9),
        '| order:', (r.nonCommutativityAnalysis?.distance ?? 0).toFixed(3),
        '| interf:', r.interferenceAnalysis?.total.toFixed(3),
      );
      expect(r.qai.value).toBeGreaterThanOrEqual(0);
      expect(r.qai.value).toBeLessThanOrEqual(1);
      expect(r.metrics.quantum.expectedUtility).not.toBeNull();
      expect(r.models.quantum.steps.length).toBeGreaterThan(2);
    }
    const travel = store.experiments.find((e) => e.id === 'exp_travel_order');
    expect(travel?.results?.qai.value).toBeGreaterThanOrEqual(0.5);
  });
});
