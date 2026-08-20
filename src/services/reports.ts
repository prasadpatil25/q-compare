import type { Experiment, ModelId, ReportData } from '../types';
import { APP_VERSION, MODEL_LABELS } from '../types';
import { downloadFile, formatDateTime } from '../utils';

/**
 * Research-style report generation. The report always states that the
 * quantum-inspired model is a mathematical simulation.
 */
export function buildReport(experiment: Experiment): ReportData {
  return {
    experiment,
    generatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
  };
}

function pct(v: number | null | undefined): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

function metricsTable(experiment: Experiment): string {
  const results = experiment.results;
  if (!results) return '_No results available._';
  const ids = (['classical', 'bayesian', 'quantum'] as ModelId[]).filter(
    (id) => results.models[id].status === 'ok',
  );
  const rows = [
    ['Metric', ...ids.map((id) => MODEL_LABELS[id])],
    ['Accuracy', ...ids.map((id) => pct(results.metrics[id].accuracy))],
    ['Prediction Error', ...ids.map((id) => pct(results.metrics[id].predictionError))],
    ['Calibration Error', ...ids.map((id) => pct(results.metrics[id].calibrationError))],
    ['Brier Score', ...ids.map((id) => results.metrics[id].brierScore?.toFixed(4) ?? '—')],
    ['Log-Likelihood', ...ids.map((id) => results.metrics[id].logLikelihood?.toFixed(4) ?? '—')],
    ['Expected Utility', ...ids.map((id) => results.metrics[id].expectedUtility?.toFixed(4) ?? '—')],
    ['Complexity', ...ids.map((id) => String(results.metrics[id].complexity))],
    ['Context Sensitivity', ...ids.map((id) => pct(results.metrics[id].contextSensitivity))],
    ['Order Effect (ΔP)', ...ids.map((id) => pct(results.metrics[id].orderEffect))],
    ['Interference Measure', ...ids.map((id) => results.metrics[id].interferenceMeasure?.toFixed(4) ?? 'N/A')],
    ['Non-Commutativity', ...ids.map((id) => results.metrics[id].nonCommutativity?.toFixed(4) ?? 'N/A')],
  ];
  return rows
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');
}

