import type { EvidenceItem, ModelRunResult, Outcome, QuantumConfig } from '../../types';
import { round } from '../../utils';
import {
  decisionOf,
  expectedUtilityOf,
  likelihoodMatrix,
  makeResult,
  outcomeIds,
  priorsFrom,
  step,
} from '../shared';

/**
 * Quantum-Inspired model — a classical numerical simulation of
 * quantum-probability formalism. It does NOT run on a quantum computer.
 *
 * Formalism:
 *   |ψ⟩ = Σᵢ αᵢ|i⟩,   Σᵢ|αᵢ|² = 1,   P(i) = |αᵢ|²   (Born rule)
 *
 * 1. Amplitude initialization:
 *      αᵢ = √P(Hᵢ)  (sqrt-prior)  or  αᵢ = 1/√N  (uniform)
 *
 * 2. Context transformation (per evidence, when enabled):
 *      Each evidence defines a context state |cⱼ⟩ = Σᵢ ĉᵢⱼ|i⟩ where
 *      ĉᵢⱼ = P(Eⱼ|Hᵢ) / √(Σₖ P(Eⱼ|Hₖ)²) is the normalized support vector.
 *      The unitary U_ctx = e^{iλ|cⱼ⟩⟨cⱼ|} applies a phase λ on the
 *      component of |ψ⟩ along |cⱼ⟩:
 *        |ψ⟩ → |ψ⟩ + (e^{iλ} − 1)⟨cⱼ|ψ⟩|cⱼ⟩
 *      with λ = (π/4)·contextStrength·confidenceⱼ.
 *      Phase shifts alone do not change measurement probabilities —
 *      they become observable through interference with later rotations.
 *
 * 3. Evidence rotation (per evidence):
 *      The pair (i*, k*) with the largest likelihood contrast
 *      |P(Eⱼ|Hᵢ*) − P(Eⱼ|Hₖ*)| is rotated by a Givens rotation:
 *        θⱼ = (π/4) · rotationStrength · |(Lᵢ* − Lₖ*)/(Lᵢ* + Lₖ*)| · confidenceⱼ
 *        αᵢ*' = cosθ·αᵢ* + sinθ·αₖ*
 *        αₖ*' = −sinθ·αᵢ* + cosθ·αₖ*
 *      rotating amplitude toward the better-supported outcome.
 *
 * 4. Measurement: P(i) = |αᵢ|².
 *
 * Interference: with the total unitary U = Uₙ···U₁,
 *   P_final(i) = |Σₖ Uᵢₖαₖ|² = Σₖ |Uᵢₖ|²P₀(k) + 2Σₖ<ₗ Re(UᵢₖŪᵢₗαₖᾱₗ)
 *   The cross terms are the interference contribution:
 *   interferenceᵢ = P_final(i) − Σₖ |Uᵢₖ|²P₀(k)
 *
 * Order effects: applying the operators in a different order gives
 * different final probabilities (U_AU_B ≠ U_BU_A in general).
 */

interface Complex {
  re: number;
  im: number;
}

const c = (re: number, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const absSq = (a: Complex): number => a.re * a.re + a.im * a.im;
const expI = (theta: number): Complex => ({ re: Math.cos(theta), im: Math.sin(theta) });
const normOf = (state: Complex[]): number => state.reduce((acc, a) => acc + absSq(a), 0);

function cIdentity(n: number): Complex[][] {
  const m: Complex[][] = [];
  for (let i = 0; i < n; i++) {
    m.push([]);
    for (let j = 0; j < n; j++) m[i].push(c(i === j ? 1 : 0));
  }
  return m;
}

function cMulMatVec(m: Complex[][], v: Complex[]): Complex[] {
  return m.map((row) => row.reduce((acc, cell, k) => add(acc, mul(cell, v[k])), c(0)));
}

function cMulMat(a: Complex[][], b: Complex[][]): Complex[][] {
  const n = a.length;
  const out: Complex[][] = [];
  for (let i = 0; i < n; i++) {
    out.push([]);
    for (let j = 0; j < n; j++) {
      let acc = c(0);
      for (let k = 0; k < n; k++) acc = add(acc, mul(a[i][k], b[k][j]));
      out[i].push(acc);
    }
  }
  return out;
}

function phaseContextOp(n: number, support: number[], lambda: number): Complex[][] {
  const phase = sub(expI(lambda), c(1));
  const m = cIdentity(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      m[i][j] = add(m[i][j], mul(c(phase.re, phase.im), c(support[i] * support[j])));
    }
  }
  return m;
}

function rotationOp(n: number, i: number, k: number, theta: number): Complex[][] {
  const m = cIdentity(n);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  m[i][i] = c(cosT);
  m[i][k] = c(sinT);
  m[k][i] = c(-sinT);
  m[k][k] = c(cosT);
  return m;
}

function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((a, b) => a + b * b, 0));
  if (norm <= 1e-12) return values.map(() => 1 / Math.sqrt(values.length));
  return values.map((v) => v / norm);
}

