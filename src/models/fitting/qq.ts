/**
 * Quantum Question Order (QQ) model engine.
 *
 * Reimplements the analysis of Wang & Busemeyer (2013, Top. Cogn. Sci.
 * 5:689-710) and validates it against the six published question-order
 * datasets (Table 1): Clint-Gore (consistency), Gingrich-Dole (contrast),
 * White-Black racial hostility (additive), Rose-Jackson (subtractive,
 * predicted to FAIL the QQ test), plus two laboratory replications
 * (racial hostility, affirmative action).
 *
 * The QQ model: a person's belief is a unit vector |ψ⟩ in a Hilbert space;
 * each answer to question A or B is a projector (P_Ay, P_An = I − P_Ay,
 * P_By, P_Bn = I − P_By). The probability of a response sequence is the
 * squared length of the sequential projection, e.g.
 *   p(AyBy) = ‖P_By P_Ay |ψ⟩‖².
 * The model predicts, for ANY dimension, ANY state, and ANY pair of
 * projectors, the parameter-free identity (the QQ equality):
 *   p(AyBy) + p(AnBn) = p(ByAy) + p(BnAn)   ( = cos²θ in a 2D space,
 *                                             with θ the angle between the
 *                                             two "yes" rays ).
 *
 * The similarity index (Eq. 2 in the paper; the row labeled θ in Table 1):
 *   h = Re⟨S_Ay | S_By⟩ = (p(AyBy) − C_B/2) / √(p(Ay)·p(By))
 *                       = (p(ByAy) − C_A/2) / √(p(Ay)·p(By))
 * with C_A = TP(Ay) − p(Ay) and C_B = TP(By) − p(By) the marginal order
 * effects (Eqs. 1a/1b). In a 2D representation h = cos θ.
 *
 * Tests:
 *   1. q-test (parameter-free): the observed difference
 *        q = [P̂(ByAy)+P̂(BnAn)] − [P̂(AyBy)+P̂(AnBn)]
 *      with sampling SE from the two multinomials, z = q/SE, χ² = z² (1 df).
 *   2. Constrained-model likelihood-ratio test: fit the 8 cells by maximum
 *      likelihood subject to the QQ equality (5 free parameters vs 6 for the
 *      unconstrained multinomial) and compare with the saturated model via
 *      2·ΔLL, which is χ²(1) distributed. This reproduces the published
 *      χ² values (e.g. 28.57 for Rose-Jackson, which the model fails).
 *
 * Baselines / comparison:
 *   - Markov (unconstrained multinomial): 6 free parameters, always fits.
 *   - Constrained quantum model: 5 free parameters.
 *   BIC (multinomial likelihood) compares the two; a significant q or
 *   likelihood-ratio test rejects the quantum constraint.
 *
 * NOTE: a fixed 2D rotation model (2 parameters) cannot reproduce the
 * empirical marginals (p(By) must lie between p(Ay) and 1−p(Ay) in the AB
 * order, which the survey data violate); the published fits therefore use
 * the general N-dimensional model with the QQ-equality constraint above.
 *
 * All fits are deterministic for a given seed.
 */

import { minimize } from './optimize';
import { clamp, round } from '../../utils';

export interface QQDatasetInput {
  id: string;
  name: string;
  type: string;
  source: string;
  questionA: string;
  questionB: string;
  /** N for the AB (A→B) order group. */
  nAB: number;
  /** Cells [P(AyBy), P(AyBn), P(AnBy), P(AnBn)]. */
  abCells: [number, number, number, number];
  /** N for the BA (B→A) order group. */
  nBA: number;
  /** Cells [P(ByAy), P(ByAn), P(BnAy), P(BnAn)]. */
  baCells: [number, number, number, number];
}

export interface QQTestResult {
  q: number;
  se: number;
  z: number;
  chiSquare: number;
  significant: boolean;
  pValue: number;
}

export interface QQModelResult {
  modelId: 'quantum-qq' | 'markov-qq';
  label: string;
  params: Record<string, number>;
  nParams: number;
  /** Likelihood-ratio χ² vs the saturated model (quantum: 1 df; markov: 0). */
  chiSquare: number;
  df: number;
  pValue: number;
  nll: number;
  bic: number;
  abCells: [number, number, number, number];
  baCells: [number, number, number, number];
}

export interface QQFitOutput {
  dataset: QQDatasetInput;
  orderEffect: { ca: number; cb: number };
  similarity: { h1: number; h2: number; h: number; theta: number };
  qqTest: QQTestResult;
  models: QQModelResult[];
  bestByBic: string;
  conclusion: string;
  notes: string[];
}

