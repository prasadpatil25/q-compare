import type {
  AppSettings,
  Benchmark,
  Dataset,
  EvidenceItem,
  Experiment,
  ModelConfigs,
  ModelSelection,
} from '../types';
import { runExperiment, DEFAULT_WEIGHTS } from '../models/run';

export const DEFAULT_CONFIG: ModelConfigs = {
  classical: { probabilityMethod: 'frequency', utilityMethod: 'expected-utility' },
  bayesian: { priorSource: 'outcome-priors', updateStrategy: 'sequential' },
  quantum: {
    stateRepresentation: 'amplitude-vector',
    amplitudeInit: 'sqrt-prior',
    contextTransformation: 'unitary-mix',
    interferenceMode: 'on',
    measurement: 'born-rule',
    rotationStrength: 1,
    contextStrength: 1,
  },
  qaiWeights: DEFAULT_WEIGHTS,
};

export const ALL_MODELS: ModelSelection = { classical: true, bayesian: true, quantum: true };

export function ev(
  name: string,
  value: string,
  confidence: number,
  context: string,
  likelihood: number[],
  id: string,
  description?: string,
  source?: string,
): EvidenceItem {
  const ids = likelihood.map((_, i) => `o${i + 1}`);
  const l: Record<string, number> = {};
  ids.forEach((oid, i) => (l[oid] = likelihood[i]));
  return { id, name, value, confidence, context, sequence: 0, likelihood: l, description, source };
}

function buildExperiment(input: {
  id: string;
  name: string;
  description: string;
  researchQuestion: string;
  category: Experiment['category'];
  datasetId?: string;
  tags: string[];
  decisionQuestion: string;
  alternativeLabels: string[];
  outcomeDefs: Array<{ label: string; utility: number; prior: number }>;
  evidenceItems: EvidenceItem[];
  observed?: number;
  expectedDecision?: number;
  isBenchmarkRun?: boolean;
  daysAgo: number;
  quantumConfig?: { contextStrength: number; rotationStrength: number };
}): Experiment {
  const createdAt = new Date(Date.now() - input.daysAgo * 86400000).toISOString();
  const alternatives = input.alternativeLabels.map((label, i) => ({ id: `a${i + 1}`, label }));
  const outcomes = input.outcomeDefs.map((o, i) => ({
    id: `o${i + 1}`,
    label: o.label,
    utility: o.utility,
    priorProbability: o.prior,
  }));
  input.evidenceItems.forEach((e, i) => (e.sequence = i + 1));

  const experiment: Experiment = {
    id: input.id,
    name: input.name,
    description: input.description,
    researchQuestion: input.researchQuestion,
    category: input.category,
    datasetId: input.datasetId,
    createdAt,
    updatedAt: createdAt,
    tags: input.tags,
    status: 'completed',
    problem: {
      decisionQuestion: input.decisionQuestion,
      alternatives,
      outcomes,
      observedOutcomeId: input.observed != null ? `o${input.observed}` : undefined,
      expectedDecisionId: input.expectedDecision != null ? `o${input.expectedDecision}` : undefined,
    },
    evidence: input.evidenceItems,
    models: { ...ALL_MODELS },
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ModelConfigs,
    isBenchmarkRun: input.isBenchmarkRun,
  };

  if (input.quantumConfig) {
    experiment.config.quantum.contextStrength = input.quantumConfig.contextStrength;
    experiment.config.quantum.rotationStrength = input.quantumConfig.rotationStrength;
  }

  experiment.results = runExperiment(experiment);
  experiment.reproducibility = {
    experimentId: experiment.id,
    ranAt: experiment.results.ranAt,
    appVersion: '1.0.0',
    calculationVersion: '1.0.0',
    modelVersion: '1.0.0',
    datasetVersion: experiment.datasetId ? `dataset:${experiment.datasetId}` : null,
    seed: 42,
    qaiWeights: { ...DEFAULT_WEIGHTS },
    modelConfigs: JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ModelConfigs,
  };
  return experiment;
}

