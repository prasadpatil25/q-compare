import type { Experiment, Insight, ModelId } from '../types';
import { MODEL_LABELS } from '../types';
import { uid } from '../utils';

/**
 * Rule-based insight generation. Insights are computed from stored results
 * and always cite the supporting experiments. No causal claims are made.
 */
export function generateInsights(experiments: Experiment[]): Insight[] {
  const insights: Insight[] = [];
  const completed = experiments.filter((e) => e.results && e.status === 'completed');
  if (completed.length === 0) {
    return [
      {
        id: uid('ins'),
        kind: 'neutral',
        title: 'No completed experiments yet',
        body: 'Run at least one experiment to generate data-driven insights.',
        support: 'Insights are derived from stored experiment results.',
        evidenceCount: 0,
      },
    ];
  }

  const categories = Array.from(new Set(completed.map((e) => e.category)));
  const byCategory: Record<string, Experiment[]> = {};
  completed.forEach((e) => {
    (byCategory[e.category] = byCategory[e.category] ?? []).push(e);
  });

  for (const category of categories) {
    const group = byCategory[category];
    const qaiValues = group.map((e) => e.results?.qai.value ?? 0);
    const meanQai = qaiValues.reduce((a, b) => a + b, 0) / qaiValues.length;
    const strong = group.filter((e) => (e.results?.qai.value ?? 0) >= 0.5);
    const names = group.map((e) => `"${e.name}"`).join(', ');

    if (meanQai >= 0.5 && strong.length >= 1) {
      insights.push({
        id: uid('ins'),
        kind: 'quantum',
        title: `Quantum-Inspired advantage: strong in ${category} experiments`,
        body: `Under the selected configuration, the quantum-inspired model demonstrated stronger performance (QAI ≥ 0.5) in ${strong.length} of ${group.length} ${category} experiment(s).`,
        support: `Observed in: ${names}. This is an observed pattern under the selected evaluation criteria, not a general claim about quantum models.`,
        evidenceCount: strong.length,
      });
    } else if (group.length >= 2 && meanQai < 0.25) {
      insights.push({
        id: uid('ins'),
        kind: 'neutral',
        title: `No meaningful quantum-inspired advantage in ${category} experiments`,
        body: `The average Quantum Advantage Indicator is ${meanQai.toFixed(2)} across ${group.length} ${category} experiment(s).`,
        support: `Observed in: ${names}. Classical and Bayesian models provide comparable or better results here.`,
        evidenceCount: group.length,
      });
    }
  }

  const recommended = (id: ModelId) =>
    completed.filter((e) => e.results?.recommendation.modelId === id);

  const bayesianGroup = recommended('bayesian');
  if (bayesianGroup.length >= 1) {
    insights.push({
      id: uid('ins'),
      kind: 'bayesian',
      title: 'Bayesian advantage: reliable priors and calibration',
      body: `The Bayesian model was recommended in ${bayesianGroup.length} experiment(s), typically when reliable prior information and calibration mattered.`,
      support: `Observed in: ${bayesianGroup.map((e) => `"${e.name}"`).join(', ')}.`,
      evidenceCount: bayesianGroup.length,
    });
  }

  const classicalGroup = recommended('classical');
  if (classicalGroup.length >= 1) {
    insights.push({
      id: uid('ins'),
      kind: 'classical',
      title: 'Classical advantage: comparable results at lower complexity',
      body: `The classical model was recommended in ${classicalGroup.length} experiment(s), where simpler probability handling matched the more complex models.`,
      support: `Observed in: ${classicalGroup.map((e) => `"${e.name}"`).join(', ')}.`,
      evidenceCount: classicalGroup.length,
    });
  }

  const quantumGroup = recommended('quantum');
  if (quantumGroup.length >= 1) {
    insights.push({
      id: uid('ins'),
      kind: 'quantum',
      title: 'Quantum-Inspired advantage: context and order effects',
      body: `The quantum-inspired model was recommended in ${quantumGroup.length} experiment(s) where context dependence or order effects were detected.`,
      support: `Observed in: ${quantumGroup.map((e) => `"${e.name}"`).join(', ')}.`,
      evidenceCount: quantumGroup.length,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: uid('ins'),
      kind: 'neutral',
      title: 'No dominant pattern detected',
      body: 'Across the stored experiments, no model family showed a consistent advantage under the selected configurations.',
      support: `Based on ${completed.length} completed experiment(s).`,
      evidenceCount: completed.length,
    });
  }

  return insights.sort((a, b) => b.evidenceCount - a.evidenceCount);
}

export function modelLabel(id: ModelId): string {
  return MODEL_LABELS[id];
}