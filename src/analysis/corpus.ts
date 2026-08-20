import fs from 'node:fs';
import path from 'node:path';
import type { EvidenceItem, Outcome } from '../types';
import { conditionNll, fitQuantumToData, quantumNll, type FitConditionInput, type FitResult } from '../models/quantum/fit';
import { clamp } from '../utils';

/**
 * Corpus benchmark — Wang & Busemeyer (2013) question-order datasets.
 *
 * Data: Table 1 of Wang, Z., & Busemeyer, J. R. (2013). "A Quantum Question
 * Order Model Supported by Empirical Tests of an A Priori and Precise
 * Prediction", Topics in Cognitive Science 5(4): 689-710. Six datasets with
 * full joint-response probabilities for both question orders (AB and BA),
 * including the Moore (2002) Gallup polls (consistency, contrast, additive,
 * subtractive) and two laboratory experiments (racial hostility, affirmative
 * action support). Raw survey corpus of Wang et al. (2014, PNAS) — 72
 * datasets — is not reproduced here; these six are the datasets whose joint
 * probabilities are published in full.
 *
 * Modeling decisions (documented for the manuscript; review-sensitive):
 *
 * 1. Outcomes are the four joint response cells {AyBy, AyBn, AnBy, AnBn}.
 * 2. Prior knowledge: pooled joint frequencies across BOTH orders are given
 *    to every joint model (classical-pooled MLE, Dirichlet posterior
 *    predictive, quantum amplitude initialization). The marginal classical
 *    model receives only the pooled marginals (strictly less information).
 *    This information is order-invariant by construction, so every model
 *    starts from the same "without order" knowledge.
 * 3. Evidence: E_A ("question A asked") and E_B ("question B asked") with
 *    likelihood vectors favoring the cells in which the respective answer is
 *    "yes". Conditions AB = [E_A, E_B], BA = [E_B, E_A]. The quantum model is
 *    the only family whose predictions can differ between orders.
 * 4. Families and free parameters (k):
 *    - classical-marginal : independent-marginals multinomial,
 *                           order-invariant, k = 2
 *    - classical-pooled   : joint multinomial from pooled frequencies,
 *                           order-invariant, k = 3
 *    - bayesian           : Dirichlet(1,1,1,1) posterior predictive over
 *                           the pooled joint cells, order-invariant,
 *                           k = 3 (reported as effective params)
 *    - classical-anchor    : order-sensitive, aggregate-level classical
 *                           comparator, k = 2. Anchoring-and-adjustment
 *                           (Tversky & Kahneman, 1974): base conditional
 *                           response rates come from the pooled joint
 *                           (same order-invariant information as
 *                           classical-pooled); one fitted assimilation
 *                           parameter per order (tauAB, tauBA) shifts the
 *                           second-asked question's conditional response
 *                           toward (tau>0) or away from (tau<0) consistency
 *                           with the first-asked answer. k matches the
 *                           quantum model exactly, giving a fair
 *                           complexity-controlled test of whether the
 *                           quantum model's gains are geometry-specific
 *                           artifacts rather than genuine order-sensitive
 *                           explanatory power.
 *    - quantum            : fitted {contextStrength, rotationStrength},
 *                           order-sensitive, k = 2 (see
 *                           src/models/quantum/fit.ts). Initial amplitudes
 *                           use the pooled joint frequencies (sqrt-prior),
 *                           so it receives exactly the same information as
 *                           classical-pooled.
 *    - saturated          : separate multinomial per order (flexibility
 *                           upper bound), k = 6 — not a candidate model,
 *                           a reference.
 * 5. Selection: minimum AIC (and, separately, minimum BIC) among the five
 *    candidate models (classical-marginal, classical-pooled, bayesian,
 *    classical-anchor, quantum).
 * 6. Dataset features: QQ-value (diagonal-sum order-effect index of
 *    Wang et al. 2014: (p_AB[AyBy] − p_BA[ByAy]) + (p_AB[AnBn] − p_BA[BnAn]))
 *    and order distance ½Σ|p_AB − p_BA|.
 */

export const OUTCOME_CELLS = ['AyBy', 'AyBn', 'AnBy', 'AnBn'] as const;
export type OutcomeCell = (typeof OUTCOME_CELLS)[number];

export interface CorpusDataset {
  id: string;
  label: string;
  questionA: string;
  questionB: string;
  source: string;
  note?: string;
  nAB: number;
  nBA: number;
  /** [AyBy, AyBn, AnBy, AnBn] — question order A then B. */
  probsAB: [number, number, number, number];
  /** [ByAy, ByAn, BnAy, BnAn] — question order B then A. */
  probsBA: [number, number, number, number];
}

