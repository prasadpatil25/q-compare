import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AppSettings,
  Benchmark,
  BenchmarkRun,
  Dataset,
  Experiment,
  Insight,
} from '../types';
import type { EmpiricalBenchmarkRun } from '../services/empirical';
import { runEmpiricalBenchmark } from '../services/empirical';
import type { EmpiricalBenchmark } from '../data/empirical';
import { uid } from '../utils';
import { runExperiment } from '../models/run';
import { loadStore, newId, persist, persistPartial, resetStore, type Store } from '../services/store';
import { benchmarkToExperiment } from '../data/seed';
import { generateInsights } from '../services/insights';

export interface AppStoreApi extends Store {
  addExperiment: (e: Experiment) => Experiment;
  updateExperiment: (id: string, patch: Partial<Experiment>) => void;
  deleteExperiment: (id: string) => void;
  duplicateExperiment: (id: string) => Experiment | undefined;
  runExperimentAction: (id: string) => Experiment | undefined;
  saveDraft: (e: Experiment) => Experiment;
  addDataset: (d: Dataset) => void;
  deleteDataset: (id: string) => void;
  runBenchmark: (benchmark: Benchmark) => Experiment;
  deleteBenchmarkRun: (id: string) => void;
  runEmpiricalBenchmarkAction: (benchmark: EmpiricalBenchmark) => EmpiricalBenchmarkRun;
  deleteEmpiricalRun: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetAll: () => void;
  refreshInsights: () => Insight[];
}

const AppStoreContext = createContext<AppStoreApi | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(() => loadStore());
  const storeRef = useRef(store);
  storeRef.current = store;

  const api = useMemo<AppStoreApi>(() => {
    const commit = (next: Store) => {
      setStore(next);
      persist(next);
    };
    return {
      ...store,

      addExperiment: (e) => {
        const next = { ...store, experiments: [e, ...store.experiments] };
        commit(next);
        return e;
      },

      updateExperiment: (id, patch) => {
        const next = {
          ...store,
          experiments: storeRef.current.experiments.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e,
          ),
        };
        commit(next);
      },

      deleteExperiment: (id) => {
        commit({ ...store, experiments: storeRef.current.experiments.filter((e) => e.id !== id) });
      },

      duplicateExperiment: (id) => {
        const src = storeRef.current.experiments.find((e) => e.id === id);
        if (!src) return undefined;
        const copy: Experiment = {
          ...JSON.parse(JSON.stringify(src)),
          id: newId('exp'),
          name: `${src.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: src.status,
          reproducibility: undefined,
        };
        const next = { ...store, experiments: [copy, ...store.experiments] };
        commit(next);
        return copy;
      },

      runExperimentAction: (id) => {
        const target = storeRef.current.experiments.find((e) => e.id === id);
        if (!target) return undefined;
        const running: Experiment = { ...target, status: 'running', updatedAt: new Date().toISOString() };
        const results = runExperiment(running);
        const completed: Experiment = {
          ...running,
          status: 'completed',
          results,
          updatedAt: new Date().toISOString(),
          reproducibility: {
            experimentId: running.id,
            ranAt: results.ranAt,
            appVersion: '1.0.0',
            calculationVersion: '1.0.0',
            modelVersion: '1.0.0',
            datasetVersion: running.datasetId ? `dataset:${running.datasetId}` : null,
            seed: storeRef.current.settings.seed,
            qaiWeights: { ...running.config.qaiWeights },
            modelConfigs: JSON.parse(JSON.stringify(running.config)),
          },
        };
        const next = {
          ...store,
          experiments: storeRef.current.experiments.map((e) => (e.id === id ? completed : e)),
        };
        commit(next);
        return completed;
      },

      saveDraft: (e) => {
        const exists = storeRef.current.experiments.some((x) => x.id === e.id);
        const next = {
          ...store,
          experiments: exists
            ? storeRef.current.experiments.map((x) => (x.id === e.id ? e : x))
            : [e, ...store.experiments],
        };
        commit(next);
        return e;
      },

      addDataset: (d) => {
        const next = { ...store, datasets: [d, ...store.datasets] };
        commit(next);
      },

      deleteDataset: (id) => {
        commit({ ...store, datasets: storeRef.current.datasets.filter((d) => d.id !== id) });
      },

      runBenchmark: (benchmark) => {
        const experiment = benchmarkToExperiment(benchmark, storeRef.current.settings);
        const run: BenchmarkRun = {
          id: uid('run'),
          benchmarkId: benchmark.id,
          ranAt: experiment.results?.ranAt ?? new Date().toISOString(),
          experimentId: experiment.id,
          qai: experiment.results?.qai.value ?? 0,
          bestModel: experiment.results?.recommendation.modelId ?? 'classical',
        };
        const next = {
          ...store,
          experiments: [experiment, ...store.experiments],
          benchmarkRuns: [run, ...store.benchmarkRuns],
        };
        commit(next);
        return experiment;
      },

      deleteBenchmarkRun: (id) => {
        const run = storeRef.current.benchmarkRuns.find((r) => r.id === id);
        const next = {
          ...store,
          benchmarkRuns: storeRef.current.benchmarkRuns.filter((r) => r.id !== id),
          experiments: run
            ? storeRef.current.experiments.filter((e) => e.id !== run.experimentId)
            : storeRef.current.experiments,
        };
        commit(next);
      },

      runEmpiricalBenchmarkAction: (benchmark) => {
        const run = runEmpiricalBenchmark(benchmark, { seed: storeRef.current.settings.seed });
        const next = { ...store, empiricalRuns: [run, ...storeRef.current.empiricalRuns] };
        commit(next);
        return run;
      },

      deleteEmpiricalRun: (id) => {
        const next = { ...store, empiricalRuns: storeRef.current.empiricalRuns.filter((r) => r.id !== id) };
        commit(next);
      },

      updateSettings: (patch) => {
        const next = { ...store, settings: { ...store.settings, ...patch } };
        commit(next);
      },

      resetAll: () => {
        resetStore();
        const fresh = loadStore();
        setStore(fresh);
        persist(fresh);
      },

      refreshInsights: () => {
        const insights = generateInsights(storeRef.current.experiments);
        const next = { ...store, insights };
        setStore(next);
        persistPartial(next, 'insights');
        return insights;
      },
    };
  }, [store]);

  return <AppStoreContext.Provider value={api}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreApi {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return ctx;
}