export function reportToMarkdown(report: ReportData): string {
  const e = report.experiment;
  const r = e.results;
  const lines: string[] = [];
  lines.push(`# ${e.name}`);
  lines.push('');
  lines.push(`> Generated ${formatDateTime(report.generatedAt)} — Q-Compare v${report.appVersion}`);
  lines.push('');
  lines.push('## 1. Research Question');
  lines.push('');
  lines.push(e.researchQuestion || '_Not provided_');
  lines.push('');
  lines.push('## 2. Problem Definition');
  lines.push('');
  lines.push(`**Decision question:** ${e.problem.decisionQuestion}`);
  lines.push('');
  lines.push(`**Alternatives:** ${e.problem.alternatives.map((a) => a.label).join(', ')}`);
  lines.push('');
  lines.push('| Outcome | Utility | Prior |');
  lines.push('|---|---|---|');
  e.problem.outcomes.forEach((o) =>
    lines.push(`| ${o.label} | ${o.utility} | ${pct(o.priorProbability)} |`),
  );
  lines.push('');
  lines.push(`**Observed outcome:** ${e.problem.outcomes.find((o) => o.id === e.problem.observedOutcomeId)?.label ?? '—'}`);
  lines.push('');
  lines.push('## 3. Dataset');
  lines.push('');
  lines.push(e.datasetId ? `Dataset: \`${e.datasetId}\`` : '_No dataset attached._');
  lines.push('');
  lines.push('## 4. Evidence / Context');
  lines.push('');
  if (e.evidence.length === 0) {
    lines.push('_No evidence defined._');
  } else {
    lines.push('| # | Name | Value | Confidence | Context |');
    lines.push('|---|---|---|---|---|');
    e.evidence.forEach((ev) =>
      lines.push(`| ${ev.sequence} | ${ev.name} | ${ev.value} | ${pct(ev.confidence)} | ${ev.context} |`),
    );
  }
  lines.push('');
  lines.push('## 5. Classical Model');
  lines.push('');
  if (r && r.models.classical.status === 'ok') {
    lines.push(`**Decision:** ${r.models.classical.decisionLabel} — **Expected utility:** ${r.models.classical.expectedUtility.toFixed(4)}`);
    lines.push('');
    lines.push('**Probabilities:**');
    lines.push('');
    e.problem.outcomes.forEach((o) => lines.push(`- P(${o.label}) = ${pct(r.models.classical.probabilities[o.id])}`));
    lines.push('');
    lines.push(`**Method:** ${e.config.classical.probabilityMethod} / ${e.config.classical.utilityMethod}`);
  } else {
    lines.push('_Not run._');
  }
  lines.push('');
  lines.push('## 6. Bayesian Model');
  lines.push('');
  if (r && r.models.bayesian.status === 'ok') {
    lines.push(`**Decision:** ${r.models.bayesian.decisionLabel} — **Expected utility:** ${r.models.bayesian.expectedUtility.toFixed(4)}`);
    lines.push('');
    lines.push('**Probabilities:**');
    lines.push('');
    e.problem.outcomes.forEach((o) => lines.push(`- P(${o.label}) = ${pct(r.models.bayesian.probabilities[o.id])}`));
    lines.push('');
    lines.push(`**Prior source:** ${e.config.bayesian.priorSource} — **Update:** ${e.config.bayesian.updateStrategy}`);
  } else {
    lines.push('_Not run._');
  }
  lines.push('');
  lines.push('## 7. Quantum-Inspired Model');
  lines.push('');
  lines.push('> **Important:** the quantum-inspired model is a mathematical simulation of quantum-probability formalism. It does not run on a quantum computer.');
  lines.push('');
  if (r && r.models.quantum.status === 'ok') {
    lines.push(`**Decision:** ${r.models.quantum.decisionLabel} — **Expected utility:** ${r.models.quantum.expectedUtility.toFixed(4)}`);
    lines.push('');
    lines.push('**Probabilities:**');
    lines.push('');
    e.problem.outcomes.forEach((o) => lines.push(`- P(${o.label}) = ${pct(r.models.quantum.probabilities[o.id])}`));
    lines.push('');
    lines.push(`**Amplitudes:** ${String(r.models.quantum.details.amplitudeText ?? '—')}`);
    lines.push('');
    lines.push(`**Total interference:** ${pct(r.models.quantum.details.totalInterference as number | undefined)}`);
    lines.push('');
    lines.push(`**State representation:** ${e.config.quantum.stateRepresentation} — **Interference mode:** ${e.config.quantum.interferenceMode}`);
  } else {
    lines.push('_Not run._');
  }
  lines.push('');
  lines.push('## 8. Model Parameters');
  lines.push('');
  lines.push(`- Classical: \`${JSON.stringify(e.config.classical)}\``);
  lines.push(`- Bayesian: \`${JSON.stringify(e.config.bayesian)}\``);
  lines.push(`- Quantum: \`${JSON.stringify(e.config.quantum)}\``);
  lines.push('');
  lines.push('## 9. Probability Distributions');
  lines.push('');
  lines.push(metricsTable(e));
  lines.push('');
  lines.push('## 10. Evaluation Metrics');
  lines.push('');
  lines.push(metricsTable(e));
  lines.push('');
  lines.push('## 11. QAI Calculation');
  lines.push('');
  if (r) {
    lines.push(`**QAI = ${r.qai.value.toFixed(3)}** — ${r.qai.label}`);
    lines.push('');
    lines.push('| Component | Value | Weight |');
    lines.push('|---|---|---|');
    (Object.keys(r.qai.components) as Array<keyof typeof r.qai.components>).forEach((k) =>
      lines.push(`| ${k} | ${r.qai.components[k].toFixed(4)} | ${r.qai.weights[k].toFixed(2)} |`),
    );
    lines.push('');
    lines.push('**Reasons:**');
    lines.push('');
    r.qai.reasons.forEach((reason) => lines.push(`- ${reason}`));
    lines.push('');
    lines.push('**Caveats:**');
    lines.push('');
    r.qai.caveats.forEach((c) => lines.push(`- ${c}`));
  }
  lines.push('');
  lines.push('## 12. Comparative Results');
  lines.push('');
  lines.push(metricsTable(e));
  lines.push('');
  lines.push('## 13. Model Recommendation');
  lines.push('');
  if (r) {
    lines.push(`**Recommended model:** ${MODEL_LABELS[r.recommendation.modelId]}`);
    lines.push('');
    lines.push(`**Reason:** ${r.recommendation.reason}`);
  }
  lines.push('');
  lines.push('## 14. Limitations');
  lines.push('');
  lines.push(
    '- The quantum-inspired model is a classical numerical simulation of quantum-probability formalism; it is not a quantum computation.',
    '- Results describe the selected configuration and evaluation criteria only; they do not predict real-world future events.',
    '- QAI is a configurable research visualization metric, not a universal measure of "quantumness".',
    '- Sample experiments are decision-analysis simulations, not financial or life-outcome predictions.',
  );
  lines.push('');
  lines.push('## 15. Reproducibility');
  lines.push('');
  if (e.reproducibility) {
    lines.push(`- Experiment ID: \`${e.reproducibility.experimentId}\``);
    lines.push(`- Ran at: ${formatDateTime(e.reproducibility.ranAt)}`);
    lines.push(`- Application version: ${e.reproducibility.appVersion}`);
    lines.push(`- Calculation version: ${e.reproducibility.calculationVersion}`);
    lines.push(`- Model version: ${e.reproducibility.modelVersion}`);
    lines.push(`- Dataset version: ${e.reproducibility.datasetVersion ?? 'n/a'}`);
    lines.push(`- Random seed: ${e.reproducibility.seed}`);
    lines.push(`- QAI weights: \`${JSON.stringify(e.reproducibility.qaiWeights)}\``);
  }
  lines.push('');
  return lines.join('\n');
}

