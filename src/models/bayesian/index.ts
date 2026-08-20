import type { BayesianConfig, EvidenceItem, ModelRunResult, Outcome } from '../../types';
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

const EPSILON = 1e-9;

/**
 * Bayesian inference model.
 *
 * P(Hᵢ | E₁…Eₙ) ∝ P(Hᵢ) × Πⱼ P(Eⱼ | Hᵢ)
 *
 * Sequential updates apply one evidence at a time so the user can
 * inspect how each evidence item changes the posterior.
 */
export function runBayesian(
  outcomes: Outcome[],
  evidence: EvidenceItem[],
  config: BayesianConfig,
): ModelRunResult {
  const ids = outcomeIds(outcomes);
  const steps = [];
  const prior = priorsFrom(outcomes, config.priorSource === 'uniform');
  steps.push(
    step(
      'Prior',
      'P(Hᵢ)',
      prior,
      config.priorSource === 'uniform'
        ? 'Uniform prior over all outcomes.'
        : 'Prior taken from the outcome base probabilities in the experiment definition.',
    ),
  );

  let posterior = { ...prior };
  const L = likelihoodMatrix(evidence, ids);

  if (config.updateStrategy === 'sequential' && evidence.length > 0) {
    evidence.forEach((e, j) => {
      const raw: Record<string, number> = {};
      ids.forEach((id, i) => {
        const lik = L[j][i] <= 0 ? EPSILON : L[j][i];
        raw[id] = posterior[id] * lik;
      });
      posterior = normalizeProbabilities(raw);
      const display = { ...posterior };
      steps.push(
        step(
          `Evidence ${j + 1}: ${e.name}`,
          `P(Hᵢ|E₁…E${j + 1}) ∝ P(Hᵢ|E₁…E${j}) × P(E${j + 1}|Hᵢ)`,
          display,
          `Posterior after applying "${e.name}". Normalized so Σ P = 1.`,
        ),
      );
    });
  } else if (evidence.length > 0) {
    const raw: Record<string, number> = {};
    ids.forEach((id, i) => {
      raw[id] = prior[id] * L.reduce((acc, row) => acc * (row[i] <= 0 ? EPSILON : row[i]), 1);
    });
    posterior = normalizeProbabilities(raw);
    steps.push(
      step(
        `All evidence (${evidence.length} items)`,
        'P(Hᵢ|E) ∝ P(Hᵢ) × Πⱼ P(Eⱼ|Hᵢ)',
        { ...posterior },
        'Batch update: all likelihoods multiplied into the prior in one step.',
      ),
    );
  }

  const norm = normalizeProbabilities(posterior);
  const decision = decisionOf(norm, outcomes);
  const expectedUtility = expectedUtilityOf(norm, outcomes);
  steps.push(
    step(
      'Bayesian decision',
      'argmax P(Hᵢ|E)',
      { [decision.id]: norm[decision.id] ?? 0 },
      `Selected outcome with the highest posterior probability (expected utility ${round(expectedUtility, 3)}).`,
    ),
  );

  return makeResult(
    'bayesian',
    norm,
    outcomes,
    steps,
    {
      priorSource: config.priorSource,
      updateStrategy: config.updateStrategy,
      posteriorVector: formatVector(norm, outcomes),
    },
  );
}