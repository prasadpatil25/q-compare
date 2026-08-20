import type { EvaluationMetrics, ModelId, Recommendation } from '../types';
import { MODEL_LABELS } from '../types';
import { Badge } from './ui';

function fmt(v: number | null | undefined, digits = 3, unit = ''): string {
  if (v == null) return '—';
  return `${v.toFixed(digits)}${unit}`;
}

function pct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function bestOf(rows: Array<{ id: ModelId; m: EvaluationMetrics }>, key: (m: EvaluationMetrics) => number | null, higherIsBetter = false): ModelId[] {
  const values = rows
    .map((r) => ({ id: r.id, v: key(r.m) }))
    .filter((x): x is { id: ModelId; v: number } => x.v != null);
  if (values.length === 0) return [];
  const best = higherIsBetter ? Math.max(...values.map((v) => v.v)) : Math.min(...values.map((v) => v.v));
  return values.filter((v) => Math.abs(v.v - best) < 1e-9).map((v) => v.id);
}

export function ComparisonTable({
  metrics,
}: {
  metrics: Record<ModelId, EvaluationMetrics>;
}) {
  const rows = (['classical', 'bayesian', 'quantum'] as ModelId[])
    .map((id) => ({ id, m: metrics[id] }))
    .filter((r) => r.m);

  const mark = (id: ModelId, group: ModelId[]) => (group.includes(id) ? '✓' : '');
  const accuracyBest = bestOf(rows, (m) => m.accuracy, true);
  const calBest = bestOf(rows, (m) => m.calibrationError);
  const errBest = bestOf(rows, (m) => m.predictionError);
  const brierBest = bestOf(rows, (m) => m.brierScore);

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Metric</th>
            {rows.map((r) => (
              <th key={r.id} className="num">
                {MODEL_LABELS[r.id]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Accuracy</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{fmt(r.m.accuracy, 2)} {mark(r.id, accuracyBest)}</td>
            ))}
          </tr>
          <tr>
            <td>Calibration Error</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{pct(r.m.calibrationError)} {mark(r.id, calBest)}</td>
            ))}
          </tr>
          <tr>
            <td>Log-Likelihood</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{fmt(r.m.logLikelihood, 4)}</td>
            ))}
          </tr>
          <tr>
            <td>Brier Score</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{fmt(r.m.brierScore, 4)} {mark(r.id, brierBest)}</td>
            ))}
          </tr>
          <tr>
            <td>Prediction Error</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{pct(r.m.predictionError)} {mark(r.id, errBest)}</td>
            ))}
          </tr>
          <tr>
            <td>Expected Utility</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{fmt(r.m.expectedUtility, 4)}</td>
            ))}
          </tr>
          <tr>
            <td>Model Complexity</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{fmt(r.m.complexity, 0)}</td>
            ))}
          </tr>
          <tr>
            <td>Context Sensitivity</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{pct(r.m.contextSensitivity)}</td>
            ))}
          </tr>
          <tr>
            <td>Order Effect (ΔP)</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{fmt(r.m.orderEffect, 4)}</td>
            ))}
          </tr>
          <tr>
            <td>Interference Measure</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{r.m.interferenceMeasure != null ? fmt(r.m.interferenceMeasure, 4) : 'N/A'}</td>
            ))}
          </tr>
          <tr>
            <td>Non-Commutativity</td>
            {rows.map((r) => (
              <td key={r.id} className="num">{r.m.nonCommutativity != null ? fmt(r.m.nonCommutativity, 4) : 'N/A'}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function RecommendationBar({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="panel" style={{ borderColor: 'var(--primary-border)' }}>
      <div className="row-between wrap">
        <div className="row">
          <Badge tone="purple">Recommended Model</Badge>
          <strong>{MODEL_LABELS[recommendation.modelId]}</strong>
        </div>
      </div>
      <p className="text-2 small mt-1 mb-0">{recommendation.reason}</p>
    </div>
  );
}