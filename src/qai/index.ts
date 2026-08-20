import type {
  ContextAnalysis,
  EvidenceItem,
  Experiment,
  ModelId,
  OrderAnalysis,
  QaiComponents,
  QaiResult,
  QaiWeights,
} from '../types';
import { clamp, round } from '../utils';
import { runClassical } from '../models/classical';
import { runBayesian } from '../models/bayesian';
import { runQuantumPipeline } from '../models/quantum';
import { likelihoodMatrix } from '../models/shared';

/**
 * Quantum Advantage Indicator (QAI) — a research visualization metric,
 * NOT a universal scientific measure of "quantumness".
 *
 *   QAI = w₁·Ctx + w₂·Interf + w₃·ErrRed + w₄·NonComm + w₅·Calib   (weighted mean)
 *
 * Component definitions (each normalized to [0, 1]):
 * - Ctx      : relative context sensitivity of the quantum model beyond the
 *              best classical/bayesian alternative:
 *              max(0, sens_q − sens_best_other) / max(sens_q, ε)
 * - Interf   : total interference magnitude of the quantum pipeline,
 *              normalized against reference scale 1.0 (max |Σᵢ Interfᵢ| for
 *              a binary measurement).
 * - ErrRed   : relative prediction-error reduction of quantum vs the best
 *              classical/bayesian alternative. Falls back to Brier-score
 *              reduction when no observed outcome exists.
 * - NonComm  : normalized order-effect distance (total variation distance
 *              between evidence orders, range [0, 1]).
 * - Calib    : calibration-error reduction of quantum vs best alternative.
 */
export function qaiNormalizationReference(): number {
  return 1.0;
}

export function computeQaiComponents(input: {
  metrics: Record<ModelId, import('../types').EvaluationMetrics>;
  totalInterference: number;
  nonCommutativity: number | null;
}): QaiComponents {
  const { metrics, totalInterference, nonCommutativity } = input;
  const mq = metrics.quantum;
  const bestOther = (key: keyof typeof mq): number | null => {
    const values: number[] = [];
    (['classical', 'bayesian'] as ModelId[]).forEach((id) => {
      const v = metrics[id]?.[key];
      if (typeof v === 'number' && Number.isFinite(v)) values.push(v);
    });
    if (values.length === 0) return null;
    return Math.min(...values);
  };

  const sensQ = mq?.contextSensitivity ?? 0;
  const sensOther = bestOther('contextSensitivity') ?? 0;
  const context = sensQ > 1e-9 ? Math.max(0, (sensQ - sensOther) / sensQ) : 0;

  const interference = clamp(totalInterference / qaiNormalizationReference());

  let errRed = 0;
  const errQ = mq?.predictionError;
  const errOther = bestOther('predictionError');
  if (errQ != null && errOther != null && errOther > 1e-9) {
    errRed = clamp(Math.max(0, (errOther - errQ) / errOther));
  } else if (mq?.brierScore != null) {
    const bq = mq.brierScore;
    const bo = bestOther('brierScore');
    if (bo != null && bo > 1e-9) errRed = clamp(Math.max(0, (bo - bq) / bo));
  }

  const nonComm = nonCommutativity != null ? clamp(nonCommutativity / 1.0) : 0;

  let calib = 0;
  const ceQ = mq?.calibrationError;
  const ceOther = bestOther('calibrationError');
  if (ceQ != null && ceOther != null && ceOther > 1e-9) {
    calib = clamp(Math.max(0, (ceOther - ceQ) / ceOther));
  }

  return {
    context: round(context, 4),
    interference: round(interference, 4),
    errorReduction: round(errRed, 4),
    nonCommutativity: round(nonComm, 4),
    calibration: round(calib, 4),
  };
}

export function computeQai(
  components: QaiComponents,
  weights: QaiWeights,
  reasonsIn: string[],
  caveatsIn: string[],
): QaiResult {
  const w = weights;
  const total = w.context + w.interference + w.errorReduction + w.nonCommutativity + w.calibration;
  const value =
    total > 0
      ? (w.context * components.context +
          w.interference * components.interference +
          w.errorReduction * components.errorReduction +
          w.nonCommutativity * components.nonCommutativity +
          w.calibration * components.calibration) /
        total
      : 0;

  const clamped = clamp(value);
  let level: QaiResult['level'];
  if (clamped < 0.25) level = 'low';
  else if (clamped < 0.5) level = 'limited';
  else if (clamped < 0.75) level = 'moderate';
  else level = 'strong';

  const label =
    level === 'low'
      ? 'Low / No demonstrated advantage'
      : level === 'limited'
        ? 'Limited advantage'
        : level === 'moderate'
          ? 'Moderate advantage'
          : 'Strong advantage';

  const reasons = [...reasonsIn];
  if (components.context >= 0.3) reasons.push('Strong context dependence captured by the quantum-inspired state');
  if (components.interference >= 0.3) reasons.push('Non-trivial interference contribution detected');
  if (components.errorReduction >= 0.3) reasons.push('Lower prediction error than the best classical alternative');
  if (components.nonCommutativity >= 0.3) reasons.push('Significant order effect (non-commutativity) detected');
  if (components.calibration >= 0.3) reasons.push('Better calibration than the best classical alternative');

  const caveats = [
    'QAI is a research visualization metric with configurable weights, not a universal measure of "quantumness".',
    'The quantum-inspired model is a mathematical simulation and does not run on a quantum computer.',
    ...caveatsIn,
  ];

  return {
    value: round(clamped, 4),
    level,
    label,
    components,
    weights: { ...w },
    reasons,
    caveats,
  };
}