interface QuantumPipelineResult {
  state: Complex[];
  probabilities: Record<string, number>;
  amplitudes: Record<string, Complex>;
  interference: Record<string, number>;
  totalInterference: number;
  ops: Complex[][][];
  traces: Array<{
    label: string;
    amplitudes: Record<string, Complex>;
    probabilities: Record<string, number>;
    contextBefore?: Record<string, number>;
    contextAfter?: Record<string, number>;
  }>;
}

/**
 * Applies the operator to the probability-vector (classical) representation.
 * Used in interference-off mode: the state is dephased after every
 * operation (decoherence between evidence steps), so cross terms never
 * accumulate and interference is zero by construction.
 */
function dephaseAfterOp(
  stateClassic: Complex[],
  op: Complex[][],
  config: QuantumConfig,
): Complex[] {
  if (config.interferenceMode !== 'off') return stateClassic;
  const next: Complex[] = new Array(stateClassic.length).fill(c(0));
  for (let i = 0; i < stateClassic.length; i++) {
    for (let k = 0; k < stateClassic.length; k++) {
      next[i] = add(next[i], c(absSq(op[i][k]) * absSq(stateClassic[k])));
    }
  }
  return next;
}

export function runQuantumPipeline(
  outcomes: Outcome[],
  evidence: EvidenceItem[],
  config: QuantumConfig,
  options?: { collectTraces?: boolean },
): QuantumPipelineResult {
  const ids = outcomeIds(outcomes);
  const n = ids.length;
  const priors = priorsFrom(outcomes, config.amplitudeInit === 'uniform');

  if (n <= 1) {
    const probabilities: Record<string, number> = {};
    const amplitudes: Record<string, Complex> = {};
    ids.forEach((id) => {
      amplitudes[id] = c(1);
      probabilities[id] = 1;
    });
    return {
      state: [c(1)],
      probabilities,
      amplitudes,
      interference: { [ids[0]]: 0 },
      totalInterference: 0,
      ops: [],
      traces: [{ label: 'Initial state', amplitudes, probabilities }],
    };
  }

  let state: Complex[] = ids.map((id) => {
    const p = Math.max(0, priors[id]);
    return c(Math.sqrt(p));
  });
  let stateClassic: Complex[] = state.map((a) => ({ ...a }));

  const L = likelihoodMatrix(evidence, ids);
  const ops: Complex[][][] = [];
  const traces: QuantumPipelineResult['traces'] = [];

  const pushTrace = (
    label: string,
    contextBefore?: Record<string, number>,
    contextAfter?: Record<string, number>,
  ) => {
    if (!options?.collectTraces) return;
    const amps: Record<string, Complex> = {};
    const probs: Record<string, number> = {};
    ids.forEach((id, i) => {
      amps[id] = { ...state[i] };
      probs[id] = absSq(state[i]);
    });
    traces.push({ label, amplitudes: amps, probabilities: probs, contextBefore, contextAfter });
  };

  pushTrace('Initial state');

  evidence.forEach((e, j) => {
    const row = L[j];
    const contextBefore: Record<string, number> = {};
    ids.forEach((id, i) => (contextBefore[id] = absSq(state[i])));

    if (config.contextTransformation === 'unitary-mix') {
      const support = normalizeVector(row);
      const lambda = (Math.PI / 4) * config.contextStrength * e.confidence;
      const op = phaseContextOp(n, support, lambda);
      ops.push(op);
      state = cMulMatVec(op, state);
      stateClassic = dephaseAfterOp(stateClassic, op, config);
    }

    let iStar = 0;
    let kStar = 1;
    let maxContrast = -1;
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const contrast = Math.abs(row[a] - row[b]);
        if (contrast > maxContrast) {
          maxContrast = contrast;
          iStar = a;
          kStar = b;
        }
      }
    }
    if (row[iStar] < row[kStar]) {
      const tmp = iStar;
      iStar = kStar;
      kStar = tmp;
    }
    const denom = row[iStar] + row[kStar];
    const relevance = denom > 1e-12 ? (row[iStar] - row[kStar]) / denom : 0;
    const theta = (Math.PI / 4) * config.rotationStrength * Math.abs(relevance) * e.confidence;
    const op = rotationOp(n, iStar, kStar, theta);
    ops.push(op);
    state = cMulMatVec(op, state);
    stateClassic = dephaseAfterOp(stateClassic, op, config);

    const contextAfter: Record<string, number> = {};
    ids.forEach((id, i) => (contextAfter[id] = absSq(state[i])));
    pushTrace(`After evidence ${j + 1}: ${e.name}`, contextBefore, contextAfter);
  });

  const interferenceOff = config.interferenceMode === 'off';
  const probabilities: Record<string, number> = {};
  const amplitudes: Record<string, Complex> = {};
  ids.forEach((id, i) => {
    amplitudes[id] = { ...(interferenceOff ? stateClassic[i] : state[i]) };
    probabilities[id] = absSq(interferenceOff ? stateClassic[i] : state[i]);
  });

  let U = cIdentity(n);
  ops.forEach((op) => (U = cMulMat(op, U)));

  const interference: Record<string, number> = {};
  let totalInterference = 0;
  if (interferenceOff) {
    ids.forEach((id) => (interference[id] = 0));
  } else {
    ids.forEach((id, i) => {
      let classicalMix = 0;
      ids.forEach((_, k) => {
        classicalMix += absSq(U[i][k]) * Math.max(0, priors[ids[k]]);
      });
      const value = probabilities[id] - classicalMix;
      interference[id] = value;
      totalInterference += Math.abs(value);
    });
  }

  return { state, probabilities, amplitudes, interference, totalInterference, ops, traces };
}