export function reportToJson(report: ReportData): string {
  return JSON.stringify(report, null, 2);
}

export function reportToCsv(report: ReportData): string {
  const e = report.experiment;
  const r = e.results;
  const rows: Array<Array<string | number>> = [['metric', 'model', 'value']];
  if (r) {
    (['classical', 'bayesian', 'quantum'] as ModelId[]).forEach((id) => {
      if (r.models[id].status !== 'ok') return;
      const m = r.metrics[id];
      rows.push(['accuracy', id, m.accuracy ?? '']);
      rows.push(['predictionError', id, m.predictionError ?? '']);
      rows.push(['calibrationError', id, m.calibrationError ?? '']);
      rows.push(['brierScore', id, m.brierScore ?? '']);
      rows.push(['logLikelihood', id, m.logLikelihood ?? '']);
      rows.push(['expectedUtility', id, m.expectedUtility ?? '']);
      rows.push(['complexity', id, m.complexity]);
      rows.push(['contextSensitivity', id, m.contextSensitivity ?? '']);
      rows.push(['orderEffect', id, m.orderEffect ?? '']);
      rows.push(['interferenceMeasure', id, m.interferenceMeasure ?? '']);
      rows.push(['nonCommutativity', id, m.nonCommutativity ?? '']);
      rows.push(['qai', id, r.qai.value]);
    });
  }
  return rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function exportReport(experiment: Experiment, format: 'markdown' | 'json' | 'csv'): void {
  const report = buildReport(experiment);
  const slug = experiment.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (format === 'markdown') {
    downloadFile(`${slug}-report.md`, reportToMarkdown(report), 'text/markdown');
  } else if (format === 'json') {
    downloadFile(`${slug}-report.json`, reportToJson(report), 'application/json');
  } else {
    downloadFile(`${slug}-metrics.csv`, reportToCsv(report), 'text/csv');
  }
}