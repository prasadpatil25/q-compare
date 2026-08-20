/**
 * Empirical benchmark service: runs the disjunction and question-order
 * pipelines over the published literature datasets and formats results
 * for storage and display.
 */

import type { DisjunctionFitOutput, DisjunctionDatasetInput } from '../models/fitting/disjunction';
import { fitDisjunction } from '../models/fitting/disjunction';
import type { QQFitOutput, QQDatasetInput } from '../models/fitting/qq';
import { fitQQ } from '../models/fitting/qq';
import type { EmpiricalBenchmark } from '../data/empirical';

export interface DisjunctionBenchmarkRun {
  id: string;
  benchmarkId: string;
  domain: 'disjunction';
  ranAt: string;
  seed: number;
  dataset: DisjunctionDatasetInput;
  output: DisjunctionFitOutput;
}

export interface QQBenchmarkRun {
  id: string;
  benchmarkId: string;
  domain: 'question-order';
  ranAt: string;
  seed: number;
  dataset: QQDatasetInput;
  output: QQFitOutput;
}

export type EmpiricalBenchmarkRun = DisjunctionBenchmarkRun | QQBenchmarkRun;

/** Run a single empirical benchmark (disjunction or question-order). */
export function runEmpiricalBenchmark(
  benchmark: EmpiricalBenchmark,
  options: { seed?: number; id?: string } = {},
): EmpiricalBenchmarkRun {
  const seed = options.seed ?? 42;
  const ranAt = new Date().toISOString();
  if (benchmark.domain === 'disjunction') {
    return {
      id: options.id ?? `emp-run-${Date.now()}`,
      benchmarkId: benchmark.id,
      domain: 'disjunction',
      ranAt,
      seed,
      dataset: benchmark.dataset,
      output: fitDisjunction(benchmark.dataset, { seed }),
    };
  }
  return {
    id: options.id ?? `emp-run-${Date.now()}`,
    benchmarkId: benchmark.id,
    domain: 'question-order',
    ranAt,
    seed,
    dataset: benchmark.dataset,
    output: fitQQ(benchmark.dataset, { seed }),
  };
}

/** Run all empirical benchmarks of a given domain. */
export function runAllEmpirical(
  benchmarks: EmpiricalBenchmark[],
  options: { seed?: number } = {},
): EmpiricalBenchmarkRun[] {
  return benchmarks.map((b) => runEmpiricalBenchmark(b, options));
}
