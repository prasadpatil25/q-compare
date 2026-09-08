import { describe, expect, it } from 'vitest';
import { runCorpusBenchmark } from '../../src/analysis/corpus';

/**
 * Mechanism ablation and bound-width invariance (Sections III-D and IV-E).
 *
 * The quantum-inspired model carries two mechanisms: a context-transformation
 * phase (contextStrength) and a Givens evidence rotation (rotationStrength).
 * Reporting a combined advantage says nothing about which mechanism carries
 * it, so each is pinned to zero in turn by collapsing its search bound.
 * The same mechanism also lets us check that the reported fits are not an
 * artifact of the default bound widths.
 */
describe('mechanism ablation', () => {
  const full = runCorpusBenchmark({ seed: 42 });
  const phaseOnly = runCorpusBenchmark({
    seed: 42,
    bounds: { contextStrength: [-2, 2], rotationStrength: [0, 0] },
  });
  const rotationOnly = runCorpusBenchmark({
    seed: 42,
    bounds: { contextStrength: [0, 0], rotationStrength: [0, 2] },
  });

  it('prints NLL attributable to each mechanism per dataset', () => {
    for (const d of full.datasets) {
      const p = phaseOnly.datasets.find((x) => x.datasetId === d.datasetId)!;
      const r = rotationOnly.datasets.find((x) => x.datasetId === d.datasetId)!;
      const pooled = d.models['classical-pooled'].nll;
      // eslint-disable-next-line no-console
      console.log(
        `${d.datasetId}: pooled=${pooled.toFixed(2)} full=${d.models.quantum.nll.toFixed(2)} ` +
          `phaseOnly=${p.models.quantum.nll.toFixed(2)} rotationOnly=${r.models.quantum.nll.toFixed(2)} | ` +
          `gain_full=${(pooled - d.models.quantum.nll).toFixed(2)} ` +
          `gain_phase=${(pooled - p.models.quantum.nll).toFixed(2)} ` +
          `gain_rotation=${(pooled - r.models.quantum.nll).toFixed(2)}`,
      );
    }
    expect(full.datasets).toHaveLength(6);
  });

  it('neither ablated model ever fits better than the unrestricted model', () => {
    for (const d of full.datasets) {
      const p = phaseOnly.datasets.find((x) => x.datasetId === d.datasetId)!;
      const r = rotationOnly.datasets.find((x) => x.datasetId === d.datasetId)!;
      expect(p.models.quantum.nll).toBeGreaterThanOrEqual(d.models.quantum.nll - 1e-6);
      expect(r.models.quantum.nll).toBeGreaterThanOrEqual(d.models.quantum.nll - 1e-6);
    }
  });
});

/**
 * Bound-width sensitivity. Honest finding, do not weaken to force a pass:
 * the default bounds (cs in [-2,2], rs in [0,2], i.e. phase and rotation each
 * restricted to a quarter turn) are load-bearing. Widening rs to [0,5] admits
 * strictly better optima on every dataset and turns all six 'null'
 * classifications into 'detected'; narrowing to [-1,1]/[0,1] pins cs at the
 * boundary and turns consistency 'null'. The default range is therefore a
 * modeling choice, not a neutral numerical convenience, and the corpus
 * classification is conditional on it.
 */
describe('bound-width sensitivity', () => {
  it('documents that the genuine/null classification is conditional on the search bounds', () => {
    const settings: Array<[string, [number, number], [number, number]]> = [
      ['narrow', [-1, 1], [0, 1]],
      ['default', [-2, 2], [0, 2]],
      ['wide', [-5, 5], [0, 5]],
    ];
    for (const [label, contextStrength, rotationStrength] of settings) {
      const r = runCorpusBenchmark({ seed: 42, bounds: { contextStrength, rotationStrength } });
      const detected = r.datasets.filter((d) => d.advantageClass === 'detected').map((d) => d.datasetId);
      // eslint-disable-next-line no-console
      console.log(`${label}: detected=${detected.length} [${detected.join(', ')}]`);
    }
    // Widening the rotation bound admits better optima everywhere.
    const base = runCorpusBenchmark({ seed: 42 });
    const wide = runCorpusBenchmark({
      seed: 42,
      bounds: { contextStrength: [-5, 5], rotationStrength: [0, 5] },
    });
    for (const d of base.datasets) {
      const w = wide.datasets.find((x) => x.datasetId === d.datasetId)!;
      expect(w.models.quantum.nll).toBeLessThanOrEqual(d.models.quantum.nll + 1e-6);
    }
  });
});