export const CORPUS_DATASETS: CorpusDataset[] = [
  {
    id: 'consistency',
    label: 'Consistency (Clinton–Gore)',
    questionA: 'Do you generally think Bill Clinton is honest and trustworthy?',
    questionB: 'Do you generally think Al Gore is honest and trustworthy?',
    source: 'Moore (2002) Gallup poll; Wang & Busemeyer (2013) Table 1',
    nAB: 447,
    nBA: 432,
    probsAB: [0.4899, 0.0447, 0.1767, 0.2886],
    probsBA: [0.5625, 0.1991, 0.0255, 0.2130],
  },
  {
    id: 'contrast',
    label: 'Contrast (Gingrich–Dole)',
    questionA: 'Do you think Newt Gingrich is honest and trustworthy?',
    questionB: 'Do you think Bob Dole is honest and trustworthy?',
    source: 'Moore (2002) Gallup poll; Wang & Busemeyer (2013) Table 1',
    nAB: 437,
    nBA: 377,
    probsAB: [0.3936, 0.0824, 0.3204, 0.2037],
    probsBA: [0.3448, 0.3422, 0.0637, 0.2493],
  },
  {
    id: 'additive',
    label: 'Additive (White–Black hostility)',
    questionA: 'Do you think that only a few or many white people dislike black people?',
    questionB: 'Do you think that only a few or many black people dislike white people?',
    source: 'Moore (2002) Gallup poll; Wang & Busemeyer (2013) Table 1',
    nAB: 459,
    nBA: 486,
    probsAB: [0.3987, 0.0174, 0.1612, 0.4227],
    probsBA: [0.4012, 0.0597, 0.1379, 0.4012],
  },
  {
    id: 'subtractive',
    label: 'Subtractive (Rose–Jackson)',
    questionA: 'Do you think Pete Rose should or should not be eligible for admission to the Hall of Fame?',
    questionB: 'Do you think Shoeless Joe Jackson should or should not be eligible for admission to the Hall of Fame?',
    source: 'Moore (2002) Gallup poll; Wang & Busemeyer (2013) Table 1',
    note: 'Question order was confounded with background information; QQ-equality fails for this dataset (v² = 28.57, p < .01).',
    nAB: 506,
    nBA: 462,
    probsAB: [0.3379, 0.3241, 0.0178, 0.3202],
    probsBA: [0.4156, 0.0671, 0.1234, 0.3939],
  },
  {
    id: 'racial-hostility-lab',
    label: 'Racial hostility (laboratory)',
    questionA: 'Do you think that only a few or many white people dislike black people?',
    questionB: 'Do you think that only a few or many black people dislike white people?',
    source: 'Wang & Busemeyer (2013) laboratory experiment; Table 1',
    nAB: 116,
    nBA: 108,
    probsAB: [0.3751, 0.2556, 0.014, 0.3553],
    probsBA: [0.3749, 0.095, 0.1746, 0.3554],
  },
  {
    id: 'aa-support-lab',
    label: 'Affirmative action support (laboratory)',
    questionA: 'Do you generally favor or oppose affirmative action programs for racial minorities?',
    questionB: 'Do you generally favor or oppose affirmative action programs for women?',
    source: 'Wang & Busemeyer (2013) laboratory experiment; Table 1',
    nAB: 118,
    nBA: 106,
    probsAB: [0.25, 0.0603, 0.2931, 0.3966],
    probsBA: [0.3241, 0.0648, 0.213, 0.3981],
  },
];

export type ModelFamilyId = 'classical-marginal' | 'classical-pooled' | 'bayesian' | 'classical-anchor' | 'quantum';

export interface FamilyFit {
  k: number;
  nll: number;
  aic: number;
  bic: number;
  /** Predicted probabilities per condition (order id → cell → p). */
  predictions: Record<'AB' | 'BA', Record<OutcomeCell, number>>;
}

export interface DatasetBenchmark {
  datasetId: string;
  label: string;
  nAB: number;
  nBA: number;
  total: number;
  /** QQ-value (diagonal-sum order-effect index). */
  qqValue: number;
  /** ½Σ|p_AB − p_BA| over the four joint cells. */
  orderDistance: number;
  models: {
    'classical-marginal': FamilyFit;
    'classical-pooled': FamilyFit;
    bayesian: FamilyFit;
    'classical-anchor': FamilyFit & { tauAB: number; tauBA: number };
    quantum: FamilyFit & { contextStrength: number; rotationStrength: number; converged: boolean };
    saturated: FamilyFit;
  };
  aicWinner: ModelFamilyId;
  bicWinner: ModelFamilyId;
  /**
   * 'detected' — the fitted quantum model used its order sensitivity
   * (contextStrength ≠ 0 or rotationStrength ≠ 0) and improved in-sample
   * NLL over the pooled baseline. 'null' — the best fit coincides with the
   * order-invariant pooled model (0,0); no quantum advantage detected.
   */
  advantageClass: 'detected' | 'null';
  /** AIC(quantum) − AIC(classical-pooled); negative favors the quantum model. */
  deltaAicQuantumVsPooled: number;
  /** BIC(quantum) − BIC(classical-pooled); negative favors the quantum model. */
  deltaBicQuantumVsPooled: number;
  /** AIC(quantum) − AIC(saturated); negative means the quantum model beats the
   *  saturated per-order model at equal-or-lower complexity. */
  deltaAicQuantumVsSaturated: number;
  /** AIC(quantum) − AIC(classical-anchor); k matched (2 vs. 2), so this equals
   *  the BIC difference exactly and reduces to 2·(NLL_q − NLL_anchor). */
  deltaAicQuantumVsAnchor: number;
}

