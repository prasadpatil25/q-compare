import type { EvidenceItem, Outcome, QuantumConfig } from '../../types';
import { clamp, seededRandom } from '../../utils';
import { outcomeIds } from '../shared';
import { runQuantumPipeline } from './index';

/**
 * Maximum-likelihood fitting for the Quantum-Inspired model.
 *
 * Free parameters (fit to observed data):
 *   - contextStrength (maps to the context-transformation phase
 *     λ = (π/4) · contextStrength · confidenceⱼ of e^{iλ|cⱼ⟩⟨cⱼ|})
 *   - rotationStrength (scales the Givens rotation angle of each evidence step)
 *
 * Parameter count nParams is 2 when the context transformation is enabled,
 * 1 when it is disabled (rotation only), and 0 when there is no evidence
 * (predictions do not depend on the strengths).
 *
 * Optimizer: deterministic bounded coordinate-descent (Hooke–Jeeves style
 * pattern search with step halving) seeded from a fixed grid plus seeded
 * random restarts. No gradient required. Reproducible for a given seed.
 *
 * Model selection helpers:
 *   AIC = 2·k + 2·NLL
 *   BIC = k·ln(N) + 2·NLL     (N = total observed trials)
 *
 * Identifiability note: for evidence patterns with weak likelihood
 * contrast, the negative log-likelihood can exhibit a near-exact
 * reflection symmetry λ → −λ (with a matching rotation adjustment),
 * producing almost identical predictions for widely different fitted
 * parameters. Strong-contrast evidence resolves the ambiguity. This is
 * an inherent property of the model family, not an optimizer artifact —
 * it must be reported whenever fitted phases are interpreted.
 */

export interface FitConditionInput {
  /** Condition id (e.g. 'AB' or 'BA' evidence order). */
  id: string;
  outcomes: Outcome[];
  /** Condition-specific evidence — order matters for the quantum model. */
  evidence: EvidenceItem[];
  /** Number of observations in this condition. */
  trials: number;
  /** Observed counts per outcome id (integers ≥ 0). */
  observed: Record<string, number>;
}

export interface FitOptions {
  seed?: number;
  /** Number of seeded random restarts on top of the fixed grid. Default 8. */
  restarts?: number;
  /** Step-size convergence tolerance. Default 1e-6. */
  tolerance?: number;
  contextTransformation?: 'unitary-mix' | 'none';
  interferenceMode?: 'on' | 'off';
  amplitudeInit?: 'sqrt-prior' | 'uniform';
  bounds?: {
    contextStrength: [number, number];
    rotationStrength: [number, number];
  };
}

export interface FitResult {
  contextStrength: number;
  rotationStrength: number;
  nParams: number;
  /** Negative log-likelihood over all conditions (counts). */
  nll: number;
  aic: number;
  bic: number;
  converged: boolean;
  iterations: number;
  restarts: number;
  /** Predicted probabilities per condition (outcomeId → p). */
  predictions: Record<string, Record<string, number>>;
  nllByCondition: Record<string, number>;
}

export const DEFAULT_BOUNDS: NonNullable<FitOptions['bounds']> = {
  contextStrength: [-2, 2],
  rotationStrength: [0, 2],
};

const CLAMP_PROB_MIN = 1e-9;

function baseConfig(options: FitOptions): QuantumConfig {
  return {
    stateRepresentation: 'amplitude-vector',
    amplitudeInit: options.amplitudeInit ?? 'sqrt-prior',
    contextTransformation: options.contextTransformation ?? 'unitary-mix',
    interferenceMode: options.interferenceMode ?? 'on',
    measurement: 'born-rule',
    rotationStrength: 0,
    contextStrength: 0,
  };
}

function configFor(base: QuantumConfig, contextStrength: number, rotationStrength: number): QuantumConfig {
  return { ...base, contextStrength, rotationStrength };
}

/** Multinomial negative log-likelihood for one condition. */
export function conditionNll(
  predicted: Record<string, number>,
  observed: Record<string, number>,
): number {
  let acc = 0;
  for (const [id, count] of Object.entries(observed)) {
    if (count <= 0) continue;
    const prob = clamp(predicted[id] ?? 0, CLAMP_PROB_MIN, 1 - CLAMP_PROB_MIN);
    acc -= count * Math.log(prob);
  }
  return acc;
}

/** Negative log-likelihood of the data across conditions for given strengths. */
export function quantumNll(
  contextStrength: number,
  rotationStrength: number,
  conditions: FitConditionInput[],
  options: FitOptions = {},
): { nll: number; nllByCondition: Record<string, number>; predictions: Record<string, Record<string, number>> } {
  const base = baseConfig(options);
  const nllByCondition: Record<string, number> = {};
  const predictions: Record<string, Record<string, number>> = {};
  let nll = 0;
  for (const cond of conditions) {
    const cfg = configFor(base, contextStrength, rotationStrength);
    const probs = runQuantumPipeline(cond.outcomes, cond.evidence, cfg).probabilities;
    const per = conditionNll(probs, cond.observed);
    nllByCondition[cond.id] = per;
    predictions[cond.id] = probs;
    nll += per;
  }
  return { nll, nllByCondition, predictions };
}

/** AIC = 2k + 2·NLL */
export function aicOf(nParams: number, nll: number): number {
  return 2 * nParams + 2 * nll;
}

/** BIC = k·ln(N) + 2·NLL with N = total trials across conditions. */
export function bicOf(nParams: number, nll: number, totalTrials: number): number {
  return nParams * Math.log(Math.max(1, totalTrials)) + 2 * nll;
}

