export type ExperimentCategory =
  | 'Order Effect'
  | 'Disjunction Effect'
  | 'Contextual Decision'
  | 'Sequential Evidence'
  | 'Ambiguity'
  | 'Risk / Uncertainty'
  | 'Classification'
  | 'Real-World Decision'
  | 'Benchmark'
  | 'Custom';

export type ExperimentStatus = 'draft' | 'ready' | 'running' | 'completed';

export type ModelId = 'classical' | 'bayesian' | 'quantum';

export interface Alternative {
  id: string;
  label: string;
  description?: string;
}

export interface Outcome {
  id: string;
  label: string;
  utility: number;
  priorProbability: number;
}

export interface EvidenceItem {
  id: string;
  name: string;
  description?: string;
  value: string;
  confidence: number;
  context: string;
  sequence: number;
  source?: string;
  /** Likelihood vector: probability of observing this evidence given each outcome. */
  likelihood: Record<string, number>;
}

export interface ProblemDefinition {
  decisionQuestion: string;
  alternatives: Alternative[];
  outcomes: Outcome[];
  observedOutcomeId?: string;
  expectedDecisionId?: string;
}

export interface ModelSelection {
  classical: boolean;
  bayesian: boolean;
  quantum: boolean;
}

export interface ClassicalConfig {
  probabilityMethod: 'frequency' | 'conditional';
  utilityMethod: 'expected-utility' | 'max-probability';
}

export interface BayesianConfig {
  priorSource: 'outcome-priors' | 'uniform';
  updateStrategy: 'sequential' | 'batch';
}

export interface QuantumConfig {
  stateRepresentation: 'amplitude-vector';
  amplitudeInit: 'sqrt-prior' | 'uniform';
  contextTransformation: 'unitary-mix' | 'none';
  interferenceMode: 'on' | 'off';
  measurement: 'born-rule';
  rotationStrength: number;
  contextStrength: number;
}

export interface ModelConfigs {
  classical: ClassicalConfig;
  bayesian: BayesianConfig;
  quantum: QuantumConfig;
  qaiWeights: QaiWeights;
}

export interface QaiWeights {
  context: number;
  interference: number;
  errorReduction: number;
  nonCommutativity: number;
  calibration: number;
}

export interface ModelRunResult {
  modelId: ModelId;
  status: 'ok' | 'skipped' | 'error';
  error?: string;
  probabilities: Record<string, number>;
  decision: string;
  decisionLabel: string;
  expectedUtility: number;
  steps: StepTrace[];
  details: Record<string, unknown>;
}

export interface StepTrace {
  label: string;
  formula: string;
  values: Record<string, number>;
  explanation: string;
}

export interface EvaluationMetrics {
  accuracy: number | null;
  logLikelihood: number | null;
  brierScore: number | null;
  calibrationError: number | null;
  predictionError: number | null;
  expectedUtility: number | null;
  complexity: number;
  contextSensitivity: number | null;
  orderEffect: number | null;
  interferenceMeasure: number | null;
  nonCommutativity: number | null;
}

export interface QaiComponents {
  context: number;
  interference: number;
  errorReduction: number;
  nonCommutativity: number;
  calibration: number;
}

export interface QaiResult {
  value: number;
  level: 'low' | 'limited' | 'moderate' | 'strong';
  label: string;
  components: QaiComponents;
  weights: QaiWeights;
  reasons: string[];
  caveats: string[];
}

export interface Recommendation {
  modelId: ModelId;
  reason: string;
}

export interface ExperimentResults {
  ranAt: string;
  durationMs: number;
  models: Record<ModelId, ModelRunResult>;
  metrics: Record<ModelId, EvaluationMetrics>;
  qai: QaiResult;
  recommendation: Recommendation;
  contextAnalysis?: ContextAnalysis;
  orderAnalysis?: OrderAnalysis;
  interferenceAnalysis?: InterferenceAnalysis;
  nonCommutativityAnalysis?: NonCommutativityAnalysis;
}

export interface ContextAnalysis {
  applicable: boolean;
  contexts: string[];
  perContextProbabilities: Record<ModelId, Record<string, Record<string, number>>>;
  sensitivity: Record<ModelId, number>;
}

export interface OrderAnalysis {
  applicable: boolean;
  pairs: Array<{ a: string; b: string; deltaClassical: number | null; deltaQuantum: number | null; deltaP: number }>;
}

export interface InterferenceAnalysis {
  applicable: boolean;
  interference: Record<string, number>;
  total: number;
}

export interface NonCommutativityAnalysis {
  applicable: boolean;
  distance: number;
  orderAB: Record<string, number>;
  orderBA: Record<string, number>;
}

export interface ReproducibilityInfo {
  experimentId: string;
  ranAt: string;
  appVersion: string;
  calculationVersion: string;
  modelVersion: string;
  datasetVersion: string | null;
  seed: number;
  qaiWeights: QaiWeights;
  modelConfigs: ModelConfigs;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  rows: DatasetRow[];
  columns: string[];
}

export interface DatasetRow {
  id: string;
  values: Record<string, string | number>;
}

export interface BenchmarkRun {
  id: string;
  benchmarkId: string;
  ranAt: string;
  experimentId: string;
  qai: number;
  bestModel: ModelId;
}

export interface Benchmark {
  id: string;
  name: string;
  category: ExperimentCategory;
  description: string;
  problem: ProblemDefinition;
  evidence: EvidenceItem[];
  tags: string[];
  quantumOverrides?: { contextStrength: number; rotationStrength: number };
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  researchQuestion: string;
  category: ExperimentCategory;
  datasetId?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  status: ExperimentStatus;
  problem: ProblemDefinition;
  evidence: EvidenceItem[];
  models: ModelSelection;
  config: ModelConfigs;
  results?: ExperimentResults;
  reproducibility?: ReproducibilityInfo;
  isBenchmarkRun?: boolean;
}

export interface AppSettings {
  qaiWeights: QaiWeights;
  seed: number;
}

export interface Insight {
  id: string;
  kind: 'quantum' | 'bayesian' | 'classical' | 'neutral';
  title: string;
  body: string;
  support: string;
  evidenceCount: number;
}

export interface ReportData {
  experiment: Experiment;
  generatedAt: string;
  appVersion: string;
}

export const MODEL_LABELS: Record<ModelId, string> = {
  classical: 'Classical',
  bayesian: 'Bayesian',
  quantum: 'Quantum-Inspired',
};

export const MODEL_COLORS: Record<ModelId, string> = {
  classical: '#3B82F6',
  bayesian: '#10B981',
  quantum: '#7C3AED',
};

export const QAI_LEVELS: Record<QaiResult['level'], { min: number; label: string }> = {
  low: { min: 0, label: 'Low / No demonstrated advantage' },
  limited: { min: 0.25, label: 'Limited advantage' },
  moderate: { min: 0.5, label: 'Moderate advantage' },
  strong: { min: 0.75, label: 'Strong advantage' },
};

export const EXPERIMENT_CATEGORIES: ExperimentCategory[] = [
  'Order Effect',
  'Disjunction Effect',
  'Contextual Decision',
  'Sequential Evidence',
  'Ambiguity',
  'Risk / Uncertainty',
  'Classification',
  'Real-World Decision',
  'Benchmark',
  'Custom',
];

export const APP_VERSION = '1.0.0';
export const CALCULATION_VERSION = '1.0.0';
export const MODEL_VERSION = '1.0.0';