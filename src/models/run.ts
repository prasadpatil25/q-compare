import type {
  Experiment,
  ExperimentResults,
  ModelId,
  ModelRunResult,
  Recommendation,
} from '../types';
import { round } from '../utils';
import { MODEL_LABELS } from '../types';
import { runClassical } from './classical';
import { runBayesian } from './bayesian';
import { runQuantum } from './quantum';
import { computeMetrics } from '../evaluation/metrics';
import { analyzeContextAndOrder, computeQai, computeQaiComponents, likelihoodAverages } from '../qai';
import { priorsFrom } from './shared';

/**
 * Orchestrator: runs all selected models on the SAME experiment definition,
 * evaluates them under identical conditions, computes the QAI and produces
 * a measured recommendation.
 */
export function runExperiment(experiment: Experiment): ExperimentResults {
  const started = performance.now();
  const outcomes = experiment.problem.outcomes;
  const evidence = experiment.evidence;

  const models: Record<ModelId, ModelRunResult> = {
    classical: {
      modelId: 'classical',
      status: 'skipped',
      probabilities: {},
      decision: '',
      decisionLabel: '',
      expectedUtility: 0,
      steps: [],
      details: {},
    },
    bayesian: {
      modelId: 'bayesian',
      status: 'skipped',
      probabilities: {},
      decision: '',
      decisionLabel: '',
      expectedUtility: 0,
      steps: [],
      details: {},
    },
    quantum: {
      modelId: 'quantum',
      status: 'skipped',
      probabilities: {},
      decision: '',
      decisionLabel: '',
      expectedUtility: 0,
      steps: [],
      details: {},
    },
  };

  if (experiment.models.classical) {
    models.classical = runClassical(outcomes, evidence, experiment.config.classical);
  }
  if (experiment.models.bayesian) {
    models.bayesian = runBayesian(outcomes, evidence, experiment.config.bayesian);
  }
  if (experiment.models.quantum) {
    models.quantum = runQuantum(outcomes, evidence, experiment.config.quantum);
  }

  const analyses = analyzeContextAndOrder(experiment);
  const priors = priorsFrom(outcomes, false);
  const likelihoodAvg = likelihoodAverages(experiment);

  const metrics = {} as ExperimentResults['metrics'];
  (Object.keys(models) as ModelId[]).forEach((modelId) => {
    const result = models[modelId];
    if (result.status !== 'ok') {
      metrics[modelId] = {
        accuracy: null,
        logLikelihood: null,
        brierScore: null,
        calibrationError: null,
        predictionError: null,
        expectedUtility: null,
        complexity: modelId === 'classical' ? 1 : modelId === 'bayesian' ? 2 : 3,
        contextSensitivity: null,
        orderEffect: null,
        interferenceMeasure: null,
        nonCommutativity: null,
      };
      return;
    }
    metrics[modelId] = computeMetrics(
      modelId,
      result,
      {
        observedOutcomeId: experiment.problem.observedOutcomeId,
        outcomes,
        priors,
        likelihoodAverages: likelihoodAvg,
      },
      analyses,
    );
  });

  const nonCommutativity = analyses.nonCommutativity;
  const qaiComponents = computeQaiComponents({
    metrics,
    totalInterference: analyses.totalInterference,
    nonCommutativity,
  });

  const reasons: string[] = [];
  const caveats: string[] = [];
  if (analyses.context?.applicable && qaiComponents.context >= 0.3) {
    reasons.push('The experiment contains context-dependent evidence');
  }
  if (analyses.order?.applicable && qaiComponents.nonCommutativity >= 0.3) {
    reasons.push('The experiment contains order-sensitive evidence');
  }
  if (metrics.quantum.predictionError == null && experiment.problem.observedOutcomeId == null) {
    caveats.push('No observed outcome is defined — error-based components use Brier score instead.');
  }

  const qai = computeQai(qaiComponents, experiment.config.qaiWeights ?? DEFAULT_WEIGHTS, reasons, caveats);

  const recommendation = recommend(models, metrics, qai.value);

  const durationMs = round(performance.now() - started, 0);

  return {
    ranAt: new Date().toISOString(),
    durationMs,
    models,
    metrics,
    qai,
    recommendation,
    contextAnalysis: analyses.context,
    orderAnalysis: analyses.order,
    interferenceAnalysis: {
      applicable: experiment.models.quantum,
      interference: models.quantum.status === 'ok' ? ((models.quantum.details.interference as Record<string, number>) ?? {}) : {},
      total: analyses.totalInterference,
    },
    nonCommutativityAnalysis: {
      applicable: analyses.order?.applicable ?? false,
      distance: nonCommutativity ?? 0,
      orderAB: {},
      orderBA: {},
    },
  };
}

export const DEFAULT_WEIGHTS = { context: 0.25, interference: 0.25, errorReduction: 0.2, nonCommutativity: 0.15, calibration: 0.15 };

export function withQaiWeights(
  experiment: Experiment,
  weights: Experiment['config']['qaiWeights'] | undefined,
): Experiment {
  if (!weights) return experiment;
  return {
    ...experiment,
    config: {
      ...experiment.config,
      qaiWeights: { ...weights },
    },
  };
}