export interface CorpusBenchmarkResult {
  version: string;
  seed: number;
  datasets: DatasetBenchmark[];
  summary: {
    nDatasets: number;
    wins: Record<ModelFamilyId, number>;
    bicWins: Record<ModelFamilyId, number>;
    meanDeltaAicQuantumVsPooled: number;
    meanDeltaAicQuantumVsSaturated: number;
    meanDeltaAicQuantumVsAnchor: number;
    quantumBetterThanPooled: number;
    quantumBetterThanSaturated: number;
    quantumBetterThanAnchor: number;
    advantageDetected: number;
    advantageNull: number;
  };
}

export interface CorpusBenchmarkOptions {
  seed?: number;
  restarts?: number;
  tolerance?: number;
  /** Likelihood placed on evidence-favored cells (default 0.9); see evidenceOf(). */
  support?: number;
}

function round(value: number, digits = 6): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Exact integer counts from proportions via the largest-remainder method:
 * Σ counts === n exactly (independent rounding can drift by ±1 per cell and
 * break the equality between the quantum (0,0) predictions and the pooled
 * classical model).
 */
function exactCounts(probs: readonly number[], n: number): number[] {
  const raw = probs.map((p) => Math.max(0, p) * n);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = n - floored.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((v, i) => ({ i, f: v - floored[i] }))
    .sort((a, b) => b.f - a.f);
  const out = [...floored];
  for (let k = 0; k < remainder; k++) out[byFraction[k].i]++;
  return out;
}

/** Joint cell counts from the published proportions (Σ = n exactly). */
export function datasetCounts(d: CorpusDataset): {
  ab: Record<OutcomeCell, number>;
  ba: Record<OutcomeCell, number>;
} {
  const toCounts = (probs: [number, number, number, number], n: number): Record<OutcomeCell, number> => {
    const out: Record<OutcomeCell, number> = { AyBy: 0, AyBn: 0, AnBy: 0, AnBn: 0 };
    const counts = exactCounts(probs, n);
    OUTCOME_CELLS.forEach((cell, i) => (out[cell] = counts[i]));
    return out;
  };
  return { ab: toCounts(d.probsAB, d.nAB), ba: toCounts(d.probsBA, d.nBA) };
}

/** Outcome definitions for a dataset: four joint cells, priors from pooled frequencies. */
export function outcomesOf(d: CorpusDataset): Outcome[] {
  const counts = datasetCounts(d);
  const total = d.nAB + d.nBA;
  const pooled: Record<OutcomeCell, number> = { AyBy: 0, AyBn: 0, AnBy: 0, AnBn: 0 };
  for (const cell of OUTCOME_CELLS) pooled[cell] = (counts.ab[cell] + counts.ba[cell]) / total;
  return OUTCOME_CELLS.map((cell) => ({
    id: cell,
    label: cell,
    utility: 0,
    priorProbability: pooled[cell],
  }));
}

/**
 * Evidence items: E_A favors "Ay" cells, E_B favors "By" cells.
 * `support` is the likelihood placed on the favored cells (default 0.9, the
 * value used throughout the main analysis); `1 - support` is placed on the
 * disfavored cells. Parameterized so the evidence geometry can be varied for
 * the sensitivity analysis (Section III-D2) without duplicating this function.
 */
export function evidenceOf(d: CorpusDataset, support = 0.9): { eA: EvidenceItem; eB: EvidenceItem } {
  const hi = support;
  const lo = 1 - support;
  const eA: EvidenceItem = {
    id: 'qa',
    name: 'Question A asked',
    value: d.questionA,
    confidence: 1,
    context: 'Question order',
    sequence: 1,
    likelihood: { AyBy: hi, AyBn: hi, AnBy: lo, AnBn: lo },
  };
  const eB: EvidenceItem = {
    id: 'qb',
    name: 'Question B asked',
    value: d.questionB,
    confidence: 1,
    context: 'Question order',
    sequence: 2,
    likelihood: { AyBy: hi, AyBn: lo, AnBy: hi, AnBn: lo },
  };
  return { eA, eB };
}

function multinomialNll(predicted: Record<string, number>, observed: Record<string, number>): number {
  return conditionNll(predicted, observed);
}

function makeFamilyFit(
  k: number,
  nll: number,
  total: number,
  predictions: Record<'AB' | 'BA', Record<OutcomeCell, number>>,
): FamilyFit {
  return {
    k,
    nll: round(nll, 6),
    aic: round(2 * k + 2 * nll, 6),
    bic: round(k * Math.log(Math.max(1, total)) + 2 * nll, 6),
    predictions,
  };
}