export function runQuantum(
  outcomes: Outcome[],
  evidence: EvidenceItem[],
  config: QuantumConfig,
): ModelRunResult {
  const ids = outcomeIds(outcomes);
  const steps = [];
  const priors = priorsFrom(outcomes, config.amplitudeInit === 'uniform');

  steps.push(
    step(
      'Initial state',
      '|ψ₀⟩ = Σᵢ αᵢ|i⟩',
      { ...priors },
      config.amplitudeInit === 'uniform'
        ? 'Uniform amplitude initialization: αᵢ = 1/√N.'
        : 'Amplitudes initialized from base probabilities: αᵢ = √P(Hᵢ).',
    ),
  );

  const pipeline = runQuantumPipeline(outcomes, evidence, config, { collectTraces: true });

  pipeline.traces.slice(1).forEach((t) => {
    const probs = { ...t.probabilities };
    steps.push(
      step(
        t.label,
        '|ψ⟩ → Uⱼ|ψ⟩',
        probs,
        'State after the unitary transformation for this evidence. ' +
          (t.contextBefore && t.contextAfter
            ? `Context effect: P(${ids[0]}) ${round(t.contextBefore[ids[0]] ?? 0, 3)} → ${round(t.contextAfter[ids[0]] ?? 0, 3)}.`
            : 'Measurement probabilities from Born rule.'),
      ),
    );
  });

  const interferenceTotal = pipeline.totalInterference;
  steps.push(
    step(
      'Interference',
      'interferenceᵢ = P(i) − Σₖ|Uᵢₖ|²P₀(k)',
      { ...pipeline.interference },
      `Interference contribution per outcome from phase mixing. Total |interference| = ${round(interferenceTotal, 4)}.`,
    ),
  );

  steps.push(
    step(
      'Measurement',
      'P(i) = |αᵢ|²',
      { ...pipeline.probabilities },
      `Born-rule measurement of the final state. Normalization Σ|αᵢ|² = ${round(normOf(pipeline.state), 6)}.`,
    ),
  );

  const decision = decisionOf(pipeline.probabilities, outcomes);
  const expectedUtility = expectedUtilityOf(pipeline.probabilities, outcomes);
  steps.push(
    step(
      'Quantum decision',
      'argmax P(i)',
      { [decision.id]: pipeline.probabilities[decision.id] ?? 0 },
      `Selected outcome with the highest measurement probability (expected utility ${round(expectedUtility, 3)}).`,
    ),
  );

  const amplitudeText = ids
    .map((id) => {
      const a = pipeline.amplitudes[id];
      return `${a.re.toFixed(3)}${a.im >= 0 ? '+' : ''}${a.im.toFixed(3)}i`;
    })
    .join(', ');

  return makeResult(
    'quantum',
    { ...pipeline.probabilities },
    outcomes,
    steps,
    {
      stateRepresentation: config.stateRepresentation,
      amplitudes: pipeline.amplitudes,
      amplitudeText: `|ψ⟩ = (${amplitudeText})`,
      interference: pipeline.interference,
      totalInterference: interferenceTotal,
      normalization: normOf(pipeline.state),
      bornRule: true,
    },
  );
}

/** Run the pipeline in both evidence orders and compare results. */
export function runQuantumBothOrders(
  outcomes: Outcome[],
  evidence: EvidenceItem[],
  config: QuantumConfig,
): { orderAB: Record<string, number>; orderBA: Record<string, number>; distance: number } {
  if (evidence.length < 2) {
    const single = runQuantumPipeline(outcomes, evidence, config);
    return { orderAB: { ...single.probabilities }, orderBA: { ...single.probabilities }, distance: 0 };
  }
  const forward = runQuantumPipeline(outcomes, evidence, config);
  const reversed = runQuantumPipeline(outcomes, [...evidence].reverse(), config);
  const ids = outcomeIds(outcomes);
  const orderAB: Record<string, number> = { ...forward.probabilities };
  const orderBA: Record<string, number> = { ...reversed.probabilities };
  const distance = ids.reduce((acc, id) => acc + Math.abs((orderAB[id] ?? 0) - (orderBA[id] ?? 0)), 0) / 2;
  return { orderAB, orderBA, distance };
}