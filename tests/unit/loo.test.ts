import { describe, expect, it } from 'vitest';
import { runLeaveOneOrderOut } from '../../src/analysis/corpus';

/**
 * Leave-one-order-out (LOO) cross-validation (Section III-? of the
 * manuscript). Addresses the "in-sample evaluation" limitation: every
 * family is fit using only one condition's data and scored on the other,
 * which it never saw during fitting.
 */
describe('leave-one-order-out cross-validation', () => {
  it('prints out-of-sample NLL per family per dataset, and fitted quantum params per direction', () => {
    const result = runLeaveOneOrderOut({ seed: 42 });
    for (const d of result.datasets) {
      // eslint-disable-next-line no-console
      console.log(
        `${d.datasetId}: oos(m=${d.oosNll['classical-marginal']}, p=${d.oosNll['classical-pooled']}, b=${d.oosNll.bayesian}, q=${d.oosNll.quantum}) ` +
          `winner=${d.oosWinner} | inSample(p=${d.inSampleNll['classical-pooled']}, q=${d.inSampleNll.quantum}) | ` +
          `quantum trained-on-AB=(${d.quantumParams.trainedOnAB}) trained-on-BA=(${d.quantumParams.trainedOnBA})`,
      );
    }
    // eslint-disable-next-line no-console
    console.log('SUMMARY', JSON.stringify(result.summary));
    expect(result.datasets).toHaveLength(6);
  });

  it('out-of-sample NLL is never lower than in-sample NLL for classical-pooled and quantum (held-out data cannot fit better than data used for training)', () => {
    const result = runLeaveOneOrderOut({ seed: 42 });
    for (const d of result.datasets) {
      expect(d.oosNll['classical-pooled']).toBeGreaterThanOrEqual(d.inSampleNll['classical-pooled'] - 1e-6);
      expect(d.oosNll.quantum).toBeGreaterThanOrEqual(d.inSampleNll.quantum - 1e-6);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = runLeaveOneOrderOut({ seed: 42 });
    const b = runLeaveOneOrderOut({ seed: 42 });
    expect(a).toEqual(b);
  });
});