/** Classical marginal: independent marginals, order-invariant, k = 2. */
function fitClassicalMarginal(d: CorpusDataset, counts: ReturnType<typeof datasetCounts>): FamilyFit {
  const total = d.nAB + d.nBA;
  // "Ay" responses: A asked first (AyBy+AyBn in AB) or second (ByAy+BnAy in BA).
  const countAy = counts.ab.AyBy + counts.ab.AyBn + counts.ba.AyBy + counts.ba.AnBy;
  // "By" responses: B asked second (AyBy+AnBy in AB) or first (ByAy+ByAn in BA).
  const countBy = counts.ab.AyBy + counts.ab.AnBy + counts.ba.AyBy + counts.ba.AyBn;
  const pAy = countAy / total;
  const pBy = countBy / total;
  const pred: Record<OutcomeCell, number> = {
    AyBy: pAy * pBy,
    AyBn: pAy * (1 - pBy),
    AnBy: (1 - pAy) * pBy,
    AnBn: (1 - pAy) * (1 - pBy),
  };
  const nll =
    multinomialNll(pred, counts.ab) + multinomialNll(pred, counts.ba);
  return makeFamilyFit(2, nll, total, { AB: { ...pred }, BA: { ...pred } });
}

/** Classical pooled: joint multinomial from pooled frequencies, order-invariant, k = 3. */
function fitClassicalPooled(d: CorpusDataset, counts: ReturnType<typeof datasetCounts>): FamilyFit {
  const total = d.nAB + d.nBA;
  const pred: Record<OutcomeCell, number> = {
    AyBy: (counts.ab.AyBy + counts.ba.AyBy) / total,
    AyBn: (counts.ab.AyBn + counts.ba.AyBn) / total,
    AnBy: (counts.ab.AnBy + counts.ba.AnBy) / total,
    AnBn: (counts.ab.AnBn + counts.ba.AnBn) / total,
  };
  const nll =
    multinomialNll(pred, counts.ab) + multinomialNll(pred, counts.ba);
  return makeFamilyFit(3, nll, total, { AB: { ...pred }, BA: { ...pred } });
}

/** Bayesian: Dirichlet(1,1,1,1) posterior predictive over the pooled joint cells, k = 3. */
function fitBayesian(d: CorpusDataset, counts: ReturnType<typeof datasetCounts>): FamilyFit {
  const total = d.nAB + d.nBA;
  const pred: Record<OutcomeCell, number> = {
    AyBy: (1 + counts.ab.AyBy + counts.ba.AyBy) / (total + 4),
    AyBn: (1 + counts.ab.AyBn + counts.ba.AyBn) / (total + 4),
    AnBy: (1 + counts.ab.AnBy + counts.ba.AnBy) / (total + 4),
    AnBn: (1 + counts.ab.AnBn + counts.ba.AnBn) / (total + 4),
  };
  const nll =
    multinomialNll(pred, counts.ab) + multinomialNll(pred, counts.ba);
  return makeFamilyFit(3, nll, total, { AB: { ...pred }, BA: { ...pred } });
}

/** Deterministic 1-D search: coarse grid over [-0.5, 0.5] then step-halving refinement. */
function searchTau(nllOfTau: (tau: number) => number): number {
  let bestTau = 0;
  let bestVal = nllOfTau(0);
  for (let i = -500; i <= 500; i++) {
    const tau = i / 1000;
    const v = nllOfTau(tau);
    if (v < bestVal) {
      bestVal = v;
      bestTau = tau;
    }
  }
  let step = 0.001;
  for (let iter = 0; iter < 20; iter++) {
    step /= 2;
    for (const dir of [1, -1]) {
      const trial = bestTau + dir * step;
      const v = nllOfTau(trial);
      if (v < bestVal - 1e-12) {
        bestVal = v;
        bestTau = trial;
      }
    }
  }
  return bestTau;
}

/**
 * Classical anchor-and-adjustment: order-sensitive, aggregate-level, k = 2.
 * Base conditional response rates are the pooled joint's implied
 * conditionals (the same order-invariant information given to
 * classical-pooled / bayesian / quantum, not separately fitted). One
 * assimilation parameter per order (tauAB, tauBA) shifts the conditional
 * response to the SECOND-asked question toward (tau > 0) or away from
 * (tau < 0) consistency with the FIRST-asked answer:
 *   p(2nd=y | 1st=y) = base + tau,   p(2nd=y | 1st=n) = base − tau.
 * This operationalizes the anchoring-and-adjustment heuristic (Tversky &
 * Kahneman, 1974) as a purely classical, non-quantum mechanism for order
 * effects, directly testing the general claim of Kellen, Singmann &
 * Batchelder (2018) that classical accounts can reproduce mirrored
 * order-effect patterns without quantum assumptions. Because tau ranges
 * over both signs, this single mechanism can express BOTH diagonal-shift
 * ("assimilation") and off-diagonal-swap ("contrast") order effects —
 * unlike the quantum-inspired model's rotation geometry (Section III-D).
 * k = 2 exactly matches the quantum-inspired model's free-parameter count,
 * making this the fairest available complexity-matched, order-sensitive
 * classical comparator (fitted by the same maximum-likelihood criterion,
 * independently per order since tauAB affects only the AB likelihood and
 * tauBA only the BA likelihood).
 */
