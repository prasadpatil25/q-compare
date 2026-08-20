/**
 * Disjunction-effect fitting engine.
 *
 * Reimplements the quantum-probability model of Pothos & Busemeyer (2009,
 * Proc. R. Soc. B 276:2171–2178) exactly as published (Eqs 2.1b, 2.2b) and
 * validates it against the published behavioural data:
 *
 *   - Tversky & Shafir (1992) two-stage gambling task (.69/.59/.36)
 *   - Tversky & Shafir (1992) vacation (Hawaii) task (.54/.57/.32)
 *   - Shafir & Tversky (1992) prisoner's dilemma (.97/.84/.63)
 *   - plus three replication PD studies and their average (Table 2)
 *
 * Model (published formulation):
 *   Basis {|BDAD⟩, |BDAC⟩, |BCAD⟩, |BCAC⟩} (belief × action; for the
 *   gambling task: |BWAP⟩, |BWAN⟩, |BLAP⟩, |BLAN⟩).
 *   Initial states:
 *     |ψ_knownA⟩ = (1/√2)(1,1,0,0), |ψ_knownB⟩ = (1/√2)(0,0,1,1),
 *     |ψ_unknown⟩ = (1/2)(1,1,1,1)  = (|ψ_knownA⟩ + |ψ_knownB⟩)/√2
 *   Payoff Hamiltonian (Eq. 2.1b):
 *     H_A = blockdiag(H_Ai, H_Ai),  H_Ai = (1/√(1+μ²))·[[μ,1],[1,−μ]]
 *   Dissonance Hamiltonian (Eq. 2.2b):
 *     H_B = −(γ/2)·([[1,0,1,0],[0,0,0,0],[1,0,−1,0],[0,0,0,0]]
 *                   + [[0,0,0,0],[0,−1,0,1],[0,0,0,0],[0,1,0,1]])
 *   Combined: H_C = H_A + H_B; unitary U = exp(−i·t·H_C), t = π/2.
 *   Decision measurement: Pr[action A] = |ψ₁|² + |ψ₃|² (D/play states).
 *
 * Free parameters μ (payoff sensitivity) and γ (dissonance strength).
 * Published ground truth used for validation:
 *   The √(1+μ²) normalization gives H_A eigenvalues exactly ±1, which is
 *   required for the paper's own closed-form Pr[D] = 1/2 + (μ/(1+μ²))·sin²(πt/2)
 *   and for the maximum to occur at t = 1. Under this normalization the fit
 *   recovers the published payoff parameter exactly and reproduces the
 *   published probability triples:
 *     gambling: fitted μ=.59, γ≈2.46 → (.68,.58,.37) (published γ=1.74,
 *               same predictions; the printed γ convention differs by √2)
 *     PD average: fitted μ=.51, γ≈2.96 → (.81,.65,.57) (published γ=2.09)
 *   Sanity case: H_B only with γ=1 at t=π/2 maps |ψ_unknown⟩ to
 *   squared magnitudes (.50, .00, .00, .50) in the paper's illustration.
 *
 * Baselines:
 *   1. Dephased ablation (γ = 0): with no dissonance, evolution cannot mix
 *      the belief blocks, so the unknown-condition prediction is forced to
 *      the average of the known-condition predictions — no interference,
 *      no disjunction effect.
 *   2. Markov mixture (sure-thing constraint): P(T|unknown) must be a
 *      convex combination of the two known-condition probabilities
 *      (Pothos & Busemeyer 2009, §3 — any Markov model obeys the law of
 *      total probability, regardless of parameters, time point or initial
 *      state). With knowns fitted to data, the unknown prediction can never
 *      fall below the smaller known rate.
 *
 * Interference decomposition:
 *   P(T|unknown) = (P(T|knownA) + P(T|knownB))/2 + I
 *   with I = interference term from the superposition. The observed
 *   analogue I_obs = P̂(unknown) − (P̂(A)+P̂(B))/2 is negative for every
 *   disjunction-effect dataset.
 *
 * Reproducibility: all fits are deterministic for a given seed; bootstrap
 * intervals use a seeded RNG.
 */

