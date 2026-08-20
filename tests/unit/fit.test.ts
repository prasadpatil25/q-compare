import { describe, expect, it } from 'vitest';
import { runQuantumPipeline } from '../../src/models/quantum';
import {
  aicOf,
  bicOf,
  conditionNll,
  fitQuantumSingle,
  fitQuantumToData,
  orderEffectConditions,
  proportionsToCounts,
  quantumNll,
} from '../../src/models/quantum/fit';
import { DEFAULT_CONFIG } from '../../src/data/seed';
import { seededRandom } from '../../src/utils';
import type { EvidenceItem, Outcome } from '../../src/types';

const outcomes: Outcome[] = [
  { id: 'o1', label: 'A', utility: 10, priorProbability: 0.5 },
  { id: 'o2', label: 'B', utility: 4, priorProbability: 0.3 },
  { id: 'o3', label: 'C', utility: 1, priorProbability: 0.2 },
];

function evidence(likelihoods: number[][], confidences: number[] = []): EvidenceItem[] {
  return likelihoods.map((l, i) => ({
    id: `e${i}`,
    name: `E${i + 1}`,
    value: `value${i + 1}`,
    confidence: confidences[i] ?? 0.8,
    context: 'ctx',
    sequence: i + 1,
    likelihood: { o1: l[0], o2: l[1], o3: l[2] },
  }));
}

/** Sample multinomial counts with a deterministic RNG. */
function sample(
  p: Record<string, number>,
  trials: number,
  seed: number,
): Record<string, number> {
  const rand = seededRandom(seed);
  const ids = Object.keys(p);
  const counts: Record<string, number> = {};
  ids.forEach((id) => (counts[id] = 0));
  for (let t = 0; t < trials; t++) {
    const u = rand();
    let acc = 0;
    for (const id of ids) {
      acc += p[id];
      if (u <= acc) {
        counts[id]++;
        break;
      }
    }
  }
  return counts;
}

function syntheticObserved(
  truth: { contextStrength: number; rotationStrength: number },
  ev: EvidenceItem[],
  trials: number,
  seed: number,
): Record<string, number> {
  const cfg = {
    ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)).quantum,
    contextStrength: truth.contextStrength,
    rotationStrength: truth.rotationStrength,
  };
  const probs = runQuantumPipeline(outcomes, ev, cfg).probabilities;
  return sample(probs, trials, seed);
}