export function seedExperiments(_settings: AppSettings): Experiment[] {
  const exps: Experiment[] = [];

  exps.push(
    buildExperiment({
      id: 'exp_job_offer',
      name: 'Job Offer — Sequential Evidence',
      description:
        'A decision-maker compares two job offers as evidence about salary, remote work, growth and relocation arrives one item at a time.',
      researchQuestion:
        'Does the order in which job-offer evidence is presented change the predicted decision under a quantum-inspired model?',
      category: 'Real-World Decision',
      datasetId: 'ds_jobs',
      tags: ['jobs', 'sequential', 'evidence'],
      daysAgo: 12,
      decisionQuestion: 'Which job offer should the decision-maker accept?',
      alternativeLabels: ['Company Alpha', 'Company Beta'],
      outcomeDefs: [
        { label: 'Accept A', utility: 10, prior: 0.45 },
        { label: 'Accept B', utility: 9, prior: 0.35 },
        { label: 'Reject Both', utility: 2, prior: 0.2 },
      ],
      evidenceItems: [
        ev('Salary', '₹20 LPA', 0.8, 'Compensation', [0.8, 0.5, 0.2], 'ev1', 'Annual salary offer.', 'Offer letter'),
        ev('Remote Work', 'Yes', 0.7, 'Work Style', [0.6, 0.9, 0.3], 'ev2', 'Remote policy.', 'HR policy'),
        ev('Promotion Probability', 'High', 0.6, 'Growth', [0.7, 0.4, 0.25], 'ev3', 'Growth outlook.', 'Manager'),
        ev('Relocation Required', 'No', 0.75, 'Logistics', [0.65, 0.55, 0.3], 'ev4', 'Relocation need.', 'Interview'),
      ],
      observed: 1,
      expectedDecision: 1,
    }),
  );

  exps.push(
    buildExperiment({
      id: 'exp_product_ctx',
      name: 'Product Selection — Contextual Decision',
      description:
        'The same two laptops are evaluated under three different decision contexts: budget, performance, and ecosystem.',
      researchQuestion:
        'Does the context in which the same alternatives are evaluated change the predicted selection, and which model captures that change?',
      category: 'Contextual Decision',
      datasetId: 'ds_laptops',
      tags: ['laptops', 'context'],
      daysAgo: 9,
      decisionQuestion: 'Which laptop should the team select?',
      alternativeLabels: ['Laptop X', 'Laptop Y'],
      outcomeDefs: [
        { label: 'Laptop X', utility: 8, prior: 0.4 },
        { label: 'Laptop Y', utility: 7, prior: 0.35 },
        { label: 'Defer', utility: 3, prior: 0.25 },
      ],
      evidenceItems: [
        ev('Budget Approval', 'Under ₹80k', 0.7, 'Budget', [0.4, 0.85, 0.5], 'ev1', 'Budget constraint.', 'Finance'),
        ev('Benchmark Score', 'High', 0.8, 'Performance', [0.9, 0.5, 0.4], 'ev2', 'Benchmark results.', 'Lab'),
        ev('Ecosystem Fit', 'Team on platform Z', 0.65, 'Ecosystem', [0.55, 0.8, 0.45], 'ev3', 'Ecosystem.', 'Team survey'),
      ],
      observed: 1,
      expectedDecision: 1,
    }),
  );

  exps.push(
    buildExperiment({
      id: 'exp_supplier',
      name: 'Supplier Selection — Bayesian Updating',
      description:
        'A supplier is selected using delivery, cost and quality evidence with a strong prior from past performance.',
      researchQuestion:
        'How does sequential Bayesian updating change the recommended supplier compared with frequency-based and quantum-inspired approaches?',
      category: 'Sequential Evidence',
      datasetId: 'ds_suppliers',
      tags: ['supplier', 'bayesian', 'updating'],
      daysAgo: 7,
      decisionQuestion: 'Which supplier should be selected?',
      alternativeLabels: ['Supplier S1', 'Supplier S2'],
      outcomeDefs: [
        { label: 'Supplier S1', utility: 9, prior: 0.5 },
        { label: 'Supplier S2', utility: 8, prior: 0.3 },
        { label: 'Re-evaluate', utility: 4, prior: 0.2 },
      ],
      evidenceItems: [
        ev('On-time Delivery Rate', '92%', 0.85, 'Delivery', [0.75, 0.45, 0.3], 'ev1', 'Delivery stats.', 'Ops log'),
        ev('Cost Estimate', '4% under target', 0.7, 'Cost', [0.6, 0.7, 0.35], 'ev2', 'Cost estimate.', 'Procurement'),
        ev('Quality Audit', 'Passed', 0.9, 'Quality', [0.85, 0.6, 0.2], 'ev3', 'Audit result.', 'QA team'),
      ],
      observed: 1,
      expectedDecision: 1,
    }),
  );

  exps.push(
    buildExperiment({
      id: 'exp_travel_order',
      name: 'Travel Choice — Order Effect',
      description:
        'The same trip alternatives are evaluated when budget, climate and logistics evidence arrive in different orders.',
      researchQuestion:
        'Is there a measurable order effect in this decision problem, and does the quantum-inspired model detect it?',
      category: 'Order Effect',
      datasetId: 'ds_travel',
      tags: ['travel', 'order-effect'],
      daysAgo: 5,
      decisionQuestion: 'Which destination should the group choose?',
      alternativeLabels: ['Beach Resort', 'Mountain Retreat'],
      outcomeDefs: [
        { label: 'Beach Resort', utility: 8, prior: 0.4 },
        { label: 'Mountain Retreat', utility: 8, prior: 0.4 },
        { label: 'Stay Local', utility: 4, prior: 0.2 },
      ],
      quantumConfig: { contextStrength: 1.8, rotationStrength: 0.7 },
      evidenceItems: [
        ev('Flight Cost', 'Low', 0.9, 'Budget', [0.92, 0.15, 0.3], 'ev1', 'Flight cost.', 'Travel agent'),
        ev('Weather Forecast', 'Sunny', 0.85, 'Climate', [0.78, 0.3, 0.3], 'ev2', 'Forecast.', 'Meteo'),
        ev('Group Size', 'Large', 0.8, 'Logistics', [0.15, 0.85, 0.25], 'ev3', 'Group size.', 'Organizer'),
      ],
      observed: 1,
      expectedDecision: 1,
    }),
  );

  exps.push(
    buildExperiment({
      id: 'exp_tech_risk',
      name: 'Technology Selection — Risk / Uncertainty',
      description:
        'A technology stack is chosen under risk: probabilities are known but utilities and uncertainty vary across alternatives.',
      researchQuestion:
        'Under known probabilities but differing uncertainty profiles, which model family provides the most balanced evaluation?',
      category: 'Risk / Uncertainty',
      tags: ['technology', 'risk'],
      daysAgo: 3,
      decisionQuestion: 'Which technology stack should the team adopt?',
      alternativeLabels: ['Proven Stack', 'Innovative Stack'],
      outcomeDefs: [
        { label: 'Proven Stack', utility: 9, prior: 0.55 },
        { label: 'Innovative Stack', utility: 8, prior: 0.25 },
        { label: 'Hybrid', utility: 6, prior: 0.2 },
      ],
      evidenceItems: [
        ev('Team Experience', 'High on proven stack', 0.8, 'Team', [0.8, 0.3, 0.5], 'ev1', 'Team skills.', 'Team'),
        ev('Hiring Market', 'Favors innovative stack', 0.55, 'Market', [0.4, 0.8, 0.55], 'ev2', 'Market trends.', 'Recruiting'),
        ev('Vendor Support', 'Strong for hybrid', 0.6, 'Vendor', [0.45, 0.5, 0.85], 'ev3', 'Support.', 'Vendors'),
      ],
      observed: 1,
      expectedDecision: 1,
    }),
  );

  exps.push(
    buildExperiment({
      id: 'exp_disjunction',
      name: 'Benchmark — Disjunction Effect',
      description:
        'A purchase decision is evaluated under a known positive rating, a known price drop, and an unknown condition. The observed outcome (decline) illustrates the classic disjunction effect: under an unknown condition, the decision-maker refrains from purchasing even though each known condition favors purchase.',
      researchQuestion:
        'How do the three probability frameworks treat the unknown condition compared with the known conditions?',
      category: 'Disjunction Effect',
      tags: ['disjunction', 'benchmark'],
      daysAgo: 1,
      decisionQuestion: 'Will the consumer purchase the product?',
      alternativeLabels: ['Purchase', 'Decline'],
      outcomeDefs: [
        { label: 'Purchase', utility: 6, prior: 0.5 },
        { label: 'Decline', utility: 4, prior: 0.5 },
      ],
      quantumConfig: { contextStrength: 2.4, rotationStrength: 1.2 },
      evidenceItems: [
        ev('Known Condition A', 'Rating is 4.5 stars', 0.8, 'Known', [0.72, 0.32], 'ev1', 'Product rating.', 'Reviews'),
        ev('Known Condition B', 'Price drop announced', 0.75, 'Known', [0.65, 0.4], 'ev2', 'Price drop.', 'Store'),
        ev('Unknown Condition', 'Coin toss decides bonus', 0.9, 'Unknown', [0.5, 0.5], 'ev3', 'Unknown outcome.', 'Experiment'),
      ],
      observed: 2,
      expectedDecision: 2,
    }),
  );

  return exps;
}