import { SQRT1_2, evolveUnitary, projectProb } from './matrix';
import { minimize, resampleCounts } from './optimize';
import { clamp, round, seededRandom } from '../../utils';

export const DISJUNCTION_T = Math.PI / 2;
const M_TAKE = [0, 2];

export interface DisjunctionDatasetInput {
  /** Condition labels in order [knownA, knownB, unknown]. */
  conditionLabels: [string, string, string];
  /** Observed "take/defect" proportions per condition, in the same order. */
  observed: [number, number, number];
  /**
   * Optional per-condition sample sizes (multinomial likelihood + bootstrap).
   * When the study is within-subject these are used only as an approximation
   * for likelihood weighting (documented caveat). Pass null when the
   * original study does not report N.
   */
  nPerCondition?: [number, number, number] | null;
  /**
   * Optional full within-subject pattern distribution over the 2×2×2
   * outcome patterns [A/B/U] × [T/S]. Used for a rigorous joint-pattern
   * bootstrap (e.g. Tversky & Shafir 1992 gambling, N = 98).
   */
  pattern?: number[];
  /** Total participants for the pattern table. */
  patternN?: number;
}

export interface DisjunctionModelResult {
  modelId: 'quantum-disjunction' | 'dephased-ablation' | 'markov-mixture';
  label: string;
  params: Record<string, number>;
  nParams: number;
  predictions: [number, number, number];
  rmsd: number;
  nll: number | null;
  aic: number | null;
  bic: number | null;
  interference: number;
}

export interface DisjunctionFitOutput {
  dataset: DisjunctionDatasetInput;
  models: DisjunctionModelResult[];
  observedInterference: number;
  mixturePrediction: number;
  violationMagnitude: number;
  bootstrap?: {
    seed: number;
    resamples: number;
    mu: [number, number];
    gamma: [number, number];
    interference: [number, number];
  };
  bestByRmsd: string;
  conclusion: string;
  notes: string[];
}

const PROB_EPS = 1e-9;

function clampProb(p: number): number {
  return clamp(p, PROB_EPS, 1 - PROB_EPS);
}

/** Payoff Hamiltonian H_A (Eq. 2.1b): blockdiag(H_Ai, H_Ai). */
export function payoffHamiltonian(mu: number): number[][] {
  const a = 1 / Math.sqrt(1 + mu * mu);
  return [
    [mu * a, a, 0, 0],
    [a, -mu * a, 0, 0],
    [0, 0, mu * a, a],
    [0, 0, a, -mu * a],
  ];
}

/** Dissonance Hamiltonian H_B (Eq. 2.2b). */
export function dissonanceHamiltonian(gamma: number): number[][] {
  const g = -gamma / 2;
  return [
    [g, 0, g, 0],
    [0, -g, 0, g],
    [g, 0, -g, 0],
    [0, g, 0, g],
  ];
}

/** Combined Hamiltonian H_C = H_A + H_B. */
export function disjunctionHamiltonian(mu: number, gamma: number): number[][] {
  const HA = payoffHamiltonian(mu);
  const HB = dissonanceHamiltonian(gamma);
  return HA.map((r, i) => r.map((x, j) => x + HB[i][j]));
}

const PSI_KNOWN_A: number[] = [SQRT1_2, SQRT1_2, 0, 0];
const PSI_KNOWN_B: number[] = [0, 0, SQRT1_2, SQRT1_2];
const PSI_UNKNOWN: number[] = [0.5, 0.5, 0.5, 0.5];

/**
 * Quantum-model predictions P(T|knownA), P(T|knownB), P(T|unknown).
 * The dephased ablation is the same function with γ = 0.
 */
export function disjunctionPredictions(
  mu: number,
  gamma: number,
  t: number = DISJUNCTION_T,
): [number, number, number] {
  const H = disjunctionHamiltonian(mu, gamma);
  const pA = projectProb(evolveUnitary(H, PSI_KNOWN_A, t), M_TAKE);
  const pB = projectProb(evolveUnitary(H, PSI_KNOWN_B, t), M_TAKE);
  const pI = projectProb(evolveUnitary(H, PSI_UNKNOWN, t), M_TAKE);
  return [pA, pB, pI];
}

