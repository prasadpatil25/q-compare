/**
 * Linear-algebra primitives for the empirical fitting engine.
 *
 * All routines are deterministic, dependency-free implementations that
 * operate on real symmetric matrices (the Hamiltonians used in the
 * quantum-inspired decision models are real and symmetric).
 *
 * Conventions:
 *   - A matrix is `number[][]` (row-major).
 *   - A complex vector is `ComplexVec` = array of `{ re, im }`.
 */

export interface Complex {
  re: number;
  im: number;
}

export type ComplexVec = Complex[];

export const SQRT1_2 = Math.SQRT1_2;

/**
 * Jacobi eigenvalue algorithm for real symmetric matrices.
 * Returns eigenvalues (ascending) and eigenvectors as columns of `vectors`.
 * Deterministic and accurate to ~1e-14 for well-conditioned matrices.
 */
export function symmetricEig(
  A: number[][],
): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const a = A.map((r) => r.slice());
  const vectors = Array.from({ length: n }, (_, i) => {
    const row = new Array(n).fill(0) as number[];
    row[i] = 1;
    return row;
  });

  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p][q];
        if (Math.abs(apq) < 1e-16) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * apq);
        const t =
          theta === 0
            ? 1
            : Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          if (k === p || k === q) continue;
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          if (k === p || k === q) continue;
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = vectors[k][p];
          const vkq = vectors[k][q];
          vectors[k][p] = c * vkp - s * vkq;
          vectors[k][q] = s * vkp + c * vkq;
        }
        const app = a[p][p];
        const aqq = a[q][q];
        a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
        a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
        a[p][q] = 0;
        a[q][p] = 0;
      }
    }
  }

  return { values: a.map((r, i) => r[i]), vectors };
}

/**
 * Compute u = exp(-i·t·H)·ψ for a real symmetric Hamiltonian H.
 *
 * Uses the spectral decomposition H = V·diag(λ)·Vᵀ, so
 *   exp(-i·t·H)·ψ = V·diag(e^{-i·t·λ})·Vᵀ·ψ
 * computed in complex arithmetic. This is the unitary Schrödinger
 * evolution used by the quantum-inspired decision models.
 */
export function evolveUnitary(H: number[][], psi: number[], t: number): ComplexVec {
  const n = psi.length;
  const { values, vectors: V } = symmetricEig(H);
  const z = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += V[k][i] * psi[k];
    z[i] = s;
  }
  const u: ComplexVec = Array.from({ length: n }, () => ({ re: 0, im: 0 }));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const c = Math.cos(t * values[j]);
      const s = Math.sin(t * values[j]);
      const wRe = c * z[j];
      const wIm = -s * z[j];
      u[i].re += V[i][j] * wRe;
      u[i].im += V[i][j] * wIm;
    }
  }
  return u;
}

/** Squared modulus of a complex vector component: P = |uᵢ|². */
export function probOf(u: ComplexVec, index: number): number {
  return u[index].re * u[index].re + u[index].im * u[index].im;
}

/** Projection probability of u onto a subspace spanned by `indices`: Σ|uᵢ|². */
export function projectProb(u: ComplexVec, indices: number[]): number {
  let p = 0;
  for (const i of indices) p += probOf(u, i);
  return p;
}

/** Inner product of two complex vectors: Σ uᵢ*·vᵢ (conjugate of u). */
export function complexInner(u: ComplexVec, v: ComplexVec): Complex {
  let re = 0;
  let im = 0;
  for (let i = 0; i < u.length; i++) {
    re += u[i].re * v[i].re + u[i].im * v[i].im;
    im += u[i].re * v[i].im - u[i].im * v[i].re;
  }
  return { re, im };
}

/** Real part of the interference cross-term Re(Σᵢ uᵢ*·vᵢ) over selected indices. */
export function interferenceTerm(u: ComplexVec, v: ComplexVec, indices: number[]): number {
  let re = 0;
  for (const i of indices) {
    re += u[i].re * v[i].re + u[i].im * v[i].im;
  }
  return re;
}

// ---------------------------------------------------------------------------
// General matrix exponential (real square matrices)
// ---------------------------------------------------------------------------

export function identity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => {
    const row = new Array<number>(n).fill(0);
    row[i] = 1;
    return row;
  });
}

/** C = A·B for square matrices (row-major, no dimension checks by convention). */
export function matmul(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const C = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      const Bk = B[k];
      for (let j = 0; j < n; j++) C[i][j] += aik * Bk[j];
    }
  }
  return C;
}

/** B = A + s·B (in place), used by Padé evaluation. */
function axpy(A: number[][], s: number, B: number[][]): void {
  const n = A.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B[i][j] += s * A[i][j];
}

/** Inverse of a square matrix via Gauss-Jordan elimination with partial pivoting. */
export function inverse(A: number[][]): number[][] {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...identity(n)[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-300) {
      throw new Error('matrix is singular: expm Padé denominator not invertible');
    }
    if (piv !== col) [M[piv], M[col]] = [M[col], M[piv]];
    const d = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row.slice(n));
}

/**
 * Matrix exponential exp(A) of a real square matrix.
 *
 * Scaling-and-squaring with the Padé [6/6] approximant: the input is scaled
 * by 2^s so that ‖A/2^s‖₁ ≤ 1/2 (where the [6/6] error is below machine
 * precision), the approximant is evaluated by Horner's rule, then the result
 * is squared s times. Deterministic; exact for diagonal inputs up to
 * floating-point error.
 */
export function expm(A: number[][]): number[][] {
  const n = A.length;

  let norm1 = 0;
  for (let j = 0; j < n; j++) {
    let col = 0;
    for (let i = 0; i < n; i++) col += Math.abs(A[i][j]);
    norm1 = Math.max(norm1, col);
  }
  if (norm1 === 0) return identity(n);

  const s = Math.max(0, Math.ceil(Math.log2(norm1 / 0.5)));
  const As = A.map((row) => row.map((v) => v / 2 ** s));

  const I = identity(n);
  const A2 = matmul(As, As);
  const A3 = matmul(A2, As);
  const A4 = matmul(A2, A2);
  const A5 = matmul(A4, As);
  const A6 = matmul(A3, A3);

  // Padé [6/6]: exp(x) ≈ N(x)/N(-x),
  // N(x) = 1 + x/2 + 5x²/44 + x³/66 + x⁴/792 + x⁵/15840 + x⁶/665280
  const mkN = (sign: 1 | -1): number[][] => {
    const N = I.map((row) => row.slice());
    axpy(As, sign / 2, N);
    axpy(A2, 5 / 44, N);
    axpy(A3, sign / 66, N);
    axpy(A4, 1 / 792, N);
    axpy(A5, sign / 15840, N);
    axpy(A6, 1 / 665280, N);
    return N;
  };

  const N = mkN(1);
  const D = mkN(-1);
  const E = matmul(N, inverse(D));
  for (let k = 0; k < s; k++) {
    const E2 = matmul(E, E);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) E[i][j] = E2[i][j];
  }
  return E;
}