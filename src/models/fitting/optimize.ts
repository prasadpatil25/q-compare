/**
 * Deterministic bounded Nelder-Mead optimizer with grid and seeded-random
 * restarts. Used by the empirical fitting engine. No gradients required,
 * reproducible for a given seed (uses `seededRandom` from utils).
 */

import { clamp, seededRandom } from '../../utils';

export interface OptimizeOptions {
  seed?: number;
  /** Number of seeded random restarts on top of the fixed grid. Default 8. */
  restarts?: number;
  /** Shrink tolerance on the simplex scale. Default 1e-8. */
  tolerance?: number;
  /** Maximum iterations per restart. Default 2000. */
  maxIterations?: number;
}

export interface OptimizeResult {
  x: number[];
  value: number;
  iterations: number;
  restarts: number;
  converged: boolean;
}

/** Uniformly spaced grid of starting points per dimension (2 points per dim). */
export function gridStarts(bounds: number[][], perDimension = 3): number[][] {
  const dims = bounds.map(([lo, hi]) => {
    const pts: number[] = [];
    for (let i = 0; i < perDimension; i++) {
      pts.push(lo + ((hi - lo) * i) / Math.max(1, perDimension - 1));
    }
    return pts;
  });
  let starts: number[][] = [[]];
  for (const dim of dims) {
    const next: number[][] = [];
    for (const s of starts) for (const v of dim) next.push([...s, v]);
    starts = next;
  }
  return starts;
}

function nelderMead(
  start: number[],
  bounds: number[][],
  fn: (x: number[]) => number,
  tolerance: number,
  maxIterations: number,
): { x: number[]; value: number; iterations: number } {
  const n = start.length;
  const clamped = start.map((v, i) => clamp(v, bounds[i][0], bounds[i][1]));
  const simplex: { x: number[]; f: number }[] = [clamped].map((x) => ({ x, f: fn(x) }));
  for (let i = 0; i < n; i++) {
    const x = clamped.map((v, j) => {
      if (j === i) {
        const span = bounds[j][1] - bounds[j][0];
        return clamp(v + span * 0.05, bounds[j][0], bounds[j][1]);
      }
      return v;
    });
    simplex.push({ x, f: fn(x) });
  }

  const scale = (): number => {
    let s = 0;
    for (const p of simplex) {
      for (let j = 0; j < n; j++) s += (p.x[j] - simplex[0].x[j]) ** 2;
    }
    return Math.sqrt(s);
  };

  let iterations = 0;
  while (iterations < maxIterations) {
    simplex.sort((a, b) => a.f - b.f);
    if (scale() < tolerance) break;
    iterations++;

    const centroid = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i].x[j];
    }
    for (let j = 0; j < n; j++) centroid[j] /= n;

    const worst = simplex[n];
    const reflect = (alpha: number): number[] =>
      centroid.map((c, j) => clamp(c + alpha * (c - worst.x[j]), bounds[j][0], bounds[j][1]));

    const xr = reflect(1);
    const fr = fn(xr);
    if (fr < simplex[0].f) {
      const xe = reflect(2);
      const fe = fn(xe);
      simplex[n] = { x: fe < fr ? xe : xr, f: Math.min(fe, fr) };
    } else if (fr < simplex[n - 1].f) {
      simplex[n] = { x: xr, f: fr };
    } else {
      const xc = reflect(-0.5);
      const fc = fn(xc);
      if (fc < simplex[n].f) {
        simplex[n] = { x: xc, f: fc };
      } else {
        for (let i = 1; i <= n; i++) {
          const x = simplex[i].x.map((v, j) =>
            clamp(simplex[0].x[j] + 0.5 * (v - simplex[0].x[j]), bounds[j][0], bounds[j][1]),
          );
          simplex[i] = { x, f: fn(x) };
        }
      }
    }
  }

  simplex.sort((a, b) => a.f - b.f);
  return { x: simplex[0].x, value: simplex[0].f, iterations };
}

/**
 * Minimize `fn` over box bounds using Nelder-Mead from multiple starts.
 * The fixed grid covers the box; seeded random restarts are added when
 * `restarts > 0`. Returns the best solution found.
 */
export function minimize(
  fn: (x: number[]) => number,
  bounds: number[][],
  options: OptimizeOptions = {},
): OptimizeResult {
  const tol = options.tolerance ?? 1e-8;
  const maxIterations = options.maxIterations ?? 2000;
  const starts = gridStarts(bounds);

  const rand = seededRandom(options.seed ?? 42);
  for (let r = 0; r < (options.restarts ?? 8); r++) {
    starts.push(
      bounds.map(([lo, hi]) => lo + rand() * (hi - lo)),
    );
  }

  let best: OptimizeResult | null = null;
  let totalIterations = 0;
  for (const start of starts) {
    const res = nelderMead(start, bounds, fn, tol, maxIterations);
    totalIterations += res.iterations;
    if (!best || res.value < best.value) {
      best = {
        x: res.x,
        value: res.value,
        iterations: res.iterations,
        restarts: starts.length,
        converged: res.iterations < maxIterations,
      };
    }
  }

  return { ...best!, iterations: totalIterations };
}

/**
 * Draw a multinomial sample from `counts` (rounded probabilities) using a
 * seeded RNG. Returns integer counts with the same total.
 */
export function resampleCounts(
  proportions: number[],
  total: number,
  rng: () => number,
): number[] {
  const out = new Array<number>(proportions.length).fill(0);
  for (let i = 0; i < total; i++) {
    const u = rng();
    let acc = 0;
    for (let k = 0; k < proportions.length; k++) {
      acc += proportions[k];
      if (u <= acc) {
        out[k]++;
        break;
      }
    }
  }
  return out;
}