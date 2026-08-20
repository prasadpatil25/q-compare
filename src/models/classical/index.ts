import type { ClassicalConfig, EvidenceItem, ModelRunResult, Outcome } from '../../types';
import { normalizeProbabilities, round } from '../../utils';
import {
  decisionOf,
  expectedUtilityOf,
  formatVector,
  likelihoodMatrix,
  makeResult,
  outcomeIds,
  priorsFrom,
  step,
} from '../shared';

/**
 * Classical probability model.
 *
 * Two transparent methods:
 * - `frequency`: posterior ∝ prior × average likelihood over evidence
 *   (frequency-style aggregation of conditional frequencies).
 * - `conditional`: posterior ∝ prior × product of likelihoods
 *   (conditional probability table / naive independence combination).
 *
 * Both are normalized so the posterior sums to 1.
 */
export function runClassical(
  outcomes: Outcome[],
  evidence: EvidenceItem[],
  config: ClassicalConfig,
): ModelRunResult {
  const ids = outcomeIds(outcomes);
  const steps = [];
  const prior = priorsFrom(outcomes, false);
  steps.push(
    step(
      'Base probabilities',
      'P(Hᵢ) from experiment definition',
      prior,
      'Base rates for each outcome, taken directly from the experiment definition.',
    ),
  );

  let posterior: Record<string, number>;
  let formula: string;
  if (evidence.length === 0) {
    posterior = { ...prior };
    formula = 'No evidence provided — posterior = base probabilities';
  } else {
    const L = likelihoodMatrix(evidence, ids);
    const raw: Record<string, number> = {};
    if (config.probabilityMethod === 'frequency') {
      for (let i = 0; i < ids.length; i++) {
        const avgL = L.reduce((acc, row) => acc + row[i], 0) / L.length;
        raw[ids[i]] = prior[ids[i]] * avgL;
      }
      formula = 'P(Hᵢ|E) ∝ P(Hᵢ) × meanⱼ P(Eⱼ|Hᵢ)';
    } else {
      for (let i = 0; i < ids.length; i++) {
        raw[ids[i]] = prior[ids[i]] * L.reduce((acc, row) => acc * row[i], 1);
      }
      formula = 'P(Hᵢ|E) ∝ P(Hᵢ) × Πⱼ P(Eⱼ|Hᵢ)';
    }
    posterior = normalizeProbabilities(raw);
  }

  const norm = normalizeProbabilities(posterior);
  steps.push(
    step(
      'Normalization',
      'Σ P(Hᵢ|E) = 1',
      norm,
      `Classical normalization: ${formula} rescaled so probabilities sum to 1.`,
    ),
  );

  const utilityMethod = config.utilityMethod;
  const decision = decisionOf(norm, outcomes);
  const expectedUtility = expectedUtilityOf(norm, outcomes);
  steps.push(
    step(
      'Decision',
      utilityMethod === 'expected-utility' ? 'argmax Σ P(Hᵢ)·Uᵢ' : 'argmax P(Hᵢ)',
      { [decision.id]: norm[decision.id] ?? 0 },
      utilityMethod === 'expected-utility'
        ? `Selected outcome with highest expected utility (${round(expectedUtility, 3)}).`
        : 'Selected outcome with the highest posterior probability.',
    ),
  );

  return makeResult(
    'classical',
    norm,
    outcomes,
    steps,
    {
      method: config.probabilityMethod,
      utilityMethod,
      formula,
      outcomeVector: formatVector(norm, outcomes),
    },
  );
}