export function seedDatasets(): Dataset[] {
  const now = Date.now();
  return [
    {
      id: 'ds_jobs',
      name: 'Job Offers 2024',
      description: 'Candidate job offer records used by the Job Offer experiment.',
      createdAt: new Date(now - 20 * 86400000).toISOString(),
      columns: ['offer', 'salary', 'remote', 'growth', 'relocation'],
      rows: [
        { id: 'r1', values: { offer: 'Alpha', salary: 20, remote: 'Yes', growth: 'High', relocation: 'No' } },
        { id: 'r2', values: { offer: 'Beta', salary: 18, remote: 'Yes', growth: 'Medium', relocation: 'Yes' } },
        { id: 'r3', values: { offer: 'Gamma', salary: 22, remote: 'No', growth: 'High', relocation: 'No' } },
      ],
    },
    {
      id: 'ds_laptops',
      name: 'Laptop Evaluation',
      description: 'Laptop evaluation scores across budget, performance and ecosystem.',
      createdAt: new Date(now - 15 * 86400000).toISOString(),
      columns: ['model', 'budget', 'benchmark', 'ecosystem'],
      rows: [
        { id: 'r1', values: { model: 'Laptop X', budget: 'Over', benchmark: 92, ecosystem: 'Weak' } },
        { id: 'r2', values: { model: 'Laptop Y', budget: 'Under', benchmark: 71, ecosystem: 'Strong' } },
      ],
    },
    {
      id: 'ds_suppliers',
      name: 'Supplier Evaluation Q3',
      description: 'Supplier performance records for delivery, cost and quality.',
      createdAt: new Date(now - 10 * 86400000).toISOString(),
      columns: ['supplier', 'delivery', 'cost', 'quality'],
      rows: [
        { id: 'r1', values: { supplier: 'S1', delivery: 92, cost: 'Under', quality: 'Pass' } },
        { id: 'r2', values: { supplier: 'S2', delivery: 78, cost: 'Over', quality: 'Pass' } },
        { id: 'r3', values: { supplier: 'S3', delivery: 85, cost: 'At', quality: 'Warn' } },
      ],
    },
    {
      id: 'ds_travel',
      name: 'Travel Options 2024',
      description: 'Travel destination options with cost, weather and group fit.',
      createdAt: new Date(now - 8 * 86400000).toISOString(),
      columns: ['destination', 'cost', 'weather', 'group'],
      rows: [
        { id: 'r1', values: { destination: 'Beach Resort', cost: 'Low', weather: 'Sunny', group: 'Large' } },
        { id: 'r2', values: { destination: 'Mountain Retreat', cost: 'Mid', weather: 'Cloudy', group: 'Small' } },
        { id: 'r3', values: { destination: 'Stay Local', cost: 'Low', weather: 'Any', group: 'Any' } },
      ],
    },
  ];
}

