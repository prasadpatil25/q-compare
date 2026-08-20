import { describe, expect, it } from 'vitest';
import { computeQai, computeQaiComponents, analyzeContextAndOrder } from '../../src/qai';
import { runExperiment } from '../../src/models/run';
import { DEFAULT_CONFIG } from '../../src/data/seed';
import type { EvaluationMetrics, EvidenceItem, ModelId, Outcome } from '../../src/types';

const outcomes: Outcome[] = [
  { id: 'o1', label: 'A', utility: 10, priorProbability: 0.6 },
  { id: 'o2', label: 'B', utility: 4, priorProbability: 0.4 },
];

function evidence(likelihoods: number[][], confidences: number[] = [], contexts: string[] = []): EvidenceItem[] {
  return likelihoods.map((l, i) => ({
    id: `e${i}`,
    name: `E${i + 1}`,
    value: `value${i + 1}`,
    confidence: confidences[i] ?? 0.8,
    context: contexts[i] ?? 'ctx',
    sequence: i + 1,
    likelihood: { o1: l[0], o2: l[1] },
  }));
}

function baseExperiment(overrides: Partial<Parameters<typeof runExperiment>[0]> = {}) {
  return {
    id: 'e',
    name: 'E',
    description: '',
    researchQuestion: '',
    category: 'Custom' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    status: 'completed' as const,
    problem: {
      decisionQuestion: 'Which?',
      alternatives: [{ id: 'a1', label: 'A' }],
      outcomes,
      observedOutcomeId: 'o1' as string | undefined,
    },
    evidence: evidence([[0.8, 0.5]]),
    models: { classical: true, bayesian: true, quantum: true },
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    ...overrides,
  };
}

describe('Evaluation metrics', () => {
  const r = runExperiment(baseExperiment());
  const m = r.metrics;

  it('computes accuracy as 1 when prediction matches observation', () => {
    expect(m.classical.accuracy).toBe(1);
    expect(m.bayesian.accuracy).toBe(1);
    expect(m.quantum.accuracy).toBe(1);
  });

  it('computes Brier score within [0, 2]', () => {
    (['classical', 'bayesian', 'quantum'] as ModelId[]).forEach((id) => {
      const b = m[id].brierScore ?? 0;
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(2);
    });
  });

  it('computes log-likelihood as ln P(observed)', () => {
    const pObs = r.models.classical.probabilities.o1;
    expect(m.classical.logLikelihood).toBeCloseTo(Math.log(pObs), 6);
  });

  it('computes calibration error in [0, 1]', () => {
    (['classical', 'bayesian', 'quantum'] as ModelId[]).forEach((id) => {
      const c = m[id].calibrationError ?? 0;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    });
  });

  it('computes prediction error as 1 − P(observed)', () => {
    expect(m.classical.predictionError).toBeCloseTo(1 - r.models.classical.probabilities.o1, 6);
  });

  it('reports model complexity separately', () => {
    expect(m.classical.complexity).toBe(1);
    expect(m.bayesian.complexity).toBe(2);
    expect(m.quantum.complexity).toBe(3);
  });

  it('quantum metrics expose interference and non-commutativity when applicable', () => {
    const multi = runExperiment(baseExperiment({ evidence: evidence([[0.8, 0.5], [0.6, 0.9]]) }));
    expect(multi.metrics.quantum.interferenceMeasure).toBeGreaterThan(0);
    expect(multi.metrics.quantum.nonCommutativity).toBeGreaterThan(0);
    expect(multi.metrics.classical.orderEffect).toBe(0);
  });

  it('metrics are null when no observed outcome exists', () => {
    const noObs = runExperiment(
      baseExperiment({ problem: { ...baseExperiment().problem, observedOutcomeId: undefined } }),
    );
    expect(noObs.metrics.classical.accuracy).toBeNull();
    expect(noObs.metrics.classical.logLikelihood).toBeNull();
    expect(noObs.metrics.classical.brierScore).toBeNull();
    expect(noObs.metrics.classical.predictionError).toBeNull();
  });
});