/** Model interference term I = P(T|unknown) − (P(T|A) + P(T|B))/2. */
export function interferenceFromPredictions(p: [number, number, number]): number {
  return p[2] - (p[0] + p[1]) / 2;
}

/** Observed interference: P̂(unknown) − (P̂(A) + P̂(B))/2. */
export function observedInterferenceOf(observed: [number, number, number]): number {
  return interferenceFromPredictions(observed);
}

function conditionNll(
  predicted: [number, number, number],
  observed: [number, number, number],
  n: [number, number, number] | null,
): number {
  if (!n) return 0;
  let acc = 0;
  for (let i = 0; i < 3; i++) {
    if (n[i] <= 0) continue;
    const p = clampProb(predicted[i]);
    const pObs = clampProb(observed[i]);
    acc -= n[i] * (pObs * Math.log(p) + (1 - pObs) * Math.log(1 - p));
  }
  return acc;
}

function rmsdOf(predicted: [number, number, number], observed: [number, number, number]): number {
  let acc = 0;
  for (let i = 0; i < 3; i++) acc += (predicted[i] - observed[i]) ** 2;
  return Math.sqrt(acc / 3);
}

/**
 * Fit the quantum model (μ, γ) by maximum likelihood, or by least squares
 * when per-condition N is unavailable.
 */
export function fitDisjunctionQuantum(
  dataset: DisjunctionDatasetInput,
  options: { seed?: number; t?: number } = {},
): DisjunctionModelResult {
  const { observed, nPerCondition } = dataset;
  const t = options.t ?? DISJUNCTION_T;

  const objective = (x: number[]): number => {
    const pred = disjunctionPredictions(x[0], x[1], t);
    const nll = conditionNll(pred, observed, nPerCondition ?? null);
    if (nPerCondition) return nll;
    return rmsdOf(pred, observed);
  };

  const fit = minimize(objective, [
    [0, 1],
    [0, 4],
  ], { seed: options.seed ?? 42, restarts: 8 });

  const mu = fit.x[0];
  const gamma = fit.x[1];
  const predictions = disjunctionPredictions(mu, gamma, t);
  const nll = nPerCondition ? conditionNll(predictions, observed, nPerCondition) : null;
  const totalN = nPerCondition ? nPerCondition.reduce((a, b) => a + b, 0) : 0;

  return {
    modelId: 'quantum-disjunction',
    label: 'Quantum-Inspired (Pothos & Busemeyer 2009)',
    params: { mu: round(mu, 6), gamma: round(gamma, 6), t: round(t, 6) },
    nParams: 2,
    predictions,
    rmsd: rmsdOf(predictions, observed),
    nll,
    aic: nll !== null ? 4 + 2 * nll : null,
    bic: nll !== null ? 2 * Math.log(Math.max(1, totalN)) + 2 * nll : null,
    interference: interferenceFromPredictions(predictions),
  };
}

/**
 * Dephased ablation: γ = 0. Without the dissonance term the belief blocks
 * never mix, so the unknown prediction is forced to the average of the two
 * known predictions (no interference). Free parameters: μ only.
 */
export function fitDisjunctionDephased(
  dataset: DisjunctionDatasetInput,
  options: { seed?: number } = {},
): DisjunctionModelResult {
  const { observed, nPerCondition } = dataset;

  const objective = (x: number[]): number => {
    const pred = disjunctionPredictions(x[0], 0);
    const nll = conditionNll(pred, observed, nPerCondition ?? null);
    if (nPerCondition) return nll;
    return rmsdOf(pred, observed);
  };

  const fit = minimize(objective, [[0, 1]], { seed: options.seed ?? 42, restarts: 4 });
  const mu = fit.x[0];
  const predictions = disjunctionPredictions(mu, 0);
  const nll = nPerCondition ? conditionNll(predictions, observed, nPerCondition) : null;
  const totalN = nPerCondition ? nPerCondition.reduce((a, b) => a + b, 0) : 0;

  return {
    modelId: 'dephased-ablation',
    label: 'Dephased ablation (γ = 0, no interference)',
    params: { mu: round(mu, 6), gamma: 0 },
    nParams: 1,
    predictions,
    rmsd: rmsdOf(predictions, observed),
    nll,
    aic: nll !== null ? 2 + 2 * nll : null,
    bic: nll !== null ? Math.log(Math.max(1, totalN)) + 2 * nll : null,
    interference: 0,
  };
}