function fitClassicalAnchor(
  d: CorpusDataset,
  counts: ReturnType<typeof datasetCounts>,
): FamilyFit & { tauAB: number; tauBA: number } {
  const total = d.nAB + d.nBA;
  const pooled: Record<OutcomeCell, number> = {
    AyBy: (counts.ab.AyBy + counts.ba.AyBy) / total,
    AyBn: (counts.ab.AyBn + counts.ba.AyBn) / total,
    AnBy: (counts.ab.AnBy + counts.ba.AnBy) / total,
    AnBn: (counts.ab.AnBn + counts.ba.AnBn) / total,
  };
  const pAy = pooled.AyBy + pooled.AyBn;
  const pAn = Math.max(1e-9, 1 - pAy);
  const pBy = pooled.AyBy + pooled.AnBy;
  const pBn = Math.max(1e-9, 1 - pBy);
  const baseByGivenAy = pAy > 1e-9 ? pooled.AyBy / pAy : 0.5;
  const baseByGivenAn = pAn > 1e-9 ? pooled.AnBy / pAn : 0.5;
  const baseAyGivenBy = pBy > 1e-9 ? pooled.AyBy / pBy : 0.5;
  const baseAyGivenBn = pBn > 1e-9 ? pooled.AyBn / pBn : 0.5;

  const predAtTauAB = (tau: number): Record<OutcomeCell, number> => {
    const pByAy = clamp(baseByGivenAy + tau, 0, 1);
    const pByAn = clamp(baseByGivenAn - tau, 0, 1);
    return {
      AyBy: pAy * pByAy,
      AyBn: pAy * (1 - pByAy),
      AnBy: pAn * pByAn,
      AnBn: pAn * (1 - pByAn),
    };
  };
  const predAtTauBA = (tau: number): Record<OutcomeCell, number> => {
    const pAyBy = clamp(baseAyGivenBy + tau, 0, 1);
    const pAyBn = clamp(baseAyGivenBn - tau, 0, 1);
    return {
      AyBy: pBy * pAyBy,
      AnBy: pBy * (1 - pAyBy),
      AyBn: pBn * pAyBn,
      AnBn: pBn * (1 - pAyBn),
    };
  };

  const tauAB = searchTau((tau) => multinomialNll(predAtTauAB(tau), counts.ab));
  const tauBA = searchTau((tau) => multinomialNll(predAtTauBA(tau), counts.ba));
  const predAB = predAtTauAB(tauAB);
  const predBA = predAtTauBA(tauBA);
  const nll = multinomialNll(predAB, counts.ab) + multinomialNll(predBA, counts.ba);
  const base = makeFamilyFit(2, nll, total, { AB: predAB, BA: predBA });
  return { ...base, tauAB: round(tauAB, 6), tauBA: round(tauBA, 6) };
}

/** Saturated: separate multinomial per order, k = 6 (reference, not a candidate). */
function fitSaturated(d: CorpusDataset, counts: ReturnType<typeof datasetCounts>): FamilyFit {
  const predAB: Record<OutcomeCell, number> = { AyBy: 0, AyBn: 0, AnBy: 0, AnBn: 0 };
  const predBA: Record<OutcomeCell, number> = { AyBy: 0, AyBn: 0, AnBy: 0, AnBn: 0 };
  OUTCOME_CELLS.forEach((cell) => {
    predAB[cell] = counts.ab[cell] / d.nAB;
    predBA[cell] = counts.ba[cell] / d.nBA;
  });
  const nll = multinomialNll(predAB, counts.ab) + multinomialNll(predBA, counts.ba);
  return makeFamilyFit(6, nll, d.nAB + d.nBA, { AB: predAB, BA: predBA });
}