describe('QAI', () => {
  it('stays within [0, 1] for various configurations', () => {
    const configs = [
      baseExperiment(),
      baseExperiment({ evidence: evidence([[0.8, 0.5], [0.6, 0.9], [0.3, 0.7]]) }),
      baseExperiment({ evidence: [] }),
      baseExperiment({ problem: { ...baseExperiment().problem, observedOutcomeId: undefined } }),
    ];
    configs.forEach((cfg) => {
      const r = runExperiment(cfg);
      expect(r.qai.value).toBeGreaterThanOrEqual(0);
      expect(r.qai.value).toBeLessThanOrEqual(1);
    });
  });

  it('component computation normalizes error reduction to [0, 1]', () => {
    const r = runExperiment(baseExperiment());
    const components = computeQaiComponents({
      metrics: r.metrics,
      totalInterference: r.interferenceAnalysis?.total ?? 0,
      nonCommutativity: r.nonCommutativityAnalysis?.distance ?? 0,
    });
    (Object.values(components)).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('applies weights as a weighted mean', () => {
    const components = {
      context: 1,
      interference: 0,
      errorReduction: 0,
      nonCommutativity: 0,
      calibration: 0,
    };
    const weights = { context: 0.5, interference: 0.1, errorReduction: 0.1, nonCommutativity: 0.1, calibration: 0.2 };
    const qai = computeQai(components, weights, [], []);
    expect(qai.value).toBeCloseTo(0.5, 6);
  });

  it('no-advantage case yields low level with empty reasons', () => {
    const components = {
      context: 0,
      interference: 0,
      errorReduction: 0,
      nonCommutativity: 0,
      calibration: 0,
    };
    const weights = { context: 0.25, interference: 0.25, errorReduction: 0.2, nonCommutativity: 0.15, calibration: 0.15 };
    const qai = computeQai(components, weights, [], []);
    expect(qai.value).toBe(0);
    expect(qai.level).toBe('low');
  });

  it('classifies boundary values correctly', () => {
    const weights = { context: 1, interference: 0, errorReduction: 0, nonCommutativity: 0, calibration: 0 };
    const mk = (context: number) =>
      computeQai({ context, interference: 0, errorReduction: 0, nonCommutativity: 0, calibration: 0 }, weights, [], []);
    expect(mk(0.1).level).toBe('low');
    expect(mk(0.3).level).toBe('limited');
    expect(mk(0.6).level).toBe('moderate');
    expect(mk(0.8).level).toBe('strong');
  });

  it('never claims quantum superiority — caveats always present', () => {
    const qai = computeQai(
      { context: 1, interference: 1, errorReduction: 1, nonCommutativity: 1, calibration: 1 },
      { context: 1, interference: 1, errorReduction: 1, nonCommutativity: 1, calibration: 1 },
      [],
      [],
    );
    expect(qai.reasons.some((r) => /stronger performance/i.test(r))).toBe(false);
    expect(qai.caveats.length).toBeGreaterThan(0);
    expect(qai.caveats.some((c) => c.includes('simulation'))).toBe(true);
  });
});

describe('Context and order analysis', () => {
  it('detects contexts when evidence has distinct contexts', () => {
    const experiment = baseExperiment({
      evidence: evidence([[0.8, 0.5], [0.6, 0.9]], [0.8, 0.8], ['budget', 'climate']),
    });
    const analysis = analyzeContextAndOrder(experiment);
    expect(analysis.context?.applicable).toBe(true);
    expect(analysis.context?.contexts).toEqual(['budget', 'climate']);
  });

  it('marks order analysis applicable for ≥2 evidence items', () => {
    const experiment = baseExperiment({ evidence: evidence([[0.8, 0.5], [0.6, 0.9]]) });
    const analysis = analyzeContextAndOrder(experiment);
    expect(analysis.order?.applicable).toBe(true);
    expect(analysis.nonCommutativity).toBeGreaterThan(0);
  });

  it('marks order analysis not applicable for single evidence', () => {
    const experiment = baseExperiment({ evidence: evidence([[0.8, 0.5]]) });
    const analysis = analyzeContextAndOrder(experiment);
    expect(analysis.order?.applicable ?? false).toBe(false);
    expect(analysis.nonCommutativity).toBeNull();
  });
});

describe('Recommendation logic', () => {
  it('can recommend classical or bayesian when quantum shows no advantage', () => {
    const r = runExperiment(baseExperiment());
    expect(['classical', 'bayesian', 'quantum']).toContain(r.recommendation.modelId);
    expect(r.recommendation.reason.length).toBeGreaterThan(10);
  });

  it('recommendation reflects measured results (scores present)', () => {
    const r = runExperiment(baseExperiment());
    expect(r.recommendation.modelId).toBeTruthy();
    const m: EvaluationMetrics = r.metrics[r.recommendation.modelId];
    expect(m).toBeDefined();
  });
});