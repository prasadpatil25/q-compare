/**
 * Empirical benchmark datasets from the quantum-cognition literature.
 *
 * Disjunction datasets (conditions: known A / known B / unknown):
 *   - Tversky & Shafir (1992) two-stage gambling task (within-subject, N = 98)
 *   - Tversky & Shafir (1992) vacation (Hawaii) task
 *   - Shafir & Tversky (1992) prisoner's dilemma
 *   - Croson (1999), Li & Taplin (2002), Busemeyer, Matthews & Wang,
 *     Hristova & Grinberg (2008), and the four-study average
 *   Sources: Pothos & Busemeyer (2009, Proc. R. Soc. B 276) Tables 1-2;
 *   Moreira & Wichert (2016, Front. Phys. 4:26) Table 1.
 *
 * Question-order datasets (AB / BA joint distributions):
 *   Wang & Busemeyer (2013, Top. Cogn. Sci. 5:689) Table 1; Moore (2002).
 */

import type { DisjunctionDatasetInput } from '../models/fitting/disjunction';
import type { QQDatasetInput } from '../models/fitting/qq';

export interface EmpiricalDisjunctionBenchmark {
  id: string;
  name: string;
  description: string;
  domain: 'disjunction';
  source: string;
  dataset: DisjunctionDatasetInput;
}

export interface EmpiricalQQBenchmark {
  id: string;
  name: string;
  description: string;
  domain: 'question-order';
  source: string;
  dataset: QQDatasetInput;
}

export type EmpiricalBenchmark = EmpiricalDisjunctionBenchmark | EmpiricalQQBenchmark;

export const DISJUNCTION_BENCHMARKS: EmpiricalDisjunctionBenchmark[] = [
  {
    id: 'emp-disj-gambling',
    name: 'Two-Stage Gambling',
    description:
      'Participants decide whether to gamble again after winning, after losing, or with the outcome unknown. Within-subject, N = 98. Classical expectation: 0.64 gamble in the unknown condition; observed: 0.36.',
    domain: 'disjunction',
    source: 'Tversky & Shafir (1992), Psych. Sci. 3(5); Pothos & Busemeyer (2009)',
    dataset: {
      conditionLabels: ['Known win', 'Known loss', 'Unknown'],
      observed: [0.69, 0.59, 0.36],
      nPerCondition: [98, 98, 98],
    },
  },
  {
    id: 'emp-disj-vacation',
    name: 'Vacation (Hawaii) Purchase',
    description:
      'College students decide whether to buy a non-refundable Hawaii trip after passing, after failing, or with the exam result unknown.',
    domain: 'disjunction',
    source: 'Tversky & Shafir (1992), Psych. Sci. 3(5); Pothos & Busemeyer (2009)',
    dataset: {
      conditionLabels: ['Exam passed', 'Exam failed', 'Unknown'],
      observed: [0.54, 0.57, 0.32],
    },
  },
  {
    id: 'emp-disj-pd-st',
    name: 'Prisoner\'s Dilemma (Shafir & Tversky)',
    description:
      'Defection rates when the opponent is known to defect, known to cooperate, or unknown. One of the strongest disjunction effects on record.',
    domain: 'disjunction',
    source: 'Shafir & Tversky (1992), Cogn. Psychol. 24; Pothos & Busemeyer (2009) Table 2',
    dataset: {
      conditionLabels: ['Opponent defects', 'Opponent cooperates', 'Unknown'],
      observed: [0.97, 0.84, 0.63],
    },
  },
  {
    id: 'emp-disj-pd-croson',
    name: 'Prisoner\'s Dilemma (Croson)',
    description: 'Replication with the same paradigm; defection rates under the three conditions.',
    domain: 'disjunction',
    source: 'Croson (1999), Org. Behav. Hum. Decis. Proc.; Pothos & Busemeyer (2009) Table 2',
    dataset: {
      conditionLabels: ['Opponent defects', 'Opponent cooperates', 'Unknown'],
      observed: [0.67, 0.32, 0.3],
    },
  },
  {
    id: 'emp-disj-pd-litaplin',
    name: 'Prisoner\'s Dilemma (Li & Taplin)',
    description: 'Replication with the same paradigm; defection rates under the three conditions.',
    domain: 'disjunction',
    source: 'Li & Taplin (2002); Pothos & Busemeyer (2009) Table 2',
    dataset: {
      conditionLabels: ['Opponent defects', 'Opponent cooperates', 'Unknown'],
      observed: [0.83, 0.66, 0.6],
    },
  },
  {
    id: 'emp-disj-pd-bmw',
    name: 'Prisoner\'s Dilemma (Busemeyer, Matthews & Wang)',
    description: 'Replication with the same paradigm; defection rates under the three conditions.',
    domain: 'disjunction',
    source: 'Busemeyer, Matthews & Wang; Pothos & Busemeyer (2009) Table 2',
    dataset: {
      conditionLabels: ['Opponent defects', 'Opponent cooperates', 'Unknown'],
      observed: [0.91, 0.84, 0.66],
    },
  },
  {
    id: 'emp-disj-pd-hristova',
    name: 'Prisoner\'s Dilemma (Hristova & Grinberg)',
    description: 'Replication with the same paradigm; defection rates under the three conditions.',
    domain: 'disjunction',
    source: 'Hristova & Grinberg (2008); Moreira & Wichert (2016) Table 1',
    dataset: {
      conditionLabels: ['Opponent defects', 'Opponent cooperates', 'Unknown'],
      observed: [0.97, 0.93, 0.88],
    },
  },
  {
    id: 'emp-disj-pd-avg',
    name: 'Prisoner\'s Dilemma (4-study average)',
    description:
      'Average of the four PD studies in Pothos & Busemeyer (2009) Table 2. The published quantum model fit (μ = 0.51) reproduces (.81, .65, .57).',
    domain: 'disjunction',
    source: 'Pothos & Busemeyer (2009), Table 2 average',
    dataset: {
      conditionLabels: ['Opponent defects', 'Opponent cooperates', 'Unknown'],
      observed: [0.84, 0.66, 0.55],
    },
  },
];

