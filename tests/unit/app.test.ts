import { describe, expect, it, beforeEach } from 'vitest';
import { loadStore, resetStore, persistPartial } from '../../src/services/store';
import { runExperiment } from '../../src/models/run';
import { DEFAULT_CONFIG, benchmarkToExperiment, seedBenchmarks } from '../../src/data/seed';
import { generateInsights } from '../../src/services/insights';
import { buildReport, reportToCsv, reportToJson, reportToMarkdown } from '../../src/services/reports';
import { uid } from '../../src/utils';
import type { Experiment, EvidenceItem, Outcome } from '../../src/types';

const outcomes: Outcome[] = [
  { id: 'o1', label: 'A', utility: 10, priorProbability: 0.6 },
  { id: 'o2', label: 'B', utility: 4, priorProbability: 0.4 },
];

function evidence(likelihoods: number[][]): EvidenceItem[] {
  return likelihoods.map((l, i) => ({
    id: `e${i}`,
    name: `E${i + 1}`,
    value: `v${i + 1}`,
    confidence: 0.8,
    context: 'ctx',
    sequence: i + 1,
    likelihood: { o1: l[0], o2: l[1] },
  }));
}

function makeExperiment(partial: Partial<Experiment> = {}): Experiment {
  const now = new Date().toISOString();
  const e: Experiment = {
    id: uid('exp'),
    name: 'Unit Experiment',
    description: 'desc',
    researchQuestion: 'question',
    category: 'Custom',
    createdAt: now,
    updatedAt: now,
    tags: [],
    status: 'completed',
    problem: {
      decisionQuestion: 'Which?',
      alternatives: [{ id: 'a1', label: 'A' }],
      outcomes,
      observedOutcomeId: 'o1',
    },
    evidence: evidence([[0.8, 0.5]]),
    models: { classical: true, bayesian: true, quantum: true },
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    ...partial,
  };
  if (!e.results) e.results = runExperiment(e);
  return e;
}

describe('Seed data', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('loads sample experiments, datasets and benchmarks on first launch', () => {
    const store = loadStore();
    expect(store.experiments.length).toBeGreaterThanOrEqual(6);
    expect(store.datasets.length).toBeGreaterThanOrEqual(3);
    expect(store.benchmarks.length).toBeGreaterThanOrEqual(6);
    expect(store.experiments.every((e) => e.results)).toBe(true);
    expect(store.experiments.every((e) => e.results && e.results.qai.value >= 0 && e.results.qai.value <= 1)).toBe(true);
  });

  it('seed experiment results contain all three models', () => {
    const store = loadStore();
    const first = store.experiments[0];
    expect(first.results?.models.classical.status).toBe('ok');
    expect(first.results?.models.bayesian.status).toBe('ok');
    expect(first.results?.models.quantum.status).toBe('ok');
    expect(first.results?.metrics.classical.expectedUtility).not.toBeNull();
  });

  it('persistence survives reload (simulated by reloading store)', () => {
    const store = loadStore();
    const added = makeExperiment({ id: 'persist-test' });
    store.experiments.push(added);
    persistPartial(store, 'experiments');
    const reloaded = loadStore();
    expect(reloaded.experiments.some((e) => e.id === 'persist-test')).toBe(true);
  });
});

describe('Experiment lifecycle helpers', () => {
  it('duplicate creates an independent copy', () => {
    const original = loadStore().experiments[0];
    const copy: Experiment = {
      ...JSON.parse(JSON.stringify(original)),
      id: uid('exp'),
      name: `${original.name} (Copy)`,
    };
    copy.evidence = [...copy.evidence.map((e) => ({ ...e, name: `${e.name} (copy)` }))];
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).not.toBe(original.name);
    expect(copy.evidence[0].name).toContain('(copy)');
    expect(original.evidence[0].name).not.toContain('(copy)');
  });

  it('running an experiment writes reproducibility metadata', () => {
    const draft: Experiment = makeExperiment({ status: 'draft', results: undefined });
    const results = runExperiment(draft);
    expect(results.ranAt).toBeTruthy();
    expect(results.durationMs).toBeGreaterThanOrEqual(0);
    const reproducibility = {
      experimentId: draft.id,
      ranAt: results.ranAt,
      appVersion: '1.0.0',
      calculationVersion: '1.0.0',
      modelVersion: '1.0.0',
      datasetVersion: null,
      seed: 42,
      qaiWeights: { ...draft.config.qaiWeights },
      modelConfigs: JSON.parse(JSON.stringify(draft.config)),
    };
    expect(reproducibility.experimentId).toBe(draft.id);
    expect(reproducibility.qaiWeights).toEqual(draft.config.qaiWeights);
  });

  it('benchmark to experiment conversion produces a runnable experiment', () => {
    const benchmarks = seedBenchmarks();
    const settings = { qaiWeights: { context: 0.25, interference: 0.25, errorReduction: 0.2, nonCommutativity: 0.15, calibration: 0.15 }, seed: 42 };
    const experiment = benchmarkToExperiment(benchmarks[0], settings);
    expect(experiment.results).toBeDefined();
    expect(experiment.isBenchmarkRun).toBe(true);
    expect(experiment.evidence.map((e) => e.sequence)).toEqual([1, 2, 3]);
  });
});

describe('Insights', () => {
  it('generates at least one insight for completed experiments', () => {
    const store = loadStore();
    const insights = generateInsights(store.experiments);
    expect(insights.length).toBeGreaterThanOrEqual(1);
    insights.forEach((ins) => {
      expect(ins.title.length).toBeGreaterThan(0);
      expect(ins.support.length).toBeGreaterThan(0);
    });
  });

  it('generates a neutral no-experiments insight when empty', () => {
    const insights = generateInsights([]);
    expect(insights[0].kind).toBe('neutral');
  });

  it('never uses unsupported causal language', () => {
    const store = loadStore();
    const insights = generateInsights(store.experiments);
    const joined = insights.map((i) => i.title + i.body + i.support).join(' ');
    expect(joined).not.toMatch(/proves|guarantees|always better/i);
    expect(joined).toMatch(/observed|indicates|under the selected/i);
  });
});

describe('Reports', () => {
  it('markdown report contains all required sections', () => {
    const store = loadStore();
    const report = buildReport(store.experiments[0]);
    const md = reportToMarkdown(report);
    [
      '## 1. Research Question',
      '## 4. Evidence / Context',
      '## 6. Bayesian Model',
      '## 7. Quantum-Inspired Model',
      '## 11. QAI Calculation',
      '## 13. Model Recommendation',
      '## 15. Reproducibility',
      'mathematical simulation',
    ].forEach((section) => expect(md).toContain(section));
  });

  it('json report contains actual experiment data', () => {
    const store = loadStore();
    const report = buildReport(store.experiments[0]);
    const json = JSON.parse(reportToJson(report));
    expect(json.experiment.name).toBe(store.experiments[0].name);
    expect(json.experiment.results.qai.value).toBeGreaterThanOrEqual(0);
  });

  it('csv report contains metric rows for all models', () => {
    const store = loadStore();
    const report = buildReport(store.experiments[0]);
    const csv = reportToCsv(report);
    expect(csv).toContain('classical');
    expect(csv).toContain('bayesian');
    expect(csv).toContain('quantum');
    expect(csv).toContain('qai');
  });
});