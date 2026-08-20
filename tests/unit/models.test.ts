import { describe, expect, it } from 'vitest';
import { runClassical } from '../../src/models/classical';
import { runBayesian } from '../../src/models/bayesian';
import { runQuantumPipeline, runQuantumBothOrders } from '../../src/models/quantum';
import { runExperiment } from '../../src/models/run';
import { DEFAULT_CONFIG } from '../../src/data/seed';
import type { EvidenceItem, Outcome, QuantumConfig } from '../../src/types';

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

function config() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as typeof DEFAULT_CONFIG;
}

describe('Classical model', () => {
  it('normalizes probabilities to sum to 1', () => {
    const r = runClassical(outcomes, evidence([[0.8, 0.5]]), config().classical);
    const total = Object.values(r.probabilities).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('with no evidence returns normalized priors', () => {
    const r = runClassical(outcomes, [], config().classical);
    expect(r.probabilities.o1).toBeCloseTo(0.6, 10);
    expect(r.probabilities.o2).toBeCloseTo(0.4, 10);
  });

  it('moves probability toward the supported outcome', () => {
    const r = runClassical(outcomes, evidence([[0.9, 0.2]]), config().classical);
    expect(r.probabilities.o1).toBeGreaterThan(0.6);
    expect(r.probabilities.o2).toBeLessThan(0.4);
  });

  it('computes expected utility and selects decision by utility', () => {
    const r = runClassical(outcomes, evidence([[0.8, 0.5]]), config().classical);
    expect(r.expectedUtility).toBeCloseTo(
      r.probabilities.o1 * 10 + r.probabilities.o2 * 4,
      10,
    );
    expect(r.decision).toBe('o1');
  });

  it('conditional method differs from frequency method but stays normalized', () => {
    const freq = runClassical(outcomes, evidence([[0.9, 0.5], [0.7, 0.6]]), config().classical);
    const cond = runClassical(
      outcomes,
      evidence([[0.9, 0.5], [0.7, 0.6]]),
      { ...config().classical, probabilityMethod: 'conditional' },
    );
    expect(Object.values(freq.probabilities).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(Object.values(cond.probabilities).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(cond.probabilities.o1).not.toBeCloseTo(freq.probabilities.o1, 6);
  });
});

describe('Bayesian model', () => {
  it('computes posterior P(H|E) = P(E|H)P(H)/P(E)', () => {
    const prior = 0.6;
    const lik = 0.8;
    const expected = (prior * lik) / (prior * lik + 0.4 * 0.5);
    const r = runBayesian(outcomes, evidence([[0.8, 0.5]]), config().bayesian);
    expect(r.probabilities.o1).toBeCloseTo(expected, 10);
  });

  it('handles uniform priors', () => {
    const r = runBayesian(
      outcomes,
      evidence([[0.8, 0.5]]),
      { ...config().bayesian, priorSource: 'uniform' },
    );
    const expected = 0.8 / 1.3;
    expect(r.probabilities.o1).toBeCloseTo(expected, 10);
  });

  it('sequential updates normalize after each evidence', () => {
    const r = runBayesian(
      outcomes,
      evidence([[0.8, 0.5], [0.6, 0.7]]),
      config().bayesian,
    );
    expect(Object.values(r.probabilities).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    const expected = (0.6 * 0.8 * 0.6) / (0.6 * 0.8 * 0.6 + 0.4 * 0.5 * 0.7);
    expect(r.probabilities.o1).toBeCloseTo(expected, 10);
  });

  it('batch update matches sequential product', () => {
    const seq = runBayesian(outcomes, evidence([[0.8, 0.5], [0.6, 0.7]]), config().bayesian);
    const batch = runBayesian(
      outcomes,
      evidence([[0.8, 0.5], [0.6, 0.7]]),
      { ...config().bayesian, updateStrategy: 'batch' },
    );
    expect(batch.probabilities.o1).toBeCloseTo(seq.probabilities.o1, 10);
  });

  it('normalization holds with zero likelihoods', () => {
    const r = runBayesian(outcomes, evidence([[0, 1]]), config().bayesian);
    expect(r.probabilities.o1).toBeCloseTo(0, 6);
    expect(r.probabilities.o2).toBeCloseTo(1, 6);
  });
});

describe('Quantum-Inspired model', () => {
  it('initial state is normalized: Σ|αᵢ|² = 1', () => {
    const pipeline = runQuantumPipeline(outcomes, [], config().quantum);
    const total = Object.values(pipeline.probabilities).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('measurement follows Born rule P(i) = |αᵢ|²', () => {
    const pipeline = runQuantumPipeline(outcomes, [], config().quantum);
    const sqrtP1 = Math.sqrt(0.6);
    expect(pipeline.probabilities.o1).toBeCloseTo(sqrtP1 * sqrtP1, 10);
  });

  it('state stays normalized through context and rotations', () => {
    const pipeline = runQuantumPipeline(
      outcomes,
      evidence([[0.8, 0.5], [0.6, 0.9]]),
      config().quantum,
    );
    const total = Object.values(pipeline.probabilities).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 8);
  });

  it('evidence rotation moves probability toward the supported outcome', () => {
    const before = runQuantumPipeline(outcomes, [], config().quantum).probabilities;
    const after = runQuantumPipeline(outcomes, evidence([[0.95, 0.05]]), config().quantum).probabilities;
    expect(after.o1).toBeGreaterThan(before.o1);
  });

  it('produces non-zero interference when phases are active', () => {
    const q = config().quantum;
    const pipeline = runQuantumPipeline(outcomes, evidence([[0.8, 0.5], [0.6, 0.9]]), q);
    expect(pipeline.totalInterference).toBeGreaterThan(1e-6);
  });

  it('interference is zero when interference mode is off (dephasing)', () => {
    const q: QuantumConfig = { ...config().quantum, interferenceMode: 'off' };
    const pipeline = runQuantumPipeline(outcomes, evidence([[0.8, 0.5], [0.6, 0.9]]), q);
    expect(pipeline.totalInterference).toBeLessThan(1e-9);
    const on = runQuantumPipeline(outcomes, evidence([[0.8, 0.5], [0.6, 0.9]]), config().quantum);
    expect(pipeline.probabilities.o1).not.toBeCloseTo(on.probabilities.o1, 6);
  });

  it('is order-sensitive: U(E1)U(E2) ≠ U(E2)U(E1)', () => {
    const both = runQuantumBothOrders(
      outcomes,
      evidence([[0.8, 0.5], [0.6, 0.9]]),
      config().quantum,
    );
    expect(both.distance).toBeGreaterThan(0);
    expect(both.orderAB.o1).not.toBeCloseTo(both.orderBA.o1, 8);
  });

  it('uniform initialization yields 1/√N amplitudes', () => {
    const q: QuantumConfig = { ...config().quantum, amplitudeInit: 'uniform' };
    const pipeline = runQuantumPipeline(outcomes, [], q);
    expect(pipeline.probabilities.o1).toBeCloseTo(0.5, 10);
  });

  it('single outcome degenerates gracefully', () => {
    const single: Outcome[] = [{ id: 'o1', label: 'Only', utility: 1, priorProbability: 1 }];
    const pipeline = runQuantumPipeline(single, evidence([[1]]), config().quantum);
    expect(pipeline.probabilities.o1).toBeCloseTo(1, 10);
  });
});

describe('Experiment run orchestrator', () => {
  it('produces a complete results object for a full experiment', () => {
    const experiment = {
      id: 'test-exp',
      name: 'Test',
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
        observedOutcomeId: 'o1',
      },
      evidence: evidence([[0.8, 0.5], [0.6, 0.9]]),
      models: { classical: true, bayesian: true, quantum: true },
      config: config(),
    };
    const r = runExperiment(experiment);
    expect(r.models.classical.status).toBe('ok');
    expect(r.models.bayesian.status).toBe('ok');
    expect(r.models.quantum.status).toBe('ok');
    expect(r.metrics.classical.accuracy).toBe(1);
    expect(r.metrics.classical.brierScore).toBeGreaterThanOrEqual(0);
    expect(r.metrics.classical.predictionError).toBeGreaterThanOrEqual(0);
    expect(r.metrics.classical.predictionError).toBeLessThanOrEqual(1);
    expect(r.qai.value).toBeGreaterThanOrEqual(0);
    expect(r.qai.value).toBeLessThanOrEqual(1);
    expect(r.recommendation.modelId).toBeDefined();
  });

  it('respects model selection', () => {
    const experiment = {
      id: 'test-exp2',
      name: 'Test2',
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
        observedOutcomeId: 'o1',
      },
      evidence: evidence([[0.8, 0.5]]),
      models: { classical: true, bayesian: false, quantum: false },
      config: config(),
    };
    const r = runExperiment(experiment);
    expect(r.models.bayesian.status).toBe('skipped');
    expect(r.models.quantum.status).toBe('skipped');
  });
});