export function seedBenchmarks(): Benchmark[] {
  const mk = (input: Omit<Benchmark, 'tags'> & { tags?: string[] }): Benchmark => ({
    ...input,
    tags: input.tags ?? [],
  });
  return [
    mk({
      id: 'bm_order',
      name: 'Order Effects Benchmark',
      category: 'Order Effect',
      description: 'Repeated evaluation of evidence-order sensitivity across a fixed travel-style decision problem.',
      problem: {
        decisionQuestion: 'Which destination should the group choose?',
        alternatives: [
          { id: 'a1', label: 'Beach Resort' },
          { id: 'a2', label: 'Mountain Retreat' },
        ],
        outcomes: [
          { id: 'o1', label: 'Beach Resort', utility: 8, priorProbability: 0.4 },
          { id: 'o2', label: 'Mountain Retreat', utility: 8, priorProbability: 0.4 },
          { id: 'o3', label: 'Stay Local', utility: 4, priorProbability: 0.2 },
        ],
        observedOutcomeId: 'o1',
      },
      evidence: [
        ev('Flight Cost', 'Low', 0.8, 'Budget', [0.8, 0.3, 0.4], 'ev1'),
        ev('Weather Forecast', 'Sunny', 0.7, 'Climate', [0.7, 0.5, 0.35], 'ev2'),
        ev('Group Size', 'Large', 0.6, 'Logistics', [0.45, 0.75, 0.3], 'ev3'),
      ],
    }),
    mk({
      id: 'bm_context',
      name: 'Context Effects Benchmark',
      category: 'Contextual Decision',
      description: 'The same laptop alternatives evaluated under budget, performance and ecosystem contexts.',
      problem: {
        decisionQuestion: 'Which laptop should the team select?',
        alternatives: [
          { id: 'a1', label: 'Laptop X' },
          { id: 'a2', label: 'Laptop Y' },
        ],
        outcomes: [
          { id: 'o1', label: 'Laptop X', utility: 8, priorProbability: 0.4 },
          { id: 'o2', label: 'Laptop Y', utility: 7, priorProbability: 0.35 },
          { id: 'o3', label: 'Defer', utility: 3, priorProbability: 0.25 },
        ],
        observedOutcomeId: 'o1',
      },
      evidence: [
        ev('Budget Approval', 'Under ₹80k', 0.7, 'Budget', [0.4, 0.85, 0.5], 'ev1'),
        ev('Benchmark Score', 'High', 0.8, 'Performance', [0.9, 0.5, 0.4], 'ev2'),
        ev('Ecosystem Fit', 'Platform Z', 0.65, 'Ecosystem', [0.55, 0.8, 0.45], 'ev3'),
      ],
    }),
    mk({
      id: 'bm_sequential',
      name: 'Sequential Evidence Benchmark',
      category: 'Sequential Evidence',
      description: 'Job-offer style decision updated one evidence item at a time.',
      problem: {
        decisionQuestion: 'Which job offer should the decision-maker accept?',
        alternatives: [
          { id: 'a1', label: 'Company Alpha' },
          { id: 'a2', label: 'Company Beta' },
        ],
        outcomes: [
          { id: 'o1', label: 'Accept A', utility: 10, priorProbability: 0.45 },
          { id: 'o2', label: 'Accept B', utility: 9, priorProbability: 0.35 },
          { id: 'o3', label: 'Reject Both', utility: 2, priorProbability: 0.2 },
        ],
        observedOutcomeId: 'o1',
      },
      evidence: [
        ev('Salary', '₹20 LPA', 0.8, 'Compensation', [0.8, 0.5, 0.2], 'ev1'),
        ev('Remote Work', 'Yes', 0.7, 'Work Style', [0.6, 0.9, 0.3], 'ev2'),
        ev('Promotion Probability', 'High', 0.6, 'Growth', [0.7, 0.4, 0.25], 'ev3'),
        ev('Relocation Required', 'No', 0.75, 'Logistics', [0.65, 0.55, 0.3], 'ev4'),
      ],
    }),
    mk({
      id: 'bm_ambiguity',
      name: 'Ambiguity Benchmark',
      category: 'Ambiguity',
      description: 'Same alternatives with known, partially known, and unknown probability information.',
      problem: {
        decisionQuestion: 'Which project should be funded?',
        alternatives: [
          { id: 'a1', label: 'Project P' },
          { id: 'a2', label: 'Project Q' },
        ],
        outcomes: [
          { id: 'o1', label: 'Fund P', utility: 9, priorProbability: 0.5 },
          { id: 'o2', label: 'Fund Q', utility: 8, priorProbability: 0.3 },
          { id: 'o3', label: 'Defer', utility: 3, priorProbability: 0.2 },
        ],
        observedOutcomeId: 'o1',
      },
      evidence: [
        ev('Known Estimate', 'Success prob = 0.7', 0.8, 'Known', [0.8, 0.5, 0.3], 'ev1'),
        ev('Partial Estimate', 'Success prob = 0.5–0.7', 0.55, 'Partial', [0.6, 0.65, 0.35], 'ev2'),
        ev('Unknown Estimate', 'No reliable data', 0.3, 'Unknown', [0.5, 0.5, 0.5], 'ev3'),
      ],
    }),
    mk({
      id: 'bm_classification',
      name: 'Decision Classification Benchmark',
      category: 'Classification',
      description: 'Classify an incoming document into one of three categories from feature evidence.',
      problem: {
        decisionQuestion: 'How should the document be classified?',
        alternatives: [
          { id: 'a1', label: 'Research Paper' },
          { id: 'a2', label: 'Technical Report' },
        ],
        outcomes: [
          { id: 'o1', label: 'Research Paper', utility: 7, priorProbability: 0.4 },
          { id: 'o2', label: 'Technical Report', utility: 7, priorProbability: 0.35 },
          { id: 'o3', label: 'Proposal', utility: 5, priorProbability: 0.25 },
        ],
        observedOutcomeId: 'o1',
      },
      evidence: [
        ev('Citation Density', 'High', 0.75, 'Features', [0.75, 0.35, 0.3], 'ev1'),
        ev('Section Structure', 'Abstract + Methods', 0.7, 'Features', [0.7, 0.5, 0.35], 'ev2'),
        ev('Funding Mention', 'Grant number present', 0.6, 'Features', [0.5, 0.45, 0.8], 'ev3'),
      ],
    }),
    mk({
      id: 'bm_disjunction',
      name: 'Disjunction Effect Benchmark',
      category: 'Disjunction Effect',
      description: 'Purchase decision under known conditions versus an unknown condition. Demonstrates the classic disjunction effect where the unknown condition changes the decision.',
      problem: {
        decisionQuestion: 'Will the consumer purchase the product?',
        alternatives: [
          { id: 'a1', label: 'Purchase' },
          { id: 'a2', label: 'Decline' },
        ],
        outcomes: [
          { id: 'o1', label: 'Purchase', utility: 6, priorProbability: 0.5 },
          { id: 'o2', label: 'Decline', utility: 4, priorProbability: 0.5 },
        ],
        observedOutcomeId: 'o2',
      },
      evidence: [
        ev('Known Condition A', 'Rating is 4.5 stars', 0.8, 'Known', [0.72, 0.32], 'ev1'),
        ev('Known Condition B', 'Price drop announced', 0.75, 'Known', [0.65, 0.4], 'ev2'),
        ev('Unknown Condition', 'Coin toss decides bonus', 0.9, 'Unknown', [0.5, 0.5], 'ev3'),
      ],
      quantumOverrides: { contextStrength: 2.4, rotationStrength: 1.2 },
    }),
  ];
}