function totalTrials(conditions: FitConditionInput[]): number {
  return conditions.reduce((acc, c) => acc + Math.max(0, c.trials), 0);
}

function patternSearch(
  start: number[],
  bounds: number[][],
  fn: (x: number[]) => number,
  tolerance: number,
): { x: number[]; value: number; iterations: number } {
  const n = start.length;
  let x = start.map((v, i) => clamp(v, bounds[i][0], bounds[i][1]));
  let best = fn(x);
  const steps = bounds.map(([lo, hi]) => (hi - lo) / 16);
  let iterations = 0;
  while (steps.some((s) => s > tolerance) && iterations < 1000) {
    iterations++;
    let improved = false;
    for (let i = 0; i < n; i++) {
      for (const dir of [1, -1]) {
        const trial = [...x];
        trial[i] = clamp(trial[i] + dir * steps[i], bounds[i][0], bounds[i][1]);
        const v = fn(trial);
        if (v < best - 1e-12) {
          best = v;
          x = trial;
          improved = true;
        }
      }
    }
    if (!improved) {
      for (let i = 0; i < n; i++) steps[i] /= 2;
    }
  }
  return { x, value: best, iterations };
}

/**
 * Fit the quantum-inspired model to observed outcome counts.
 * Conditions may differ in evidence order (e.g. AB vs BA), but share
 * the fitted strengths — appropriate for order-effect datasets.
 */
export function fitQuantumToData(
  conditions: FitConditionInput[],
  options: FitOptions = {},
): FitResult {
  if (conditions.length === 0) {
    throw new Error('fitQuantumToData: at least one condition is required');
  }
  const hasEvidence = conditions.some((c) => c.evidence.length > 0);
  const fitContext = (options.contextTransformation ?? 'unitary-mix') === 'unitary-mix';
  const nParams = hasEvidence ? (fitContext ? 2 : 1) : 0;
  const bounds = options.bounds ?? DEFAULT_BOUNDS;
  const tol = options.tolerance ?? 1e-6;

  if (!hasEvidence) {
    const pred = quantumNll(1, 1, conditions, options);
    return {
      contextStrength: 1,
      rotationStrength: 1,
      nParams: 0,
      nll: pred.nll,
      aic: aicOf(0, pred.nll),
      bic: bicOf(0, pred.nll, totalTrials(conditions)),
      converged: true,
      iterations: 0,
      restarts: 0,
      predictions: pred.predictions,
      nllByCondition: pred.nllByCondition,
    };
  }

  const evalAt = (x: number[]) =>
    quantumNll(x[0], x[1], conditions, options).nll;

  const startPoints: number[][] = [
    [0, 0],
    [0, 0.5],
    [0, 1],
    [0, 1.5],
    [0, 2],
    [-1, 1],
    [1, 1],
  ];
  const rand = seededRandom(options.seed ?? 42);
  for (let r = 0; r < (options.restarts ?? 8); r++) {
    const ctx = fitContext
      ? bounds.contextStrength[0] + rand() * (bounds.contextStrength[1] - bounds.contextStrength[0])
      : 0;
    const rot = bounds.rotationStrength[0] + rand() * (bounds.rotationStrength[1] - bounds.rotationStrength[0]);
    startPoints.push([ctx, rot]);
  }

  const searchBounds: number[][] = [
    fitContext ? bounds.contextStrength : [0, 0],
    bounds.rotationStrength,
  ];

  let best: { x: number[]; value: number; iterations: number } | null = null;
  for (const start of startPoints) {
    const res = patternSearch(start, searchBounds, evalAt, tol);
    if (!best || res.value < best.value) best = res;
  }

  const x = best!.x;
  const contextStrength = fitContext ? x[0] : 0;
  const rotationStrength = x[1];
  const pred = quantumNll(contextStrength, rotationStrength, conditions, options);

  return {
    contextStrength,
    rotationStrength,
    nParams,
    nll: pred.nll,
    aic: aicOf(nParams, pred.nll),
    bic: bicOf(nParams, pred.nll, totalTrials(conditions)),
    converged: best!.iterations < 1000,
    iterations: best!.iterations,
    restarts: startPoints.length,
    predictions: pred.predictions,
    nllByCondition: pred.nllByCondition,
  };
}

/** Convenience: build the two conditions of an order-effect comparison. */
export function orderEffectConditions(
  outcomes: Outcome[],
  evidence: EvidenceItem[],
  observedAB: Record<string, number>,
  observedBA: Record<string, number>,
  trials: number,
): FitConditionInput[] {
  return [
    { id: 'AB', outcomes, evidence: [...evidence], trials, observed: observedAB },
    { id: 'BA', outcomes, evidence: [...evidence].reverse(), trials, observed: observedBA },
  ];
}

/** Convenience: fit a single condition (e.g. one disjunction scenario). */
export function fitQuantumSingle(
  outcomes: Outcome[],
  evidence: EvidenceItem[],
  observed: Record<string, number>,
  trials: number,
  options: FitOptions = {},
): FitResult {
  const ids = outcomeIds(outcomes);
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = observed[id] ?? 0;
  return fitQuantumToData([{ id: 'single', outcomes, evidence, trials, observed: counts }], options);
}

/**
 * Convert per-outcome proportions (summing to 1) to counts for a given
 * number of trials. Observed values in `fitQuantumToData` are counts.
 */
export function proportionsToCounts(
  proportions: Record<string, number>,
  trials: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, p] of Object.entries(proportions)) {
    out[id] = Math.max(0, Math.round(p * trials));
  }
  return out;
}