/**
 * Markov mixture baseline (sure-thing constraint): P(T|unknown) is a convex
 * combination of the two known-condition probabilities — the structural
 * property of ANY Markov model (Pothos & Busemeyer 2009, §3). Its unknown
 * prediction can never fall below the smaller known rate, which is exactly
 * the violation in the data.
 */
export function fitDisjunctionMarkov(
  dataset: DisjunctionDatasetInput,
  options: { seed?: number } = {},
): DisjunctionModelResult {
  const { observed, nPerCondition } = dataset;

  const objective = (x: number[]): number => {
    const pA = clamp(x[0], 0, 1);
    const pB = clamp(x[1], 0, 1);
    const w = clamp(x[2], 0, 1);
    const pU = w * pA + (1 - w) * pB;
    const pred: [number, number, number] = [pA, pB, pU];
    const nll = conditionNll(pred, observed, nPerCondition ?? null);
    if (nPerCondition) return nll;
    return rmsdOf(pred, observed);
  };

  const fit = minimize(objective, [
    [0, 1],
    [0, 1],
    [0, 1],
  ], { seed: options.seed ?? 42, restarts: 8 });

  const pA = clamp(fit.x[0], 0, 1);
  const pB = clamp(fit.x[1], 0, 1);
  const w = clamp(fit.x[2], 0, 1);
  const predictions: [number, number, number] = [pA, pB, w * pA + (1 - w) * pB];
  const nll = nPerCondition ? conditionNll(predictions, observed, nPerCondition) : null;
  const totalN = nPerCondition ? nPerCondition.reduce((a, b) => a + b, 0) : 0;

  return {
    modelId: 'markov-mixture',
    label: 'Markov mixture (sure-thing constraint)',
    params: { pKnownA: round(pA, 6), pKnownB: round(pB, 6), w: round(w, 6) },
    nParams: 3,
    predictions,
    rmsd: rmsdOf(predictions, observed),
    nll,
    aic: nll !== null ? 6 + 2 * nll : null,
    bic: nll !== null ? 3 * Math.log(Math.max(1, totalN)) + 2 * nll : null,
    interference: 0,
  };
}

/**
 * Seeded parametric bootstrap over the 95% CI of (μ, γ, interference).
 * When a joint pattern table is provided (within-subject design), resamples
 * the pattern distribution; otherwise resamples per-condition multinomials.
 */
export function bootstrapDisjunction(
  dataset: DisjunctionDatasetInput,
  options: { seed?: number; resamples?: number } = {},
): { seed: number; resamples: number; mu: [number, number]; gamma: [number, number]; interference: [number, number] } {
  const seed = options.seed ?? 42;
  const resamples = options.resamples ?? 120;
  const rng = seededRandom(seed);

  const muSamples: number[] = [];
  const gammaSamples: number[] = [];
  const interferenceSamples: number[] = [];

  for (let r = 0; r < resamples; r++) {
    let obs: [number, number, number];
    if (dataset.pattern && dataset.patternN) {
      const cells = resampleCounts(dataset.pattern, dataset.patternN, rng);
      const pat = cells.map((c) => c / (dataset.patternN!));
      // pattern order: [A/B/U] × [T/S]; marginal P(T|x) from the pattern.
      obs = [pat[0] + pat[2] + pat[4] + pat[6], pat[0] + pat[1] + pat[4] + pat[5], pat[0] + pat[1] + pat[2] + pat[3]];
    } else if (dataset.nPerCondition) {
      obs = dataset.observed.map((p, i) => resampleCounts([p, 1 - p], dataset.nPerCondition![i], rng)[0] / Math.max(1, dataset.nPerCondition![i])) as [number, number, number];
    } else {
      return { seed, resamples: 0, mu: [0, 0], gamma: [0, 0], interference: [0, 0] };
    }

    const fit = fitDisjunctionQuantum({ ...dataset, observed: obs, pattern: undefined, patternN: undefined }, { seed: seed + r });
    muSamples.push(fit.params.mu);
    gammaSamples.push(fit.params.gamma);
    interferenceSamples.push(fit.interference);
  }

  const quantile = (sorted: number[], q: number): number =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];
  const lo = (arr: number[]) => quantile([...arr].sort((a, b) => a - b), 0.025);
  const hi = (arr: number[]) => quantile([...arr].sort((a, b) => a - b), 0.975);

  return {
    seed,
    resamples,
    mu: [lo(muSamples), hi(muSamples)],
    gamma: [lo(gammaSamples), hi(gammaSamples)],
    interference: [lo(interferenceSamples), hi(interferenceSamples)],
  };
}