/** Quantum: fitted {contextStrength, rotationStrength}, order-sensitive, k = 2. */
function fitQuantum(
  d: CorpusDataset,
  counts: ReturnType<typeof datasetCounts>,
  options: CorpusBenchmarkOptions,
): DatasetBenchmark['models']['quantum'] {
  // Initial amplitudes use the pooled joint frequencies — the same
  // order-invariant information as classical-pooled.
  const outcomes = outcomesOf(d);
  const { eA, eB } = evidenceOf(d, options.support ?? 0.9);
  const conditions: FitConditionInput[] = [
    { id: 'AB', outcomes, evidence: [eA, eB], trials: d.nAB, observed: counts.ab },
    { id: 'BA', outcomes, evidence: [eB, eA], trials: d.nBA, observed: counts.ba },
  ];
  const fit: FitResult = fitQuantumToData(conditions, {
    seed: options.seed ?? 42,
    restarts: options.restarts ?? 12,
    tolerance: options.tolerance ?? 1e-6,
    contextTransformation: 'unitary-mix',
    interferenceMode: 'on',
    amplitudeInit: 'sqrt-prior',
  });
  const predictions: Record<'AB' | 'BA', Record<OutcomeCell, number>> = {
    AB: fit.predictions.AB as Record<OutcomeCell, number>,
    BA: fit.predictions.BA as Record<OutcomeCell, number>,
  };
  const base = makeFamilyFit(fit.nParams, fit.nll, d.nAB + d.nBA, predictions);
  return {
    ...base,
    contextStrength: round(fit.contextStrength, 6),
    rotationStrength: round(fit.rotationStrength, 6),
    converged: fit.converged,
  };
}

function qqValue(d: CorpusDataset): number {
  return d.probsAB[0] - d.probsBA[0] + d.probsAB[3] - d.probsBA[3];
}

function orderDistance(d: CorpusDataset): number {
  let acc = 0;
  for (let i = 0; i < 4; i++) acc += Math.abs(d.probsAB[i] - d.probsBA[i]);
  return acc / 2;
}

/** Run the corpus benchmark (deterministic for a fixed seed). */
export function runCorpusBenchmark(options: CorpusBenchmarkOptions = {}): CorpusBenchmarkResult {
  const datasets: DatasetBenchmark[] = CORPUS_DATASETS.map((d) => {
    const counts = datasetCounts(d);
    const classicalMarginal = fitClassicalMarginal(d, counts);
    const classicalPooled = fitClassicalPooled(d, counts);
    const bayesian = fitBayesian(d, counts);
    const classicalAnchor = fitClassicalAnchor(d, counts);
    const quantum = fitQuantum(d, counts, options);
    const saturated = fitSaturated(d, counts);

    const aicCandidates = {
      'classical-marginal': classicalMarginal.aic,
      'classical-pooled': classicalPooled.aic,
      bayesian: bayesian.aic,
      'classical-anchor': classicalAnchor.aic,
      quantum: quantum.aic,
    };
    const aicWinner = (Object.keys(aicCandidates) as ModelFamilyId[]).reduce((best, key) =>
      aicCandidates[key] < aicCandidates[best] ? key : best,
    );
    const bicCandidates = {
      'classical-marginal': classicalMarginal.bic,
      'classical-pooled': classicalPooled.bic,
      bayesian: bayesian.bic,
      'classical-anchor': classicalAnchor.bic,
      quantum: quantum.bic,
    };
    const bicWinner = (Object.keys(bicCandidates) as ModelFamilyId[]).reduce((best, key) =>
      bicCandidates[key] < bicCandidates[best] ? key : best,
    );

    return {
      datasetId: d.id,
      label: d.label,
      nAB: d.nAB,
      nBA: d.nBA,
      total: d.nAB + d.nBA,
      qqValue: round(qqValue(d), 6),
      orderDistance: round(orderDistance(d), 6),
      models: {
        'classical-marginal': classicalMarginal,
        'classical-pooled': classicalPooled,
        bayesian,
        'classical-anchor': classicalAnchor,
        quantum,
        saturated,
      },
      aicWinner,
      bicWinner,
      advantageClass:
        Math.abs(quantum.contextStrength) + Math.abs(quantum.rotationStrength) > 1e-6 ? 'detected' : 'null',
      deltaAicQuantumVsPooled: round(quantum.aic - classicalPooled.aic, 6),
      deltaBicQuantumVsPooled: round(quantum.bic - classicalPooled.bic, 6),
      deltaAicQuantumVsSaturated: round(quantum.aic - saturated.aic, 6),
      deltaAicQuantumVsAnchor: round(quantum.aic - classicalAnchor.aic, 6),
    };
  });

  const wins: CorpusBenchmarkResult['summary']['wins'] = {
    'classical-marginal': 0,
    'classical-pooled': 0,
    bayesian: 0,
    'classical-anchor': 0,
    quantum: 0,
  };
  const bicWins: CorpusBenchmarkResult['summary']['bicWins'] = {
    'classical-marginal': 0,
    'classical-pooled': 0,
    bayesian: 0,
    'classical-anchor': 0,
    quantum: 0,
  };
  let deltaPooled = 0;
  let deltaSaturated = 0;
  let deltaAnchor = 0;
  let betterPooled = 0;
  let betterSaturated = 0;
  let betterAnchor = 0;
  let advantageDetected = 0;
  for (const d of datasets) {
    wins[d.aicWinner]++;
    bicWins[d.bicWinner]++;
    deltaPooled += d.deltaAicQuantumVsPooled;
    deltaSaturated += d.deltaAicQuantumVsSaturated;
    deltaAnchor += d.deltaAicQuantumVsAnchor;
    if (d.deltaAicQuantumVsPooled < 0) betterPooled++;
    if (d.deltaAicQuantumVsSaturated < 0) betterSaturated++;
    if (d.deltaAicQuantumVsAnchor < 0) betterAnchor++;
    if (d.advantageClass === 'detected') advantageDetected++;
  }
  const n = datasets.length;

  return {
    version: 'corpus-v1',
    seed: options.seed ?? 42,
    datasets,
    summary: {
      nDatasets: n,
      wins,
      bicWins,
      meanDeltaAicQuantumVsPooled: round(deltaPooled / n, 6),
      meanDeltaAicQuantumVsSaturated: round(deltaSaturated / n, 6),
      meanDeltaAicQuantumVsAnchor: round(deltaAnchor / n, 6),
      quantumBetterThanPooled: betterPooled,
      quantumBetterThanSaturated: betterSaturated,
      quantumBetterThanAnchor: betterAnchor,
      advantageDetected,
      advantageNull: n - advantageDetected,
    },
  };
}