function recommend(
  models: Record<ModelId, ModelRunResult>,
  metrics: ExperimentResults['metrics'],
  qaiValue: number,
): Recommendation {
  const available = (Object.keys(models) as ModelId[]).filter((m) => models[m].status === 'ok');
  if (available.length === 0) {
    return { modelId: 'classical', reason: 'No model produced results — check the experiment configuration.' };
  }
  if (available.length === 1) {
    return {
      modelId: available[0],
      reason: 'Only one model was enabled for this experiment, so no comparative recommendation can be made.',
    };
  }

  const errorOf = (id: ModelId): number | null => {
    const m = metrics[id];
    if (m.predictionError != null) return m.predictionError;
    if (m.brierScore != null) return m.brierScore;
    return null;
  };

  const errorRanking: Array<{ id: ModelId; error: number }> = available
    .map((id) => ({ id, error: errorOf(id) }))
    .filter((x): x is { id: ModelId; error: number } => x.error != null)
    .sort((a, b) => a.error - b.error);

  const hasObserved = errorRanking.length === available.length && available.length > 1;

  if (hasObserved) {
    const best = errorRanking[0];
    const second = errorRanking[1];
    const margin = second.error - best.error;
    const calibOf = (id: ModelId) => metrics[id].calibrationError ?? 1;

    if (best.id === 'quantum') {
      if (margin >= 0.01 || qaiValue >= 0.5) {
        const detail =
          margin >= 0.01
            ? `It achieved the lowest prediction error (${best.error.toFixed(3)} vs ${second.error.toFixed(3)} for ${MODEL_LABELS[second.id]}).`
            : `Its prediction error is comparable to the best alternative and the Quantum Advantage Indicator (QAI = ${qaiValue.toFixed(2)}) supports an advantage.`;
        return {
          modelId: 'quantum',
          reason:
            'The quantum-inspired model demonstrates stronger performance for this experiment under the selected evaluation criteria. ' +
            detail +
            ' This is a measured result for this experiment and configuration, not a general claim about quantum models.',
        };
      }
      const fallback = bestErrorFallback(available, errorRanking, calibOf, qaiValue);
      return fallback;
    }

    if (second.id === 'quantum' && margin < 0.01 && qaiValue >= 0.5) {
      return {
        modelId: 'quantum',
        reason:
          'The quantum-inspired model matches the best prediction error within noise and the Quantum Advantage Indicator (QAI = ' +
          qaiValue.toFixed(2) +
          ') indicates an advantage for this experiment under the selected evaluation criteria.',
      };
    }

    const candidates = [best.id, second.id];
    const winner =
      margin >= 0.03
        ? best.id
        : calibOf(candidates[0]) <= calibOf(candidates[1]) + 0.005
          ? candidates[0]
          : candidates[1];
    const label = MODEL_LABELS[winner];
    const marginText =
      margin >= 0.03
        ? ` with a prediction-error margin of ${(margin * 100).toFixed(1)} percentage points over ${MODEL_LABELS[second.id]}.`
        : '';
    return {
      modelId: winner,
      reason:
        `The ${label} model achieved the lowest prediction error (${best.error.toFixed(3)}) for this experiment` +
        marginText +
        (metrics[winner].calibrationError != null
          ? ` Calibration error: ${metrics[winner].calibrationError.toFixed(3)}.`
          : '') +
        ` The quantum-inspired model did not demonstrate a meaningful advantage (QAI = ${qaiValue.toFixed(2)}), so the more complex formalism is not justified here.` +
        (winner === 'classical' ? ' Its lower complexity makes it the recommended choice.' : ''),
    };
  }

  return bestErrorFallback(available, errorRanking, (id) => metrics[id].calibrationError ?? 1, qaiValue);
}

function bestErrorFallback(
  available: ModelId[],
  errorRanking: Array<{ id: ModelId; error: number }>,
  calibOf: (id: ModelId) => number,
  qaiValue: number,
): Recommendation {
  const ranked = [...errorRanking].sort((a, b) => a.error - b.error);
  if (ranked.length >= 2 && ranked[0].id === 'quantum' && qaiValue >= 0.5) {
    return {
      modelId: 'quantum',
      reason:
        'No observed outcome is defined, so prediction error cannot be measured. The quantum-inspired model has the lowest calibration error and the Quantum Advantage Indicator (QAI = ' +
        qaiValue.toFixed(2) +
        ') supports an advantage for this experiment under the selected criteria.',
    };
  }
  const ranked2 = available
    .map((id) => ({ id, calib: calibOf(id) }))
    .sort((a, b) => a.calib - b.calib);
  if (ranked2.length === 0) {
    return { modelId: 'classical', reason: 'No comparative metrics available for this experiment.' };
  }
  const winner = ranked2[0];
  const second = ranked2[1];
  const label = MODEL_LABELS[winner.id];
  const reason =
    winner.id === 'quantum'
      ? `The quantum-inspired model achieved the best calibration under the selected criteria (calibration error ${winner.calib.toFixed(3)}), and the Quantum Advantage Indicator (QAI = ${qaiValue.toFixed(2)}) supports an advantage for this experiment. This is a measured result, not a general claim about quantum models.`
      : `The ${label} model achieved the best calibration (${winner.calib.toFixed(3)} vs ${second?.calib.toFixed(3) ?? '—'}) without requiring contextual or order-sensitive assumptions. The quantum-inspired model did not demonstrate a meaningful advantage (QAI = ${qaiValue.toFixed(2)}).`;
  return { modelId: winner.id, reason };
}