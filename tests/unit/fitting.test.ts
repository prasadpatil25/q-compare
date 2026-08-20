import { describe, expect, it } from 'vitest';
import {
  disjunctionPredictions,
  fitDisjunctionQuantum,
  dissonanceHamiltonian,
} from '../../src/models/fitting/disjunction';
import { evolveUnitary, projectProb } from '../../src/models/fitting/matrix';
import { qqEqualityTest, fitQQModel, fitQQ, similarityIndex, type QQDatasetInput } from '../../src/models/fitting/qq';
import { QQ_BENCHMARKS, DISJUNCTION_BENCHMARKS } from '../../src/data/empirical';
import { fitDisjunction } from '../../src/models/fitting/disjunction';

const SQRT2 = Math.SQRT2;

describe('published validation', () => {
  it('gambling: mu=.59, gamma=1.74*sqrt2 reproduces (.68, .58, .37)', () => {
    const [pW, pL, pI] = disjunctionPredictions(0.59, 1.74 * SQRT2);
    console.log('gambling', pW.toFixed(3), pL.toFixed(3), pI.toFixed(3));
    expect(pW).toBeCloseTo(0.68, 2);
    expect(pL).toBeCloseTo(0.58, 2);
    expect(pI).toBeCloseTo(0.37, 2);
  });

  it('PD average: mu=.51, gamma=2.09*sqrt2 reproduces (.81, .65, .57)', () => {
    const [pD, pC, pU] = disjunctionPredictions(0.51, 2.09 * SQRT2);
    console.log('pd', pD.toFixed(3), pC.toFixed(3), pU.toFixed(3));
    expect(pD).toBeCloseTo(0.81, 2);
    expect(pC).toBeCloseTo(0.65, 2);
    expect(pU).toBeCloseTo(0.57, 2);
  });

  it('paper sanity: H_B only, gamma=1, t=pi/2 concentrates mass on belief-action agreement', () => {
    const HB = dissonanceHamiltonian(1);
    const u = evolveUnitary(HB, [0.5, 0.5, 0.5, 0.5], Math.PI / 2);
    const mags = [0, 1, 2, 3].map((i) => projectProb(u, [i]));
    console.log('sanity', mags.map((m) => m.toFixed(3)).join(', '));
    expect(mags[0]).toBeCloseTo(0.4507, 3);
    expect(mags[1]).toBeCloseTo(0.0493, 3);
    expect(mags[2]).toBeCloseTo(0.0493, 3);
    expect(mags[3]).toBeCloseTo(0.4507, 3);
  });

  it('dephased (gamma=0): unknown = average of knowns, no interference', () => {
    const p = disjunctionPredictions(0.59, 0);
    console.log('dephased', p.map((x) => x.toFixed(3)).join(', '));
    expect(p[2]).toBeCloseTo((p[0] + p[1]) / 2, 10);
    expect(p[0]).toBeCloseTo(1 / 2 + 0.59 / (1 + 0.59 * 0.59), 6);
  });

  it('fit recovers the published gambling pattern', () => {
    const fit = fitDisjunctionQuantum({
      conditionLabels: ['Known win', 'Known loss', 'Unknown'],
      observed: [0.69, 0.59, 0.36],
      nPerCondition: [98, 98, 98],
    });
    console.log('fit params', fit.params, 'predictions', fit.predictions.map((x) => x.toFixed(3)).join(', '));
    expect(fit.params.mu).toBeCloseTo(0.59, 1);
    expect(fit.rmsd).toBeLessThan(0.02);
  });

  it('fit recovers the published PD-average pattern', () => {
    const fit = fitDisjunctionQuantum({
      conditionLabels: ['Opponent defects', 'Opponent cooperates', 'Unknown'],
      observed: [0.84, 0.66, 0.55],
    });
    console.log('pd fit params', fit.params, 'predictions', fit.predictions.map((x) => x.toFixed(3)).join(', '));
    expect(fit.params.mu).toBeCloseTo(0.51, 1);
    expect(fit.rmsd).toBeLessThan(0.03);
  });
});