/** Write the benchmark result as a JSON artifact (for the manuscript workflow). */
export function writeCorpusBenchmark(result: CorpusBenchmarkResult, filePath: string): string {
  const abs = path.resolve(filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return abs;
}

/**
 * Leave-one-order-out (LOO) cross-validation.
 *
 * Addresses the in-sample-only limitation of the main benchmark: every
 * family here is fit using ONLY one condition's data (e.g. AB) and then
 * scored on the OTHER condition's observed counts (BA), which it never
 * saw during fitting — genuine out-of-sample evaluation, not a refit.
 * Repeated in both directions (train on AB / test on BA, and train on BA
 * / test on AB) and summed, exactly mirroring how the main benchmark sums
 * NLL over both conditions in-sample.
 *
 * classical-anchor is deliberately excluded: its two parameters (tauAB,
 * tauBA) are already order-specific by construction (each fit only from
 * its own condition's counts, never shared across orders), so there is no
 * cross-order generalization claim to test — holding out BA does not
 * change what tauAB is fit from. Including it would not be a meaningful
 * comparison to the other families' genuine train/test split.
 *
 * Outcome priors for the quantum family are built from the TRAINING
 * condition's own counts only (outcomesFromCounts), not the pooled
 * frequencies used in the main benchmark, to avoid leaking any
 * information from the held-out condition into the fit.
 */
export type LooFamilyId = 'classical-marginal' | 'classical-pooled' | 'bayesian' | 'quantum';

export interface LooDatasetResult {
  datasetId: string;
  /** Out-of-sample NLL per family, summed over both held-out directions. */
  oosNll: Record<LooFamilyId, number>;
  oosWinner: LooFamilyId;
  /** In-sample NLL per family (from the main benchmark) for direct comparison. */
  inSampleNll: Record<LooFamilyId, number>;
  quantumParams: { trainedOnAB: [number, number]; trainedOnBA: [number, number] };
}

export interface LooResult {
  seed: number;
  datasets: LooDatasetResult[];
  summary: {
    nDatasets: number;
    oosWins: Record<LooFamilyId, number>;
    quantumOosBetterThanPooled: number;
  };
}

function outcomesFromCounts(counts: Record<OutcomeCell, number>, total: number): Outcome[] {
  return OUTCOME_CELLS.map((cell) => ({
    id: cell,
    label: cell,
    utility: 0,
    priorProbability: total > 0 ? counts[cell] / total : 0.25,
  }));
}

/** Fit classical-marginal from one condition's counts only; return its predicted joint cells. */
function marginalFromCounts(counts: Record<OutcomeCell, number>, total: number): Record<OutcomeCell, number> {
  const pAy = (counts.AyBy + counts.AyBn) / total;
  const pBy = (counts.AyBy + counts.AnBy) / total;
  return {
    AyBy: pAy * pBy,
    AyBn: pAy * (1 - pBy),
    AnBy: (1 - pAy) * pBy,
    AnBn: (1 - pAy) * (1 - pBy),
  };
}

/** Fit classical-pooled (joint MLE) from one condition's counts only. */
function pooledFromCounts(counts: Record<OutcomeCell, number>, total: number): Record<OutcomeCell, number> {
  const out: Record<OutcomeCell, number> = { AyBy: 0, AyBn: 0, AnBy: 0, AnBn: 0 };
  OUTCOME_CELLS.forEach((cell) => (out[cell] = counts[cell] / total));
  return out;
}

/** Fit bayesian (Dirichlet(1,1,1,1) posterior mean) from one condition's counts only. */
function bayesianFromCounts(counts: Record<OutcomeCell, number>, total: number): Record<OutcomeCell, number> {
  const out: Record<OutcomeCell, number> = { AyBy: 0, AyBn: 0, AnBy: 0, AnBn: 0 };
  OUTCOME_CELLS.forEach((cell) => (out[cell] = (1 + counts[cell]) / (total + 4)));
  return out;
}

/** One held-out direction: fit every family on `train`, score on `test`. */
function looDirection(
  d: CorpusDataset,
  trainCounts: Record<OutcomeCell, number>,
  trainTotal: number,
  trainLabel: 'AB' | 'BA',
  testCounts: Record<OutcomeCell, number>,
  testTotal: number,
  options: CorpusBenchmarkOptions,
): { nll: Record<LooFamilyId, number>; quantumParams: [number, number] } {
  const marginalPred = marginalFromCounts(trainCounts, trainTotal);
  const pooledPred = pooledFromCounts(trainCounts, trainTotal);
  const bayesianPred = bayesianFromCounts(trainCounts, trainTotal);

  const { eA, eB } = evidenceOf(d, options.support ?? 0.9);
  const outcomes = outcomesFromCounts(trainCounts, trainTotal);
  const trainEvidence = trainLabel === 'AB' ? [eA, eB] : [eB, eA];
  const testEvidence = trainLabel === 'AB' ? [eB, eA] : [eA, eB];
  const trainCondition: FitConditionInput = {
    id: trainLabel,
    outcomes,
    evidence: trainEvidence,
    trials: trainTotal,
    observed: trainCounts,
  };
  const fit = fitQuantumToData([trainCondition], {
    seed: options.seed ?? 42,
    restarts: options.restarts ?? 12,
    tolerance: options.tolerance ?? 1e-6,
    contextTransformation: 'unitary-mix',
    interferenceMode: 'on',
    amplitudeInit: 'sqrt-prior',
  });
  const testLabel = trainLabel === 'AB' ? 'BA' : 'AB';
  const testCondition: FitConditionInput = {
    id: testLabel,
    outcomes,
    evidence: testEvidence,
    trials: testTotal,
    observed: testCounts,
  };
  const quantumOos = quantumNll(fit.contextStrength, fit.rotationStrength, [testCondition], {
    contextTransformation: 'unitary-mix',
    interferenceMode: 'on',
    amplitudeInit: 'sqrt-prior',
  });

  return {
    nll: {
      'classical-marginal': multinomialNll(marginalPred, testCounts),
      'classical-pooled': multinomialNll(pooledPred, testCounts),
      bayesian: multinomialNll(bayesianPred, testCounts),
      quantum: quantumOos.nll,
    },
    quantumParams: [round(fit.contextStrength, 6), round(fit.rotationStrength, 6)],
  };
}

/** Run leave-one-order-out cross-validation across all six datasets. */
export function runLeaveOneOrderOut(options: CorpusBenchmarkOptions = {}): LooResult {
  const inSample = runCorpusBenchmark(options);
  const inSampleById = new Map(inSample.datasets.map((d) => [d.datasetId, d]));

  const datasets: LooDatasetResult[] = CORPUS_DATASETS.map((d) => {
    const counts = datasetCounts(d);
    const abToBa = looDirection(d, counts.ab, d.nAB, 'AB', counts.ba, d.nBA, options);
    const baToAb = looDirection(d, counts.ba, d.nBA, 'BA', counts.ab, d.nAB, options);

    const oosNll: Record<LooFamilyId, number> = {
      'classical-marginal': round(abToBa.nll['classical-marginal'] + baToAb.nll['classical-marginal'], 6),
      'classical-pooled': round(abToBa.nll['classical-pooled'] + baToAb.nll['classical-pooled'], 6),
      bayesian: round(abToBa.nll.bayesian + baToAb.nll.bayesian, 6),
      quantum: round(abToBa.nll.quantum + baToAb.nll.quantum, 6),
    };
    const oosWinner = (Object.keys(oosNll) as LooFamilyId[]).reduce((best, key) =>
      oosNll[key] < oosNll[best] ? key : best,
    );

    const inRow = inSampleById.get(d.id)!;
    const inSampleNll: Record<LooFamilyId, number> = {
      'classical-marginal': inRow.models['classical-marginal'].nll,
      'classical-pooled': inRow.models['classical-pooled'].nll,
      bayesian: inRow.models.bayesian.nll,
      quantum: inRow.models.quantum.nll,
    };

    return {
      datasetId: d.id,
      oosNll,
      oosWinner,
      inSampleNll,
      quantumParams: { trainedOnAB: abToBa.quantumParams, trainedOnBA: baToAb.quantumParams },
    };
  });

  const oosWins: Record<LooFamilyId, number> = {
    'classical-marginal': 0,
    'classical-pooled': 0,
    bayesian: 0,
    quantum: 0,
  };
  let quantumOosBetterThanPooled = 0;
  for (const d of datasets) {
    oosWins[d.oosWinner]++;
    if (d.oosNll.quantum < d.oosNll['classical-pooled']) quantumOosBetterThanPooled++;
  }

  return {
    seed: options.seed ?? 42,
    datasets,
    summary: {
      nDatasets: datasets.length,
      oosWins,
      quantumOosBetterThanPooled,
    },
  };
}