export const QQ_BENCHMARKS: EmpiricalQQBenchmark[] = [
  {
    id: 'emp-qq-clintgore',
    name: 'Clint–Gore (consistency)',
    description:
      'Gallup split-ballot survey: "Do you generally think Bill Clinton / Al Gore is honest and trustworthy?" Both orders. The canonical consistency order effect; the QQ equality prediction error was q = −.003.',
    domain: 'question-order',
    source: 'Moore (2002); Wang & Busemeyer (2013) Table 1',
    dataset: {
      id: 'qq-clintgore',
      name: 'Clint–Gore honesty',
      type: 'Consistency',
      source: 'Moore (2002), Gallup split-ballot survey',
      questionA: 'Is Bill Clinton honest and trustworthy?',
      questionB: 'Is Al Gore honest and trustworthy?',
      nAB: 447,
      abCells: [0.4899, 0.0447, 0.1767, 0.2886],
      nBA: 432,
      baCells: [0.5625, 0.1991, 0.0255, 0.213],
    },
  },
  {
    id: 'emp-qq-gingrichdole',
    name: 'Gingrich–Dole (contrast)',
    description:
      'Gallup survey, March 1995: "Do you think Newt Gingrich / Bob Dole is honest and trustworthy?" Contrast order effect (comparative context exaggerates the difference).',
    domain: 'question-order',
    source: 'Moore (2002); Wang & Busemeyer (2013) Table 1',
    dataset: {
      id: 'qq-gingrichdole',
      name: 'Gingrich–Dole honesty',
      type: 'Contrast',
      source: 'Moore (2002), Gallup split-ballot survey',
      questionA: 'Is Newt Gingrich honest and trustworthy?',
      questionB: 'Is Bob Dole honest and trustworthy?',
      nAB: 437,
      abCells: [0.3936, 0.0824, 0.3204, 0.2037],
      nBA: 377,
      baCells: [0.3448, 0.3422, 0.0637, 0.2493],
    },
  },
  {
    id: 'emp-qq-whiteblack',
    name: 'White–Black racial hostility (additive)',
    description:
      'Gallup survey, June 1996: "Do you think that only a few / many / almost all white people dislike blacks?" and the same question about black hostility. Additive order effect.',
    domain: 'question-order',
    source: 'Moore (2002); Wang & Busemeyer (2013) Table 1',
    dataset: {
      id: 'qq-whiteblack',
      name: 'Racial hostility White–Black',
      type: 'Additive',
      source: 'Moore (2002), Gallup split-ballot survey',
      questionA: 'Do whites dislike blacks?',
      questionB: 'Do blacks dislike whites?',
      nAB: 459,
      abCells: [0.3987, 0.0174, 0.1612, 0.4227],
      nBA: 486,
      baCells: [0.4012, 0.0597, 0.1379, 0.4012],
    },
  },
  {
    id: 'emp-qq-rosejackson',
    name: 'Rose–Jackson Hall of Fame (subtractive)',
    description:
      'Gallup survey, July 1999: "Should Pete Rose / Shoeless Joe Jackson be eligible for the Hall of Fame?" Subtractive order effect; the published analysis predicts the QQ model to FAIL here (q = .151, z = 5.30).',
    domain: 'question-order',
    source: 'Moore (2002); Wang & Busemeyer (2013) Table 1',
    dataset: {
      id: 'qq-rosejackson',
      name: 'Rose–Jackson Hall of Fame',
      type: 'Subtractive',
      source: 'Moore (2002), Gallup split-ballot survey',
      questionA: 'Should Pete Rose be eligible for the Hall of Fame?',
      questionB: 'Should Shoeless Joe Jackson be eligible for the Hall of Fame?',
      nAB: 506,
      abCells: [0.3379, 0.3241, 0.0178, 0.3202],
      nBA: 462,
      baCells: [0.4156, 0.0671, 0.1234, 0.3939],
    },
  },
  {
    id: 'emp-qq-lab-race',
    name: 'Racial hostility (lab replication)',
    description:
      'Between-subjects laboratory replication of the White–Black racial hostility pair (Wang & Busemeyer). Replicates the additive effect.',
    domain: 'question-order',
    source: 'Wang & Busemeyer (2013) Table 1, lab experiment',
    dataset: {
      id: 'qq-lab-race',
      name: 'Racial hostility (lab)',
      type: 'Additive (lab)',
      source: 'Wang & Busemeyer (2013) laboratory experiment',
      questionA: 'Do whites dislike blacks?',
      questionB: 'Do blacks dislike whites?',
      nAB: 116,
      abCells: [0.25, 0.0603, 0.2931, 0.3966],
      nBA: 108,
      baCells: [0.3241, 0.0648, 0.213, 0.3981],
    },
  },
  {
    id: 'emp-qq-lab-aa',
    name: 'Affirmative action (lab, race–gender)',
    description:
      'Laboratory replication of Wilson, Moore, McKay & Avery (2008): "Do you favor or oppose affirmative action for racial minorities / women?" Consistency order effect.',
    domain: 'question-order',
    source: 'Wang & Busemeyer (2013) Table 1, lab experiment',
    dataset: {
      id: 'qq-lab-aa',
      name: 'Affirmative action race–gender',
      type: 'Consistency (lab)',
      source: 'Wang & Busemeyer (2013) laboratory experiment',
      questionA: 'Favor affirmative action for racial minorities?',
      questionB: 'Favor affirmative action for women?',
      nAB: 118,
      abCells: [0.4831, 0.0424, 0.161, 0.3136],
      nBA: 106,
      baCells: [0.566, 0.1321, 0.0283, 0.2736],
    },
  },
];

export const EMPIRICAL_BENCHMARKS: EmpiricalBenchmark[] = [
  ...DISJUNCTION_BENCHMARKS,
  ...QQ_BENCHMARKS,
];