describe('QQ model validation', () => {
  const dataset = (id: string): QQDatasetInput => {
    const b = QQ_BENCHMARKS.find((x) => x.id === id)!;
    return b.dataset;
  };

  it('Clint-Gore: q = -.0031, z = -.109, h = .8409, chi2 = .0119', () => {
    const d = dataset('emp-qq-clintgore');
    const test = qqEqualityTest(d);
    console.log('clint-gore q', test.q.toFixed(4), 'z', test.z.toFixed(3), 'chi2', test.chiSquare.toFixed(4));
    expect(test.q).toBeCloseTo(-0.0031, 2);
    expect(test.z).toBeCloseTo(-0.109, 1);
    const sim = similarityIndex(d);
    console.log('clint-gore h', sim.h.toFixed(4), 'theta', sim.theta.toFixed(4));
    expect(sim.h).toBeCloseTo(0.8409, 2);
    const fit = fitQQModel(d);
    console.log('clint-gore fit chi2', fit.chiSquare.toFixed(3), 'bicQ', fit.bic.toFixed(1));
    expect(fit.chiSquare).toBeLessThan(1);
  });

  it('Rose-Jackson: q = .1514, z = 5.30, chi2 = 28.57 -> model fails', () => {
    const d = dataset('emp-qq-rosejackson');
    const test = qqEqualityTest(d);
    console.log('rose-jackson q', test.q.toFixed(4), 'z', test.z.toFixed(3), 'chi2', test.chiSquare.toFixed(2));
    expect(test.q).toBeCloseTo(0.1514, 1);
    expect(test.z).toBeCloseTo(5.3026, 0);
    expect(test.significant).toBe(true);
    const fit = fitQQModel(d);
    console.log('rose-jackson fit chi2', fit.chiSquare.toFixed(2));
    expect(fit.chiSquare).toBeGreaterThan(20);
  });

  it('lab race: h = .5521, chi2 = 1.48', () => {
    const d = dataset('emp-qq-lab-race');
    const sim = similarityIndex(d);
    const fit = fitQQModel(d);
    console.log('lab race h', sim.h.toFixed(4), 'fit chi2', fit.chiSquare.toFixed(2));
    expect(sim.h).toBeCloseTo(0.5521, 1);
    expect(fit.chiSquare).toBeLessThan(5);
  });

  it('lab AA (race-gender): h = .8600, chi2 = .69', () => {
    const d = dataset('emp-qq-lab-aa');
    const sim = similarityIndex(d);
    const fit = fitQQModel(d);
    console.log('lab aa h', sim.h.toFixed(4), 'fit chi2', fit.chiSquare.toFixed(2));
    expect(sim.h).toBeCloseTo(0.86, 1);
    expect(fit.chiSquare).toBeLessThan(3);
  });

  it('Gingrich-Dole and White-Black reproduce published z, h and chi2', () => {
    const gd = dataset('emp-qq-gingrichdole');
    const gdTest = qqEqualityTest(gd);
    console.log('gd q', gdTest.q.toFixed(4), 'z', gdTest.z.toFixed(3), 'h', similarityIndex(gd).h.toFixed(4), 'chi2', fitQQModel(gd).chiSquare.toFixed(3));
    expect(gdTest.z).toBeCloseTo(-0.0896, 1);
    expect(similarityIndex(gd).h).toBeCloseTo(0.6634, 1);
    expect(fitQQModel(gd).chiSquare).toBeLessThan(1);

    const wb = dataset('emp-qq-whiteblack');
    const wbTest = qqEqualityTest(wb);
    console.log('wb q', wbTest.q.toFixed(4), 'z', wbTest.z.toFixed(3), 'h', similarityIndex(wb).h.toFixed(4), 'chi2', fitQQModel(wb).chiSquare.toFixed(3));
    expect(wbTest.z).toBeCloseTo(-0.7419, 1);
    expect(similarityIndex(wb).h).toBeCloseTo(0.7866, 1);
    expect(fitQQModel(wb).chiSquare).toBeLessThan(2);
  });

  it('quantum BIC wins on 5 of 6 datasets, loses Rose-Jackson', () => {
    let quantumWins = 0;
    for (const b of QQ_BENCHMARKS) {
      const out = fitQQ(b.dataset);
      const q = out.models.find((m) => m.modelId === 'quantum-qq')!;
      const m = out.models.find((x) => x.modelId === 'markov-qq')!;
      const win = q.bic < m.bic;
      if (win) quantumWins++;
      console.log(b.id, 'quantum bic', q.bic.toFixed(1), 'markov bic', m.bic.toFixed(1), 'q wins', win);
    }
    expect(quantumWins).toBe(5);
  });

  it('all disjunction benchmarks fit with RMSD < .15 and negative model interference', () => {
    for (const b of DISJUNCTION_BENCHMARKS) {
      const out = fitDisjunction(b.dataset);
      const q = out.models.find((m) => m.modelId === 'quantum-disjunction')!;
      console.log(b.id, 'rmsd', q.rmsd.toFixed(3), 'interf', q.interference.toFixed(3), 'mu', q.params.mu.toFixed(2), 'gamma', q.params.gamma.toFixed(2));
      expect(q.rmsd).toBeLessThan(0.15);
      expect(q.interference).toBeLessThan(0);
    }
  });
});