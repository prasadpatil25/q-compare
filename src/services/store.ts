import type {
  AppSettings,
  Benchmark,
  BenchmarkRun,
  Dataset,
  Experiment,
  Insight,
} from '../types';
import type { EmpiricalBenchmarkRun } from './empirical';
import { APP_VERSION } from '../types';
import { uid } from '../utils';
import { seedBenchmarks, seedDatasets, seedExperiments } from '../data/seed';
import { generateInsights } from './insights';

const KEYS = {
  experiments: 'qcompare.experiments.v1',
  datasets: 'qcompare.datasets.v1',
  benchmarks: 'qcompare.benchmarks.v1',
  benchmarkRuns: 'qcompare.benchmarkRuns.v1',
  empiricalRuns: 'qcompare.empiricalRuns.v1',
  settings: 'qcompare.settings.v1',
  insights: 'qcompare.insights.v1',
};

export interface Store {
  experiments: Experiment[];
  datasets: Dataset[];
  benchmarks: Benchmark[];
  benchmarkRuns: BenchmarkRun[];
  empiricalRuns: EmpiricalBenchmarkRun[];
  settings: AppSettings;
  insights: Insight[];
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — app continues in memory
  }
}

export function emptyStore(): Store {
  return {
    experiments: [],
    datasets: [],
    benchmarks: [],
    benchmarkRuns: [],
    empiricalRuns: [],
    settings: {
      qaiWeights: { context: 0.25, interference: 0.25, errorReduction: 0.2, nonCommutativity: 0.15, calibration: 0.15 },
      seed: 42,
    },
    insights: [],
  };
}

let seeded = false;

export function loadStore(): Store {
  const store = emptyStore();
  store.experiments = load(KEYS.experiments, []);
  store.datasets = load(KEYS.datasets, []);
  store.benchmarks = load(KEYS.benchmarks, []);
  store.benchmarkRuns = load(KEYS.benchmarkRuns, []);
  store.empiricalRuns = load(KEYS.empiricalRuns, []);
  store.settings = load(KEYS.settings, store.settings);
  store.insights = load(KEYS.insights, []);

  if (!seeded && store.experiments.length === 0 && store.datasets.length === 0) {
    const seededExperiments = seedExperiments(store.settings);
    store.experiments = seededExperiments;
    store.datasets = seedDatasets();
    store.benchmarks = seedBenchmarks();
    store.insights = generateInsights(store.experiments);
    seeded = true;
    persist(store);
  } else if (store.benchmarks.length === 0) {
    store.benchmarks = seedBenchmarks();
    persist(store);
  }

  return store;
}

export function persist(store: Store): void {
  save(KEYS.experiments, store.experiments);
  save(KEYS.datasets, store.datasets);
  save(KEYS.benchmarks, store.benchmarks);
  save(KEYS.benchmarkRuns, store.benchmarkRuns);
  save(KEYS.empiricalRuns, store.empiricalRuns);
  save(KEYS.settings, store.settings);
  save(KEYS.insights, store.insights);
}

export function persistPartial<K extends keyof Store>(store: Store, key: K): void {
  switch (key) {
    case 'experiments':
      save(KEYS.experiments, store.experiments);
      break;
    case 'datasets':
      save(KEYS.datasets, store.datasets);
      break;
    case 'benchmarks':
      save(KEYS.benchmarks, store.benchmarks);
      break;
    case 'benchmarkRuns':
      save(KEYS.benchmarkRuns, store.benchmarkRuns);
      break;
    case 'empiricalRuns':
      save(KEYS.empiricalRuns, store.empiricalRuns);
      break;
    case 'settings':
      save(KEYS.settings, store.settings);
      break;
    case 'insights':
      save(KEYS.insights, store.insights);
      break;
  }
}

export function newId(prefix: string): string {
  return uid(prefix);
}

export function appVersion(): string {
  return APP_VERSION;
}

export function resetStore(): void {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  seeded = false;
}