/** Marginal order effects C_A, C_B (Eqs. 1a/1b) from the observed cells.
 * Note: p(Ay) and TP(By) come from the AB-order group; p(By) and TP(Ay)
 * come from the BA-order group ("comparative context" = asked second). */
export function orderEffects(dataset: QQDatasetInput): { ca: number; cb: number } {
  const { abCells, baCells } = dataset;
  const pAy = abCells[0] + abCells[1];
  const tpBy = abCells[0] + abCells[2];
  const pBy = baCells[0] + baCells[1];
  const tpAy = baCells[0] + baCells[2];
  return { ca: tpAy - pAy, cb: tpBy - pBy };
}

/**
 * Similarity index h = Re⟨S_Ay | S_By⟩ (Eq. 2), estimated two ways plus the
 * average; θ = acos(h) is the implied rotation angle in a 2D representation.
 */
export function similarityIndex(dataset: QQDatasetInput): { h1: number; h2: number; h: number; theta: number } {
  const { abCells, baCells } = dataset;
  const pAy = abCells[0] + abCells[1];
  const pBy = baCells[0] + baCells[1];
  const root = Math.sqrt(Math.max(pAy * pBy, 1e-12));
  const { ca, cb } = orderEffects(dataset);
  const h1 = (abCells[0] - cb / 2) / root;
  const h2 = (baCells[0] - ca / 2) / root;
  const h = (h1 + h2) / 2;
  const theta = Math.acos(Math.max(-1, Math.min(1, h)));
  return { h1, h2, h, theta };
}

/** QQ equality test: q, SE, z, χ², p (parameter-free). */
export function qqEqualityTest(dataset: QQDatasetInput): QQTestResult {
  const { abCells, baCells, nAB, nBA } = dataset;
  const pAB = abCells[0] + abCells[3];
  const pBA = baCells[0] + baCells[3];
  const q = pBA - pAB;
  const varAB = (pAB - pAB * pAB) / nAB;
  const varBA = (pBA - pBA * pBA) / nBA;
  const se = Math.sqrt(varAB + varBA);
  const z = q / Math.max(se, 1e-12);
  const chiSquare = z * z;
  const significant = chiSquare > 3.8414588;
  const pValue = Math.exp(-chiSquare / 2);
  return { q, se, z, chiSquare, significant, pValue };
}

/** Multinomial negative log-likelihood of the observed counts. */
function nllOf(cells: number[], expected: number[], n: number[]): number {
  let acc = 0;
  for (let i = 0; i < 8; i++) {
    const p = clamp(expected[i], 1e-12, 1 - 1e-12);
    acc -= cells[i] * n[i] * Math.log(p);
  }
  return acc;
}

/**
 * Fit the 8 cells by MLE subject to the QQ-equality constraint
 * p(AyBn)+p(AnBy) = p(ByAn)+p(BnAy) (equivalent to the equality above).
 * Free parameters: 5 (the constraint leaves 1 df less than the saturated
 * multinomial). Returns the constrained cells and the likelihood-ratio
 * χ²(1) against the saturated model.
 */
export function fitQQModel(
  dataset: QQDatasetInput,
  options: { seed?: number } = {},
): QQModelResult {
  const cells = [...dataset.abCells, ...dataset.baCells];
  const n = [dataset.nAB, dataset.nAB, dataset.nAB, dataset.nAB, dataset.nBA, dataset.nBA, dataset.nBA, dataset.nBA];

  const feasible = (x: number[]): number[] | null => {
    const a = x[0]; // p(AyBy)
    const b = x[1]; // p(AyBn)
    const c = x[2]; // p(AnBy)
    const d = x[3]; // p(ByAy)
    const e = x[4]; // p(ByAn)
    const pAnBn = 1 - a - b - c;
    const pBnAy = b + c - e;
    const pBnAn = 1 - d - e - pBnAy;
    if (pAnBn < 1e-9 || pBnAy < 1e-9 || pBnAn < 1e-9) return null;
    return [a, b, c, pAnBn, d, e, pBnAy, pBnAn];
  };

  const objective = (x: number[]): number => {
    const pred = feasible(x);
    if (!pred) return 1e9;
    return nllOf(cells, pred, n);
  };

  const fit = minimize(objective, [
    [0.001, 0.999],
    [0.001, 0.999],
    [0.001, 0.999],
    [0.001, 0.999],
    [0.001, 0.999],
  ], { seed: options.seed ?? 42, restarts: 8 });

  const pred = feasible(fit.x) ?? [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25];
  const nll = nllOf(cells, pred, n);
  const nllSat = nllOf(cells, cells, n);
  const lrChi = 2 * Math.max(0, nll - nllSat);
  const totalN = dataset.nAB + dataset.nBA;

  return {
    modelId: 'quantum-qq',
    label: 'Quantum Question Order (Wang & Busemeyer 2013)',
    params: { pAyBy: round(pred[0], 6), pAyBn: round(pred[1], 6), pAnBy: round(pred[2], 6), pByAy: round(pred[4], 6), pByAn: round(pred[5], 6) },
    nParams: 5,
    chiSquare: lrChi,
    df: 1,
    pValue: Math.exp(-lrChi / 2),
    nll,
    bic: 5 * Math.log(totalN) + 2 * nll,
    abCells: [pred[0], pred[1], pred[2], pred[3]],
    baCells: [pred[4], pred[5], pred[6], pred[7]],
  };
}

