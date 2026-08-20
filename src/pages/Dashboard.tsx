import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/AppStore';
import { KpiCard, Panel, Badge, EmptyState } from '../components/ui';
import { QaiGauge } from '../components/QaiGauge';
import { ModelPerformanceChart, ProbabilityComparisonChart, DistributionChart } from '../components/charts';
import { MODEL_COLORS, MODEL_LABELS, type ModelId } from '../types';
import { formatDate, round } from '../utils';
import { IconExport, IconPlus } from '../components/icons';

const FLOW_STEPS = [
  { label: 'Define Problem', done: true },
  { label: 'Add Evidence', done: true },
  { label: 'Select Models', done: true },
  { label: 'Run Models', done: true },
  { label: 'Evaluate', current: true },
  { label: 'Insights', done: false },
];

export function Dashboard() {
  const store = useAppStore();
  const navigate = useNavigate();

  const completed = useMemo(
    () => store.experiments.filter((e) => e.results && e.status === 'completed'),
    [store.experiments],
  );
  const recent = useMemo(
    () => [...store.experiments].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    [store.experiments],
  );

  const [selectedId, setSelectedId] = useState<string>(completed[0]?.id ?? '');

  const selected = completed.find((e) => e.id === selectedId) ?? completed[0];

  const avgQai = completed.length
    ? round(completed.reduce((a, e) => a + (e.results?.qai.value ?? 0), 0) / completed.length, 2)
    : 0;

  const modelCounts: Record<ModelId, number> = { classical: 0, bayesian: 0, quantum: 0 };
  completed.forEach((e) => {
    (Object.keys(e.models) as ModelId[]).forEach((m) => {
      if (e.models[m]) modelCounts[m] += 1;
    });
  });
  const totalModels = modelCounts.classical + modelCounts.bayesian + modelCounts.quantum;

  const bestModel: ModelId = useMemo(() => {
    const rec: ModelId[] = [];
    completed.forEach((e) => rec.push(e.results?.recommendation.modelId ?? 'classical'));
    if (rec.length === 0) return 'classical';
    const counts = { classical: 0, bayesian: 0, quantum: 0 } as Record<ModelId, number>;
    rec.forEach((m) => (counts[m] += 1));
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as ModelId);
  }, [completed]);

  const performanceData = useMemo(() => {
    if (!selected?.results) return [];
    const out: Array<{ model: string; metric: string; value: number }> = [];
    (['classical', 'bayesian', 'quantum'] as ModelId[]).forEach((id) => {
      const m = selected.results?.metrics[id];
      if (!m) return;
      out.push({ model: MODEL_LABELS[id], metric: 'Accuracy', value: m.accuracy ?? 0 });
      out.push({ model: MODEL_LABELS[id], metric: 'Calibration', value: 1 - (m.calibrationError ?? 0) });
      out.push({ model: MODEL_LABELS[id], metric: 'Prediction', value: 1 - (m.predictionError ?? 0) });
    });
    return out;
  }, [selected]);

  const distributionData = useMemo(() => {
    if (!selected?.results?.models.quantum || selected.results.models.quantum.status !== 'ok') return [];
    return selected.problem.outcomes.map((o) => ({
      name: o.label,
      p: selected.results?.models.quantum.probabilities[o.id] ?? 0,
      color: MODEL_COLORS.quantum,
    }));
  }, [selected]);

  const recentInsights = store.insights.slice(0, 3);

  return (
    <div>
      <div className="row-between mb-2 wrap">
        <div>
          <h1>Dashboard</h1>
          <p className="text-2 small mb-0 mt-0">
            Comparative empirical analysis across {completed.length} completed experiment{completed.length === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => navigate('/reports')}>
            <IconExport size={14} /> <span className="label-hide">Export Report</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/experiments/new')}>
            <IconPlus size={14} /> New Experiment
          </button>
        </div>
      </div>

      <div className="grid grid-4 mb-2">
        <KpiCard label="Total Experiments" value={store.experiments.length} hint={`${completed.length} completed`} />
        <KpiCard
          label="Quantum Advantage (Avg)"
          value={<><span className={avgQai >= 0.5 ? 'text-purple' : 'text-amber'}>{avgQai.toFixed(2)}</span></>}
          hint="Mean QAI across completed experiments"
          accent={avgQai >= 0.5 ? 'purple' : 'amber'}
        />
        <KpiCard label="Models Compared" value={totalModels} hint="Classical · Bayesian · Quantum" />
        <KpiCard
          label="Best Model Overall"
          value={MODEL_LABELS[bestModel]}
          hint="Most frequent recommendation"
          accent={bestModel === 'quantum' ? 'purple' : bestModel === 'bayesian' ? 'green' : 'blue'}
        />
      </div>

      <div className="grid grid-2 mb-2">
        <Panel
          title="Probability Comparison"
          sub={selected ? selected.name : 'No completed experiment'}
          actions={
            completed.length > 1 ? (
              <select
                className="select"
                style={{ maxWidth: 220 }}
                value={selected?.id ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
                aria-label="Select experiment"
              >
                {completed.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            ) : undefined
          }
        >
          {selected?.results ? (
            <>
              <ProbabilityComparisonChart
                outcomes={selected.problem.outcomes}
                probabilities={{
                  classical: selected.results.models.classical.probabilities,
                  bayesian: selected.results.models.bayesian.probabilities,
                  quantum: selected.results.models.quantum.probabilities,
                }}
              />
              <div className="row mt-1 wrap">
                {(Object.keys(selected.results.models) as ModelId[])
                  .filter((id) => selected.results?.models[id].status === 'ok')
                  .map((id) => (
                    <span key={id} className="model-chip">
                      <span className="legend-swatch" style={{ background: MODEL_COLORS[id] }} />
                      {MODEL_LABELS[id]}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="No completed experiments"
              body="Run an experiment to see the probability comparison."
              action={
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/experiments/new')}>
                  <IconPlus size={14} /> New Experiment
                </button>
              }
            />
          )}
        </Panel>

        <Panel title="Model Performance" sub="Accuracy · Calibration · Prediction (best = 1)">
          {selected?.results ? (
            <ModelPerformanceChart data={performanceData} />
          ) : (
            <EmptyState title="No data" body="Complete an experiment to populate model performance." />
          )}
        </Panel>
      </div>

      <div className="grid grid-2 mb-2">
        <Panel title="Quantum Advantage Indicator" sub="Selected experiment">
          {selected?.results ? (
            <div className="row wrap" style={{ justifyContent: 'space-evenly', gap: 20 }}>
              <QaiGauge qai={selected.results.qai} size={210} />
              <div className="col flex-1">
                <h4>Why?</h4>
                {selected.results.qai.reasons.length > 0 ? (
                  <ul className="small text-2 mt-0 mb-1" style={{ paddingLeft: 18, margin: 0 }}>
                    {selected.results.qai.reasons.slice(0, 5).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="small text-2">No meaningful quantum-inspired advantage detected for this experiment.</p>
                )}
                <button className="btn btn-sm mt-1" onClick={() => navigate(`/experiments/${selected.id}`)}>
                  View Detailed Analysis
                </button>
              </div>
            </div>
          ) : (
            <EmptyState title="No data" body="QAI is computed after running an experiment." />
          )}
        </Panel>

        <Panel title="Probability Distribution" sub={selected ? `${selected.name} — Quantum-Inspired` : undefined}>
          {distributionData.length > 0 ? (
            <DistributionChart data={distributionData} />
          ) : (
            <EmptyState title="No distribution" body="Run the quantum-inspired model to see the probability distribution." />
          )}
        </Panel>
      </div>

      <div className="grid grid-2">
        <Panel title="Recent Experiments" sub="Latest activity">
          {recent.length === 0 ? (
            <EmptyState title="No experiments" body="Create your first experiment." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>QAI</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e) => (
                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/experiments/${e.id}`)}>
                      <td>{e.name}</td>
                      <td><Badge tone="gray">{e.category}</Badge></td>
                      <td>
                        <span className={`status-dot status-${e.status}`} />
                        <span className="xsmall text-2">{e.status}</span>
                      </td>
                      <td className="num">{e.results ? e.results.qai.value.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Experiment Flow" sub="Current workflow position">
          <div className="col" style={{ gap: 2 }}>
            {FLOW_STEPS.map((s, i) => (
              <div key={s.label} className="flow-step">
                <span className={`flow-num ${s.done || s.current ? 'text-green' : ''}`}>{i + 1}</span>
                <span className={s.current ? 'flow-current' : s.done ? 'flow-ok' : ''}>
                  {s.done ? '✓ ' : s.current ? '● ' : '○ '}
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <div className="divider" />
          <h4 className="mb-1">Recent Insights</h4>
          {recentInsights.length > 0 ? (
            recentInsights.map((ins) => (
              <div key={ins.id} className="small text-2 mb-1">
                <span className="badge badge-purple mr-1">{ins.kind}</span> {ins.title}
              </div>
            ))
          ) : (
            <p className="small text-3">Insights appear after experiments are completed.</p>
          )}
          <div className="mt-2 row wrap">
            <button className="btn btn-sm" onClick={() => navigate('/experiments')}>View All Experiments</button>
            <button className="btn btn-sm" onClick={() => navigate('/benchmarks')}>Run Benchmarks</button>
            <span className="xsmall text-3">Updated {formatDate(new Date().toISOString())}</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}