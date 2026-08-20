import { describe, expect, it } from 'vitest';
import { expm, identity, inverse, matmul, symmetricEig } from '../../src/models/fitting/matrix';
import { minimize, resampleCounts, gridStarts } from '../../src/models/fitting/optimize';
import { seededRandom } from '../../src/utils';

const close = (a: number[][], b: number[][], tol = 1e-10) => {
  expect(a.length).toBe(b.length);
  a.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(b[i][j], tol === 0 ? 10 : 10)));
};

describe('expm', () => {
  it('exp(0) is the identity', () => {
    const Z = [
      [0, 0],
      [0, 0],
    ];
    close(expm(Z), identity(2));
  });

  it('exp of a diagonal matrix is elementwise exp', () => {
    const D = [
      [1, 0, 0],
      [0, -2, 0],
      [0, 0, 0.5],
    ];
    const E = expm(D);
    expect(E[0][0]).toBeCloseTo(Math.exp(1), 12);
    expect(E[1][1]).toBeCloseTo(Math.exp(-2), 12);
    expect(E[2][2]).toBeCloseTo(Math.exp(0.5), 12);
    expect(E[0][1]).toBeCloseTo(0, 12);
  });

  it('exp of a 2x2 Pauli-X matrix has the known closed form', () => {
    const X = [
      [0, 1],
      [1, 0],
    ];
    // exp([[0,1],[1,0]]) = [[cosh 1, sinh 1],[sinh 1, cosh 1]]
    const E = expm(X);
    expect(E[0][0]).toBeCloseTo(Math.cosh(1), 12);
    expect(E[0][1]).toBeCloseTo(Math.sinh(1), 12);
    expect(E[1][0]).toBeCloseTo(Math.sinh(1), 12);
    expect(E[1][1]).toBeCloseTo(Math.cosh(1), 12);
  });

  it('exp(A)·exp(-A) = I', () => {
    const A = [
      [0.8, -0.3, 0.2],
      [0.1, -1.2, 0.4],
      [-0.5, 0.6, 0.9],
    ];
    const Ep = expm(A);
    const Em = expm(A.map((r) => r.map((v) => -v)));
    close(matmul(Ep, Em), identity(3), 1e-9);
  });

  it('expm commutes with the spectral method for symmetric inputs', () => {
    const H = [
      [1, 0.5, -0.2],
      [0.5, -1, 0.3],
      [-0.2, 0.3, 0.7],
    ];
    const { values, vectors: V } = symmetricEig(H);
    const viaSpectral = V.map((_, i) => V[i].map((_, j) => {
      let s = 0;
      for (let k = 0; k < 3; k++) s += V[i][k] * Math.exp(values[k]) * V[j][k];
      return s;
    }));
    close(expm(H), viaSpectral, 1e-9);
  });

  it('matches the Taylor expansion for small arguments', () => {
    const A = [
      [0.05, -0.02],
      [0.03, 0.01],
    ];
    const E = expm(A);
    const I = identity(2);
    const A2 = matmul(A, A);
    const A3 = matmul(A2, A);
    // exp(A) ≈ I + A + A²/2 + A³/6 (error ~ ‖A‖⁴/24 ≈ 1e-4)
    const T = [
      [0, 0],
      [0, 0],
    ];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        T[i][j] = I[i][j] + A[i][j] + A2[i][j] / 2 + A3[i][j] / 6;
        expect(E[i][j]).toBeCloseTo(T[i][j], 3);
      }
    }
  });
});

describe('inverse / matmul', () => {
  it('A·A⁻¹ = I', () => {
    const A = [
      [4, 7, 2],
      [2, 6, 1],
      [3, 1, 5],
    ];
    close(matmul(A, inverse(A)), identity(3), 1e-10);
  });

  it('inverse of the identity is the identity', () => {
    close(inverse(identity(3)), identity(3), 1e-12);
  });

  it('throws on a singular matrix', () => {
    const S = [
      [1, 2],
      [2, 4],
    ];
    expect(() => inverse(S)).toThrow(/singular/);
  });
});

describe('Nelder-Mead minimize', () => {
  it('finds the minimum of a simple quadratic', () => {
    const res = minimize(
      (x) => (x[0] - 1) ** 2 + 2 * (x[1] + 2) ** 2,
      [
        [-5, 5],
        [-5, 5],
      ],
      { restarts: 4 },
    );
    expect(res.x[0]).toBeCloseTo(1, 4);
    expect(res.x[1]).toBeCloseTo(-2, 4);
    expect(res.value).toBeLessThan(1e-6);
  });

  it('respects box bounds', () => {
    const res = minimize(
      (x) => (x[0] - 1) ** 2 + (x[1] + 3) ** 2,
      [
        [0, 0.5],
        [-2, 2],
      ],
      { restarts: 4 },
    );
    expect(res.x[0]).toBe(0.5);
    expect(res.x[1]).toBeCloseTo(-2, 4);
  });

  it('solves the Rosenbrock valley', () => {
    const res = minimize(
      (x) => (1 - x[0]) ** 2 + 100 * (x[1] - x[0] * x[0]) ** 2,
      [
        [-2, 2],
        [-2, 2],
      ],
      { restarts: 12, tolerance: 1e-10 },
    );
    expect(res.value).toBeLessThan(1e-8);
  });

  it('is deterministic for a fixed seed', () => {
    const f = (x: number[]) => Math.sin(x[0]) * Math.cos(x[1]) + (x[0] - 0.3) ** 2 + (x[1] + 1.1) ** 2;
    const a = minimize(f, [[-3, 3], [-3, 3]], { seed: 7, restarts: 6 });
    const b = minimize(f, [[-3, 3], [-3, 3]], { seed: 7, restarts: 6 });
    expect(a.x).toEqual(b.x);
    expect(a.value).toEqual(b.value);
  });

  it('gridStarts covers the box corners', () => {
    const g = gridStarts([[0, 1], [0, 1]], 2);
    expect(g).toContainEqual([0, 0]);
    expect(g).toContainEqual([1, 1]);
  });
});

describe('resampleCounts', () => {
  it('preserves the total and stays within bounds', () => {
    const rng = seededRandom(42);
    const out = resampleCounts([0.3, 0.5, 0.2], 1000, rng);
    expect(out.reduce((a, b) => a + b, 0)).toBe(1000);
    for (const c of out) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1000);
    }
  });

  it('is reproducible for a fixed seed', () => {
    const a = resampleCounts([0.25, 0.75], 500, seededRandom(1));
    const b = resampleCounts([0.25, 0.75], 500, seededRandom(1));
    expect(a).toEqual(b);
  });
});