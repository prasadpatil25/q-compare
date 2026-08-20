import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ModelId } from '../types';
import { useAppStore } from '../store/AppStore';
import { Badge, EmptyState, Modal, Panel, StatusBadge } from '../components/ui';
import { ResultsView } from '../components/ResultsView';
import { ModelDetailDrawer } from '../components/ModelDetailDrawer';
import { EvidenceTimeline } from '../components/charts';
import { IconDelete, IconDuplicate, IconExport, IconPlus, IconRun } from '../components/icons';
import { formatDateTime, formatPercent } from '../utils';
import { exportReport } from '../services/reports';

export function ExperimentDetail() {
  const { id } = useParams<{ id: string }>();
  const store = useAppStore();
  const navigate = useNavigate();
  const [drawerModel, setDrawerModel] = useState<ModelId | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  const experiment = store.experiments.find((e) => e.id === id);

  const outcomePriors = useMemo(() => {
    if (!experiment) return [];
    const total = experiment.problem.outcomes.reduce((a, o) => a + Math.max(0, o.priorProbability), 0);
    return experiment.problem.outcomes.map((o) => ({
      label: o.label,
      prior: total > 0 ? o.priorProbability / total : 1 / experiment.problem.outcomes.length,
    }));
  }, [experiment]);

  if (!experiment) {
    return (
      <EmptyState
        title="Experiment not found"
        body="It may have been deleted."
        action={<button className="btn" onClick={() => navigate('/experiments')}>Back to Experiments</button>}
      />
    );
  }

  const reproducibility = experiment.reproducibility;

  return (
    <div>
      <div className="row-between mb-2 wrap">
        <div>
          <div className="row mb-1">
            <h1>{experiment.name}</h1>
            <StatusBadge status={experiment.status} />
            {experiment.isBenchmarkRun && <Badge tone="amber">Benchmark Run</Badge>}
          </div>
          <p className="text-2 small mb-0">{experiment.description}</p>
        </div>
        <div className="row">
          <button
            className="btn btn-sm"
            onClick={() => {
              const copy = store.duplicateExperiment(experiment.id);
              if (copy) navigate(`/experiments/${copy.id}`);
            }}
          >
            <IconDuplicate size={14} /> Duplicate
          </button>
          {experiment.status !== 'completed' && (
            <button className="btn btn-primary btn-sm" onClick={() => store.runExperimentAction(experiment.id)}>
              <IconRun size={14} /> Run
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
            <IconDelete size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-2 mb-2">
        <Panel title="Experiment Summary">
          <div className="small text-2 col" style={{ gap: 4 }}>
            <div><span className="text-3">Research question:</span> {experiment.researchQuestion || '—'}</div>
            <div><span className="text-3">Type:</span> <Badge tone="gray">{experiment.category}</Badge></div>
            <div><span className="text-3">Dataset:</span> {experiment.datasetId ?? 'None'}</div>
            <div><span className="text-3">Created:</span> {formatDateTime(experiment.createdAt)}</div>
            <div>
              <span className="text-3">Recommended model:</span>{' '}
              {experiment.results ? (
                <Badge tone={experiment.results.recommendation.modelId === 'quantum' ? 'purple' : experiment.results.recommendation.modelId === 'bayesian' ? 'green' : 'blue'}>
                  {experiment.results.recommendation.modelId}
                </Badge>
              ) : (
                '—'
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Problem Definition">
          <p className="mb-1"><strong>{experiment.problem.decisionQuestion}</strong></p>
          <div className="small text-2 mb-1">
            Alternatives: {experiment.problem.alternatives.map((a) => a.label).join(' · ')}
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th className="num">Utility</th>
                  <th className="num">Prior (normalized)</th>
                </tr>
              </thead>
              <tbody>
                {experiment.problem.outcomes.map((o) => (
                  <tr key={o.id}>
                    <td>
                      {o.label}{' '}
                      {experiment.problem.observedOutcomeId === o.id && <Badge tone="green">Observed</Badge>}
                    </td>
                    <td className="num">{o.utility}</td>
                    <td className="num">{formatPercent(outcomePriors.find((p) => p.label === o.label)?.prior ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Evidence / Context" sub={`${experiment.evidence.length} item(s) — order preserved`} className="mb-2">
        {experiment.evidence.length > 0 ? (
          <EvidenceTimeline evidence={experiment.evidence} />
        ) : (
          <p className="text-3">No evidence defined.</p>
        )}
      </Panel>

      <Panel title="Model Configuration" className="mb-2">
        <div className="grid grid-3 small text-2">
          <div>
            <h4 className="text-blue">Classical</h4>
            <ConfigList config={experiment.config.classical} />
          </div>
          <div>
            <h4 className="text-green">Bayesian</h4>
            <ConfigList config={experiment.config.bayesian} />
          </div>
          <div>
            <h4 className="text-purple">Quantum-Inspired</h4>
            <ConfigList config={experiment.config.quantum} />
          </div>
        </div>
      </Panel>

      {experiment.results ? (
        <>
          <ResultsView experiment={experiment} onOpenModel={setDrawerModel} />

          <Panel title="Reproducibility" className="mt-2 mb-2">
            {reproducibility ? (
              <div className="small text-2 grid grid-3">
                <div><span className="text-3">Experiment ID:</span> <span className="mono">{reproducibility.experimentId}</span></div>
                <div><span className="text-3">Ran at:</span> {formatDateTime(reproducibility.ranAt)}</div>
                <div><span className="text-3">App version:</span> {reproducibility.appVersion}</div>
                <div><span className="text-3">Calculation version:</span> {reproducibility.calculationVersion}</div>
                <div><span className="text-3">Model version:</span> {reproducibility.modelVersion}</div>
                <div><span className="text-3">Dataset version:</span> {reproducibility.datasetVersion ?? 'n/a'}</div>
                <div><span className="text-3">Random seed:</span> {reproducibility.seed}</div>
                <div className="col" style={{ gridColumn: '1 / -1' }}>
                  <span className="text-3">QAI weights:</span>
                  <span className="mono">{JSON.stringify(reproducibility.qaiWeights)}</span>
                </div>
              </div>
            ) : (
              <p className="text-3">Reproducibility metadata is written when the experiment is run.</p>
            )}
          </Panel>

          <div className="row mb-2">
            <button className="btn btn-sm" onClick={() => setShowCalc((v) => !v)}>
              {showCalc ? 'Hide Calculation' : 'Show Calculation'}
            </button>
            <button className="btn btn-sm" onClick={() => exportReport(experiment, 'markdown')}>
              <IconExport size={14} /> Export Markdown
            </button>
            <button className="btn btn-sm" onClick={() => exportReport(experiment, 'json')}>Export JSON</button>
            <button className="btn btn-sm" onClick={() => exportReport(experiment, 'csv')}>Export CSV</button>
          </div>

          {showCalc && (
            <Panel title="Calculation Details" sub="Full step-by-step traces">
              <div className="grid grid-3">
                {(Object.keys(experiment.results.models) as ModelId[])
                  .filter((m) => experiment.results?.models[m].status === 'ok')
                  .map((m) => (
                    <div key={m}>
                      <h4 className="mb-1">{m}</h4>
                      {experiment.results?.models[m].steps.map((s, i) => (
                        <div className="trace" key={i}>
                          <div className="trace-head">{s.label}</div>
                          <div className="trace-formula">{s.formula}</div>
                          <div className="trace-values">
                            {Object.entries(s.values).map(([k, v]) => (
                              <span key={k}>{k}: {typeof v === 'number' ? v.toFixed(3) : v}</span>
                            ))}
                          </div>
                          <div className="trace-explanation mt-1">{s.explanation}</div>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </Panel>
          )}
        </>
      ) : (
        <div className="mb-2">
          <EmptyState
            title="Not run yet"
            body="Run the experiment to compute model outputs, evaluation metrics, QAI and recommendation."
            action={
              <button className="btn btn-primary" onClick={() => store.runExperimentAction(experiment.id)}>
                <IconRun size={14} /> Run Experiment
              </button>
            }
          />
        </div>
      )}

      <div className="row mt-2">
        <Link to="/experiments" className="muted-link small">← All Experiments</Link>
        <button className="btn btn-sm" onClick={() => navigate('/experiments/new')}>
          <IconPlus size={14} /> New Experiment
        </button>
      </div>

      <Modal
        open={confirmDelete}
        title="Delete Experiment"
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <button className="btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                store.deleteExperiment(experiment.id);
                navigate('/experiments');
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p>Delete <strong>{experiment.name}</strong>? This action cannot be undone.</p>
      </Modal>

      <ModelDetailDrawer experiment={experiment} modelId={drawerModel} onClose={() => setDrawerModel(null)} />
    </div>
  );
}
function ConfigList({ config }: { config: object }) {
  return (
    <div className="col small" style={{ gap: 3 }}>
      {Object.entries(config).map(([key, value]) => (
        <div key={key} className="row-between" style={{ gap: 8 }}>
          <span className="text-3">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
          <span className="mono">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}