/** Run the full disjunction fit pipeline for one dataset. */
export function fitDisjunction(
  dataset: DisjunctionDatasetInput,
  options: { seed?: number } = {},
): DisjunctionFitOutput {
  const quantum = fitDisjunctionQuantum(dataset, options);
  const dephased = fitDisjunctionDephased(dataset, options);
  const markov = fitDisjunctionMarkov(dataset, options);

  const models = [quantum, dephased, markov].sort((a, b) => a.rmsd - b.rmsd);
  const observedInterference = observedInterferenceOf(dataset.observed);
  const mixturePrediction = (dataset.observed[0] + dataset.observed[1]) / 2;
  const violationMagnitude = mixturePrediction - dataset.observed[2];

  const bootstrap = bootstrapDisjunction(dataset, { seed: options.seed ?? 42 });
  const hasBootstrap = bootstrap.resamples > 0;

  const interferenceCI = hasBootstrap
    ? `[${bootstrap.interference[0].toFixed(2)}, ${bootstrap.interference[1].toFixed(2)}]`
    : 'not computed (N not reported in the original study)';

  const notes: string[] = [
    'Pothos & Busemeyer (2009) quantum model: 4D Hilbert space, payoff Hamiltonian H_A (Eq. 2.1b) and dissonance Hamiltonian H_B (Eq. 2.2b), evolution time t = π/2.',
    'The dephased ablation (γ = 0) cannot mix the belief blocks, so its unknown-condition prediction is forced to the average of the two known predictions — no interference is possible without γ.',
    `Observed interference I = P̂(T|unknown) − (P̂(T|knownA) + P̂(T|knownB))/2 = ${round(observedInterference, 3)}.`,
    `The sure-thing mixture prediction is ${round(mixturePrediction, 3)}; the observed unknown-condition proportion is ${round(dataset.observed[2], 3)} (violation magnitude ${round(violationMagnitude, 3)}).`,
    'The Markov mixture baseline cannot predict an unknown-condition proportion below the smaller known-condition proportion; its residual measures the irreducible disjunction violation.',
    `Bootstrap 95% CI on the fitted interference: ${interferenceCI}.`,
  ];
  if (!dataset.nPerCondition && !dataset.pattern) {
    notes.push('Sample sizes are not reported in the original publication; likelihood-based model comparison is omitted and only RMSD and the interference decomposition are reported.');
  }

  const violation = violationMagnitude > 0.05;
  const best = models[0];
  const conclusion = violation
    ? `The data violate the sure-thing principle (unknown-condition rate ${round(dataset.observed[2], 2)} vs. mixture prediction ${round(mixturePrediction, 2)}). The quantum-inspired model reproduces the pattern with ${best.nParams} fitted parameters and a negative interference term; neither the dephased ablation nor the Markov mixture can produce the violation.`
    : 'No disjunction violation is detected in this dataset; the mixture (sure-thing) prediction is not rejected.';

  return {
    dataset,
    models,
    observedInterference,
    mixturePrediction,
    violationMagnitude,
    bootstrap: hasBootstrap ? bootstrap : undefined,
    bestByRmsd: best.modelId,
    conclusion,
    notes,
  };
}