describe('Quantum model fitting', () => {
  it('reproduces true predictions and reaches an MLE basin (2 params)', () => {
    const truth = { contextStrength: 0.9, rotationStrength: 0.7 };
    const es = evidence([[0.95, 0.3, 0.15], [0.15, 0.9, 0.2], [0.2, 0.25, 0.95]]);
    const observed = syntheticObserved(truth, es, 10000, 11);
    const fit = fitQuantumSingle(outcomes, es, observed, 10000, { seed: 11, restarts: 8 });

    expect(fit.nParams).toBe(2);
    const inEitherBasin =
      Math.abs(fit.contextStrength - truth.contextStrength) < 0.3 ||
      Math.abs(fit.contextStrength + truth.contextStrength) < 0.3;
    expect(inEitherBasin).toBe(true);
    expect(Math.abs(fit.rotationStrength - truth.rotationStrength)).toBeLessThan(0.3);

    const atTruth = quantumNll(truth.contextStrength, truth.rotationStrength, [{ id: 'x', outcomes, evidence: es, trials: 10000, observed }], {});
    expect(fit.nll).toBeLessThanOrEqual(atTruth.nll + 1e-6);

    const pred = fit.predictions.single;
    const truthPred = runQuantumPipeline(outcomes, es, {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)).quantum,
      ...truth,
    }).probabilities;
    const maxDiff = Math.max(...Object.keys(truthPred).map((id) => Math.abs((pred?.[id] ?? 0) - truthPred[id])));
    expect(maxDiff).toBeLessThan(0.005);
  });

  it('documents the λ → −λ reflection symmetry for low-contrast evidence', () => {
    const truth = { contextStrength: 0.9, rotationStrength: 0.7 };
    const es = evidence([[0.85, 0.5, 0.3], [0.4, 0.8, 0.35]]);
    const observed = syntheticObserved(truth, es, 4000, 7);
    const fit = fitQuantumSingle(outcomes, es, observed, 4000, { seed: 11, restarts: 8 });

    const pred = fit.predictions.single;
    const truthPred = runQuantumPipeline(outcomes, es, {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)).quantum,
      ...truth,
    }).probabilities;
    const maxDiff = Math.max(...Object.keys(truthPred).map((id) => Math.abs((pred?.[id] ?? 0) - truthPred[id])));
    expect(maxDiff).toBeLessThan(0.01);
  });

  it('recovers the rotation strength when context transformation is none (1 param)', () => {
    const truth = { contextStrength: 1, rotationStrength: 1.1 };
    const ev = evidence([[0.8, 0.5, 0.3], [0.3, 0.75, 0.4]]);
    const cfg = {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)).quantum,
      contextStrength: truth.contextStrength,
      rotationStrength: truth.rotationStrength,
      contextTransformation: 'none' as const,
    };
    const probs = runQuantumPipeline(outcomes, ev, cfg).probabilities;
    const observed = sample(probs, 3000, 5);
    const fit = fitQuantumSingle(outcomes, ev, observed, 3000, { contextTransformation: 'none', seed: 3 });

    expect(fit.nParams).toBe(1);
    expect(fit.contextStrength).toBe(0);
    expect(Math.abs(fit.rotationStrength - truth.rotationStrength)).toBeLessThan(0.3);
  });

  it('shares fitted parameters across order-effect conditions (AB vs BA)', () => {
    const truth = { contextStrength: 0.8, rotationStrength: 0.6 };
    const ev = evidence([[0.85, 0.4, 0.3], [0.3, 0.8, 0.45]]);

    const cfgAB = {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)).quantum,
      contextStrength: truth.contextStrength,
      rotationStrength: truth.rotationStrength,
    };
    const cfgBA = { ...cfgAB };

    const pAB = runQuantumPipeline(outcomes, ev, cfgAB).probabilities;
    const pBA = runQuantumPipeline(outcomes, [...ev].reverse(), cfgBA).probabilities;
    const observedAB = sample(pAB, 2000, 21);
    const observedBA = sample(pBA, 2000, 22);
    const conditions = orderEffectConditions(outcomes, ev, observedAB, observedBA, 2000);

    expect(conditions[0].evidence[0].id).toBe('e0');
    expect(conditions[1].evidence[0].id).toBe('e1');

    const fit = fitQuantumToData(conditions, { seed: 13, restarts: 6 });
    expect(fit.nParams).toBe(2);
    expect(Math.abs(fit.contextStrength - truth.contextStrength)).toBeLessThan(0.35);
    expect(Math.abs(fit.rotationStrength - truth.rotationStrength)).toBeLessThan(0.35);
    expect(fit.predictions.AB.o1).toBeCloseTo(pAB.o1, 2);
  });

  it('fitted NLL is at most the NLL at any grid neighbor', () => {
    const observed = syntheticObserved({ contextStrength: 1, rotationStrength: 1 }, evidence([[0.8, 0.5, 0.3], [0.4, 0.7, 0.3]]), 2000, 9);
    const ev = evidence([[0.8, 0.5, 0.3], [0.4, 0.7, 0.3]]);
    const cond = [{ id: 'c', outcomes, evidence: ev, trials: 2000, observed }];
    const fit = fitQuantumSingle(outcomes, ev, observed, 2000, { seed: 1, restarts: 4 });

    for (const [cs, rs] of [[1.1, 1.1], [0.9, 1.1], [1.1, 0.9], [0.5, 0.5]] as const) {
      const n = quantumNll(cs, rs, cond, {}).nll;
      expect(fit.nll).toBeLessThanOrEqual(n + 1e-6);
    }
  });

  it('respects bounds and is deterministic for a given seed', () => {
    const observed = syntheticObserved({ contextStrength: 1.7, rotationStrength: 1.8 }, evidence([[0.9, 0.3, 0.2], [0.2, 0.85, 0.4]]), 3000, 4);
    const ev = evidence([[0.9, 0.3, 0.2], [0.2, 0.85, 0.4]]);
    const fit = fitQuantumSingle(outcomes, ev, observed, 3000, { seed: 17, restarts: 3 });
    const fit2 = fitQuantumSingle(outcomes, ev, observed, 3000, { seed: 17, restarts: 3 });

    expect(fit.contextStrength).toBeGreaterThanOrEqual(-2);
    expect(fit.contextStrength).toBeLessThanOrEqual(2);
    expect(fit.rotationStrength).toBeGreaterThanOrEqual(0);
    expect(fit.rotationStrength).toBeLessThanOrEqual(2);
    expect(fit).toEqual(fit2);
  });

  it('computes correct AIC and BIC formulas', () => {
    const nll = 123.45;
    expect(aicOf(2, nll)).toBeCloseTo(2 * 2 + 2 * nll, 10);
    expect(bicOf(2, nll, 400)).toBeCloseTo(2 * Math.log(400) + 2 * nll, 10);
    expect(bicOf(2, nll, 0)).toBeCloseTo(2 * nll, 10);
  });

  it('handles proportions with explicit trials identically to counts', () => {
    const observed = syntheticObserved({ contextStrength: 1, rotationStrength: 0.9 }, evidence([[0.8, 0.5, 0.3]]), 1000, 6);
    const ev = evidence([[0.8, 0.5, 0.3]]);
    const total = Object.values(observed).reduce((a, b) => a + b, 0);
    const asProportions: Record<string, number> = {};
    Object.entries(observed).forEach(([id, n]) => (asProportions[id] = n / total));

    const fitCounts = fitQuantumSingle(outcomes, ev, observed, 1000, { seed: 2 });
    const fitProps = fitQuantumSingle(outcomes, ev, proportionsToCounts(asProportions, 1000), 1000, { seed: 2 });
    expect(fitProps.nll).toBeCloseTo(fitCounts.nll, 6);
    expect(proportionsToCounts({ o1: 0.5, o2: 0.3, o3: 0.2 }, 1000)).toEqual({ o1: 500, o2: 300, o3: 200 });
  });

  it('returns defaults with zero free parameters when there is no evidence', () => {
    const observed = { o1: 500, o2: 300, o3: 200 };
    const fit = fitQuantumSingle(outcomes, [], observed, 1000, { seed: 2 });
    expect(fit.nParams).toBe(0);
    expect(fit.contextStrength).toBe(1);
    expect(fit.rotationStrength).toBe(1);
    expect(fit.converged).toBe(true);
    expect(fit.predictions.single.o1).toBeCloseTo(0.5, 10);
  });

  it('conditionNll penalizes wrong predictions', () => {
    const good = conditionNll({ o1: 0.9, o2: 0.05, o3: 0.05 }, { o1: 900, o2: 50, o3: 50 });
    const bad = conditionNll({ o1: 0.05, o2: 0.9, o3: 0.05 }, { o1: 900, o2: 50, o3: 50 });
    expect(good).toBeLessThan(bad);
    expect(conditionNll({ o1: 0, o2: 0.5, o3: 0.5 }, { o1: 10, o2: 0, o3: 0 })).toBeGreaterThan(0);
  });

  it('throws when no conditions are provided', () => {
    expect(() => fitQuantumToData([], {})).toThrow(/at least one condition/);
  });
});
