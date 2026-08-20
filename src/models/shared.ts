import type {
  EvidenceItem,
  Experiment,
  ModelRunResult,
  Outcome,
  StepTrace,
} from '../types';

export interface ModelInput {
  outcomes: Outcome[];
  evidence: EvidenceItem[];
}

export function toModelInput(experiment: Experiment): ModelInput {
  return {
    outcomes: experiment.problem.outcomes,
    evidence: experiment.evidence,
  };
}

export function outcomeIds(outcomes: Outcome[]): string[] {
  return outcomes.map((o) => o.id);
}

export function priorsFrom(outcomes: Outcome[], uniform: boolean): Record<string, number> {
  const ids = outcomeIds(outcomes);
  if (uniform || outcomes.every((o) => !(o.priorProbability > 0))) {
    const p = 1 / ids.length;
    const out: Record<string, number> = {};
    ids.forEach((id) => (out[id] = p));
    return out;
  }
  const out: Record<string, number> = {};
  const total = outcomes.reduce((a, o) => a + Math.max(0, o.priorProbability), 0);
  outcomes.forEach((o) => (out[o.id] = total > 0 ? Math.max(0, o.priorProbability) / total : 1 / ids.length));
  return out;
}

export function likelihoodMatrix(evidence: EvidenceItem[], ids: string[]): number[][] {
  return evidence.map((e) =>
    ids.map((id) => {
      const v = e.likelihood[id];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
      return 1 / ids.length;
    }),
  );
}

export function expectedUtilityOf(
  probabilities: Record<string, number>,
  outcomes: Outcome[],
): number {
  return outcomes.reduce((acc, o) => acc + (probabilities[o.id] ?? 0) * o.utility, 0);
}

export function decisionOf(
  probabilities: Record<string, number>,
  outcomes: Outcome[],
): { id: string; label: string } {
  let bestId = outcomes[0]?.id ?? '';
  let best = -Infinity;
  for (const o of outcomes) {
    const p = probabilities[o.id] ?? 0;
    if (p > best) {
      best = p;
      bestId = o.id;
    }
  }
  const outcome = outcomes.find((o) => o.id === bestId);
  return { id: bestId, label: outcome?.label ?? bestId };
}

export function makeResult(
  modelId: ModelRunResult['modelId'],
  probabilities: Record<string, number>,
  outcomes: Outcome[],
  steps: StepTrace[],
  details: Record<string, unknown>,
): ModelRunResult {
  const decision = decisionOf(probabilities, outcomes);
  return {
    modelId,
    status: 'ok',
    probabilities,
    decision: decision.id,
    decisionLabel: decision.label,
    expectedUtility: expectedUtilityOf(probabilities, outcomes),
    steps,
    details,
  };
}

export function step(
  label: string,
  formula: string,
  values: Record<string, number>,
  explanation: string,
): StepTrace {
  return { label, formula, values, explanation };
}

export function formatVector(
  probabilities: Record<string, number>,
  outcomes: Outcome[],
  digits = 3,
): string {
  return outcomes
    .map((o) => `P(${o.label}) = ${(probabilities[o.id] ?? 0).toFixed(digits)}`)
    .join(', ');
}