export function analyzeContextAndOrder(experiment: Experiment): {
  context: ContextAnalysis | undefined;
  order: OrderAnalysis | undefined;
  totalInterference: number;
  nonCommutativity: number | null;
} {
  const outcomes = experiment.problem.outcomes;
  const evidence = experiment.evidence;
  const ids = outcomes.map((o) => o.id);
  const config = experiment.config;

  let context: ContextAnalysis | undefined;
  const contexts = Array.from(new Set(evidence.map((e) => e.context).filter((c) => c && c.trim() !== '')));
  if (contexts.length > 0) {
    const perContextProbabilities: ContextAnalysis['perContextProbabilities'] = {
      classical: {},
      bayesian: {},
      quantum: {},
    };
    const sensitivity: Record<ModelId, number> = { classical: 0, bayesian: 0, quantum: 0 };
    (['classical', 'bayesian', 'quantum'] as ModelId[]).forEach((modelId) => {
      perContextProbabilities[modelId] = {};
      let maxDiff = 0;
      contexts.forEach((ctx) => {
        const subset = evidence.filter((e) => e.context === ctx);
        const probs = runModelSubset(modelId, outcomes, subset, config);
        perContextProbabilities[modelId][ctx] = probs;
        ids.forEach((id) => {
          const pCtx = probs[id] ?? 0;
          const pBase = baseProbabilities(modelId, outcomes, evidence, config)[id] ?? 0;
          maxDiff = Math.max(maxDiff, Math.abs(pCtx - pBase));
        });
      });
      sensitivity[modelId] = maxDiff;
    });
    context = { applicable: true, contexts, perContextProbabilities, sensitivity };
  }

  let order: OrderAnalysis | undefined;
  const pairs: OrderAnalysis['pairs'] = [];
  if (evidence.length >= 2) {
    const idsA = ids;
    for (let a = 0; a < evidence.length; a++) {
      for (let b = a + 1; b < evidence.length; b++) {
        const A = evidence[a];
        const B = evidence[b];
        const classicalAB = runClassical(outcomes, [A, B], config.classical).probabilities;
        const classicalBA = runClassical(outcomes, [B, A], config.classical).probabilities;
        const quantumAB = runQuantumPipeline(outcomes, [A, B], config.quantum).probabilities;
        const quantumBA = runQuantumPipeline(outcomes, [B, A], config.quantum).probabilities;
        const deltaClassical = idsA.reduce((acc, id) => acc + Math.abs((classicalAB[id] ?? 0) - (classicalBA[id] ?? 0)), 0) / 2;
        const deltaQuantum = idsA.reduce((acc, id) => acc + Math.abs((quantumAB[id] ?? 0) - (quantumBA[id] ?? 0)), 0) / 2;
        pairs.push({
          a: A.name,
          b: B.name,
          deltaClassical: round(deltaClassical, 4),
          deltaQuantum: round(deltaQuantum, 4),
          deltaP: round(deltaQuantum - deltaClassical, 4),
        });
      }
    }
    order = { applicable: true, pairs };
  }

  const forward = runQuantumPipeline(outcomes, evidence, config.quantum);
  const reversed = runQuantumPipeline(outcomes, [...evidence].reverse(), config.quantum);
  const distance =
    evidence.length < 2
      ? 0
      : ids.reduce((acc, id) => acc + Math.abs((forward.probabilities[id] ?? 0) - (reversed.probabilities[id] ?? 0)), 0) / 2;

  return {
    context,
    order,
    totalInterference: forward.totalInterference,
    nonCommutativity: evidence.length >= 2 ? round(distance, 4) : null,
  };
}

function baseProbabilities(
  modelId: ModelId,
  outcomes: Experiment['problem']['outcomes'],
  evidence: EvidenceItem[],
  config: Experiment['config'],
): Record<string, number> {
  const r = runModelSubset(modelId, outcomes, evidence, config);
  return r;
}

function runModelSubset(
  modelId: ModelId,
  outcomes: Experiment['problem']['outcomes'],
  evidence: EvidenceItem[],
  config: Experiment['config'],
): Record<string, number> {
  if (modelId === 'classical') return runClassical(outcomes, evidence, config.classical).probabilities;
  if (modelId === 'bayesian') return runBayesian(outcomes, evidence, config.bayesian).probabilities;
  return runQuantumPipeline(outcomes, evidence, config.quantum).probabilities;
}

export function likelihoodAverages(
  experiment: Experiment,
): Record<string, number> {
  const ids = experiment.problem.outcomes.map((o) => o.id);
  const L = likelihoodMatrix(experiment.evidence, ids);
  const out: Record<string, number> = {};
  ids.forEach((id, i) => {
    out[id] = L.length > 0 ? L.reduce((acc, row) => acc + row[i], 0) / L.length : 1 / ids.length;
  });
  return out;
}