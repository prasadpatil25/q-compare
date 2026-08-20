import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Experiment } from '../types';
import { useAppStore } from '../store/AppStore';
import { Badge, EmptyState, Panel } from '../components/ui';
import { IconExport } from '../components/icons';
import { exportReport } from '../services/reports';
import { formatDate } from '../utils';

export function Reports() {
  const store = useAppStore();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState('');
  const completed = store.experiments.filter((e) => e.results && e.status === 'completed');
  const selected: Experiment | undefined =
    completed.find((e) => e.id === selectedId) ?? completed[0];

  return (
    <div>
      <div className="mb-2">
        <h1>Reports</h1>
        <p className="text-2 small mb-0">
          Generate research-style reports for completed experiments. Export as Markdown, JSON or CSV.
        </p>
      </div>

      {completed.length === 0 ? (
        <EmptyState
          title="No completed experiments"
          body="Run an experiment before generating a report."
          action={<button className="btn btn-primary btn-sm" onClick={() => navigate('/experiments/new')}>New Experiment</button>}
        />
      ) : (
        <div className="grid grid-2">
          <Panel title="Select Experiment">
            <div className="col">
              {completed.map((e) => (
                <button
                  key={e.id}
                  className={`evidence-card ${selected?.id === e.id ? 'drag-over' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedId(e.id)}
                >
                  <div className="evidence-body" style={{ textAlign: 'left' }}>
                    <div className="evidence-name">{e.name}</div>
                    <div className="evidence-meta">
                      <span>{e.category}</span>
                      <span>{formatDate(e.updatedAt)}</span>
                      <span>QAI {e.results?.qai.value.toFixed(2)}</span>
                    </div>
                  </div>
                  {selected?.id === e.id && <Badge tone="green">Selected</Badge>}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Report Preview">
            {selected ? (
              <div className="col" style={{ gap: 10 }}>
                <div>
                  <h3>{selected.name}</h3>
                  <p className="small text-2 mb-0">{selected.researchQuestion}</p>
                </div>
                <div className="small text-2 col" style={{ gap: 3 }}>
                  <div>
                    <span className="text-3">Recommended model:</span>{' '}
                    <Badge tone={selected.results?.recommendation.modelId === 'quantum' ? 'purple' : 'green'}>
                      {selected.results?.recommendation.modelId}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-3">QAI:</span> <span className="mono">{selected.results?.qai.value.toFixed(3)}</span> —{' '}
                    {selected.results?.qai.label}
                  </div>
                  <div>
                    <span className="text-3">Metrics:</span> accuracy {selected.results?.metrics.quantum.accuracy ?? '—'} · brier{' '}
                    {selected.results?.metrics.quantum.brierScore?.toFixed(3) ?? '—'}
                  </div>
                </div>
                <div className="divider" style={{ margin: '4px 0' }} />
                <div className="xsmall text-3">
                  Report sections: title · research question · problem definition · dataset · evidence · classical model ·
                  bayesian model · quantum-inspired model · model parameters · probability distributions · evaluation metrics ·
                  QAI calculation · comparative results · model recommendation · limitations · reproducibility.
                </div>
                <div className="row wrap mt-1">
                  <button className="btn btn-sm" onClick={() => exportReport(selected, 'markdown')}>
                    <IconExport size={14} /> Markdown
                  </button>
                  <button className="btn btn-sm" onClick={() => exportReport(selected, 'json')}>
                    <IconExport size={14} /> JSON
                  </button>
                  <button className="btn btn-sm" onClick={() => exportReport(selected, 'csv')}>
                    <IconExport size={14} /> CSV
                  </button>
                  <button className="btn btn-sm" onClick={() => navigate(`/experiments/${selected.id}`)}>
                    Open Experiment
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState title="No experiment selected" />
            )}
          </Panel>
        </div>
      )}

      <div className="alert mt-2" role="note">
        Every report states that the quantum-inspired model is a mathematical simulation and does not run on a quantum
        computer.
      </div>
    </div>
  );
}