export function benchmarkToExperiment(benchmark: Benchmark, settings: AppSettings): Experiment {
  const createdAt = new Date().toISOString();
  const experiment: Experiment = {
    id: `bmrun_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${benchmark.name} — Run`,
    description: benchmark.description,
    researchQuestion: `Benchmark run: ${benchmark.name}`,
    category: benchmark.category,
    createdAt,
    updatedAt: createdAt,
    tags: [...benchmark.tags, 'benchmark-run'],
    status: 'completed',
    problem: JSON.parse(JSON.stringify(benchmark.problem)),
    evidence: JSON.parse(JSON.stringify(benchmark.evidence)).map((e: EvidenceItem, i: number) => ({
      ...e,
      sequence: i + 1,
    })),
    models: { ...ALL_MODELS },
    config: {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      qaiWeights: { ...settings.qaiWeights },
    } as ModelConfigs,
    isBenchmarkRun: true,
  };
  if (benchmark.quantumOverrides) {
    experiment.config.quantum.contextStrength = benchmark.quantumOverrides.contextStrength;
    experiment.config.quantum.rotationStrength = benchmark.quantumOverrides.rotationStrength;
  }
  experiment.results = runExperiment(experiment);
  experiment.reproducibility = {
    experimentId: experiment.id,
    ranAt: experiment.results.ranAt,
    appVersion: '1.0.0',
    calculationVersion: '1.0.0',
    modelVersion: '1.0.0',
    datasetVersion: null,
    seed: settings.seed,
    qaiWeights: { ...settings.qaiWeights },
    modelConfigs: JSON.parse(JSON.stringify(experiment.config)) as ModelConfigs,
  };
  return experiment;
}