/** Markov baseline: the unconstrained (saturated) multinomial, 6 params. */
export function fitQQMarkov(
  dataset: QQDatasetInput,
  _options: { seed?: number } = {},
): QQModelResult {
  const cells = [...dataset.abCells, ...dataset.baCells];
  const n = [dataset.nAB, dataset.nAB, dataset.nAB, dataset.nAB, dataset.nBA, dataset.nBA, dataset.nBA, dataset.nBA];
  const nll = nllOf(cells, cells, n);
  const totalN = dataset.nAB + dataset.nBA;
  return {
    modelId: 'markov-qq',
    label: 'Markov / classical (unconstrained multinomial)',
    params: { a1: round(dataset.abCells[0] + dataset.abCells[1], 6), a2: round(dataset.baCells[0] + dataset.baCells[1], 6) },
    nParams: 6,
    chiSquare: 0,
    df: 0,
    pValue: 1,
    nll,
    bic: 6 * Math.log(totalN) + 2 * nll,
    abCells: dataset.abCells,
    baCells: dataset.baCells,
  };
}

/** Run the full QQ pipeline for one dataset. */
export function fitQQ(dataset: QQDatasetInput, options: { seed?: number } = {}): QQFitOutput {
  const quantum = fitQQModel(dataset, options);
  const markov = fitQQMarkov(dataset, options);
  const qqTest = qqEqualityTest(dataset);
  const orderEffect = orderEffects(dataset);
  const similarity = similarityIndex(dataset);

  const best = quantum.bic < markov.bic ? quantum : markov;
  const notes = [
    'Wang & Busemeyer (2013) QQ model: sequential projections onto the answer subspaces of the two questions. The QQ equality P(AyBy)+P(AnBn) = P(ByAy)+P(BnAn) holds for any dimension, any state and any projectors; it is the a-priori prediction tested here.',
    `Observed q = P̂(ByAy)+P̂(BnAn) − P̂(AyBy)+P̂(AnBn) = ${round(qqTest.q, 4)} with SE ${round(qqTest.se, 4)}, z = ${round(qqTest.z, 3)} (${qqTest.significant ? 'significant at 5%, rejecting the QQ equality' : 'not significant, consistent with the QQ equality'}).`,
    `Likelihood-ratio test of the constrained quantum model vs the saturated multinomial: χ²(1) = ${round(quantum.chiSquare, 3)} (${quantum.chiSquare > 3.8414588 ? 'significant — the quantum constraint is rejected' : 'not significant — the quantum constraint is not rejected'}).`,
    `Similarity index h = Re⟨S_Ay|S_By⟩ = ${round(similarity.h, 4)} (implied 2D rotation angle θ = ${round(similarity.theta, 4)} rad = ${round((similarity.theta * 180) / Math.PI, 1)}°).`,
    `Order effects: C_A = ${round(orderEffect.ca, 4)}, C_B = ${round(orderEffect.cb, 4)}.`,
    `The Markov (saturated multinomial) model always fits exactly with ${markov.nParams} free parameters; the quantum constraint uses ${quantum.nParams}. BIC favors the model with the smaller value.`,
    'A rejected QQ equality indicates that the sequential-projection model cannot account for the observed order structure (e.g. Rose & Jackson, a subtractive order effect).',
  ];

  const conclusion = qqTest.significant
    ? `The observed difference q = ${round(qqTest.q, 4)} is statistically significant (z = ${round(qqTest.z, 2)}, χ²(1) = ${round(qqTest.chiSquare, 2)}): the data violate the QQ equality and the sequential-projection quantum model cannot account for this order structure.`
    : `The observed order effect is consistent with the QQ equality (z = ${round(qqTest.z, 2)}, χ²(1) = ${round(qqTest.chiSquare, 2)}): the sequential-projection quantum model accounts for the order structure with one fewer parameter than the Markov baseline.`;

  return {
    dataset,
    orderEffect,
    similarity,
    qqTest,
    models: [quantum, markov].sort((a, b) => a.bic - b.bic),
    bestByBic: best.modelId,
    conclusion,
    notes,
  };
}
