import type {
  ContextAnalysis,
  EvaluationMetrics,
  ModelId,
  ModelRunResult,
  OrderAnalysis,
} from '../types';
import { avg, clamp, round } from '../utils';

/**
 * Evaluation metrics. All models are evaluated under identical conditions.
 *
 * - Accuracy: 1 when the predicted outcome equals the observed outcome (if any).
 * - Log-likelihood: ln P(observed outcome).
 * - Brier score: Σᵢ (Pᵢ − yᵢ)² with y = 1-hot encoding of the observed outcome.
 * - Calibration error: mean |P_model(i) − fᵢ| where fᵢ is the empirical
 *   frequency estimate fᵢ ∝ P(Hᵢ)·meanⱼ P(Eⱼ|Hᵢ) derived from evidence.
 * - Prediction error: 1 − P(observed) when an observed outcome exists.
 * - Expected utility: Σᵢ Pᵢ·Uᵢ.
 * - Complexity: 1 = Classical, 2 = Bayesian, 3 = Quantum-Inspired (parameterized
 *   state + operator count). Reported separately — never used to rank quality.
 */
export function computeMetrics(
  modelId: ModelId,
  result: ModelRunResult,
  input: {
    observedOutcomeId?: string;
    outcomes: Array<{ id: string; label: string; utility: number }>;
    priors: Record<string, number>;
    likelihoodAverages: Record<string, number>;
  },
  analyses: { context?: ContextAnalysis; order?: OrderAnalysis },
): EvaluationMetrics {
  const ids = input.outcomes.map((o) => o.id);
  const P = result.probabilities;

  const empirical: Record<string, number> = {};
  const raw: Record<string, number> = {};
  ids.forEach((id) => {
    raw[id] = Math.max(0, (input.priors[id] ?? 0) * (input.likelihoodAverages[id] ?? 0));
  });
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  if (sum > 0) ids.forEach((id) => (empirical[id] = raw[id] / sum));
  else ids.forEach((id) => (empirical[id] = 1 / ids.length));

  const observed = input.observedOutcomeId;
  let accuracy: number | null = null;
  let logLikelihood: number | null = null;
  let brierScore: number | null = null;
  let predictionError: number | null = null;

  if (observed && ids.includes(observed)) {
    const pObs = P[observed] ?? 0;
    accuracy = result.decision === observed ? 1 : 0;
    logLikelihood = Math.log(Math.max(pObs, 1e-12));
    brierScore = ids.reduce((acc, id) => acc + ((P[id] ?? 0) - (id === observed ? 1 : 0)) ** 2, 0);
    predictionError = 1 - pObs;
  }

  const calibrationError = avg(ids.map((id) => Math.abs((P[id] ?? 0) - (empirical[id] ?? 0))));

  const complexity: Record<ModelId, number> = { classical: 1, bayesian: 2, quantum: 3 };

  const contextSensitivity =
    analyses.context?.sensitivity[modelId] != null ? analyses.context.sensitivity[modelId] : null;

  let orderEffect: number | null = null;
  if (modelId === 'quantum' && analyses.order?.applicable) {
    orderEffect = analyses.order.pairs.reduce((acc, p) => acc + Math.abs(p.deltaP), 0);
  } else if (modelId !== 'quantum' && analyses.order?.applicable) {
    orderEffect = 0;
  }

  const interferenceMeasure =
    modelId === 'quantum'
      ? round((result.details.totalInterference as number | undefined) ?? 0, 4)
      : null;

  const nonCommutativity =
    modelId === 'quantum' && analyses.order?.applicable
      ? round(
          analyses.order.pairs.reduce((acc, p) => acc + Math.abs(p.deltaP), 0),
          4,
        )
      : null;

  return {
    accuracy,
    logLikelihood: logLikelihood != null ? round(logLikelihood, 6) : null,
    brierScore: brierScore != null ? round(brierScore, 6) : null,
    calibrationError: round(calibrationError, 6),
    predictionError: predictionError != null ? round(predictionError, 6) : null,
    expectedUtility: round(result.expectedUtility, 4),
    complexity: complexity[modelId],
    contextSensitivity: contextSensitivity != null ? round(contextSensitivity, 4) : null,
    orderEffect: orderEffect != null ? round(orderEffect, 4) : null,
    interferenceMeasure,
    nonCommutativity,
  };
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}