import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Experiment } from '../types';
import { EXPERIMENT_CATEGORIES } from '../types';
import { useAppStore } from '../store/AppStore';
import { Badge, EmptyState, Modal, StatusBadge } from '../components/ui';
import { IconDelete, IconDuplicate, IconEdit, IconPlus, IconRun } from '../components/icons';
import { formatDate } from '../utils';

export function Experiments() {
  const store = useAppStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [minQai, setMinQai] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'qai'>('date');
  const [deleteTarget, setDeleteTarget] = useState<Experiment | null>(null);

  const filtered = useMemo(() => {
    let list = [...store.experiments];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => (e.name + e.description + e.researchQuestion).toLowerCase().includes(q));
    if (category) list = list.filter((e) => e.category === category);
    if (status) list = list.filter((e) => e.status === status);
    if (minQai) {
      const min = Number(minQai);
      list = list.filter((e) => (e.results?.qai.value ?? 0) >= min);
    }
    list.sort((a, b) =>
      sortBy === 'qai'
        ? (b.results?.qai.value ?? 0) - (a.results?.qai.value ?? 0)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
    return list;
  }, [store.experiments, query, category, status, minQai, sortBy]);

  return (
    <div>
      <div className="row-between mb-2 wrap">
        <div>
          <h1>Experiments</h1>
          <p className="text-2 small mb-0">{store.experiments.length} experiment{store.experiments.length === 1 ? '' : 's'} stored</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/experiments/new')}>
          <IconPlus size={14} /> New Experiment
        </button>
      </div>

      <div className="panel mb-2">
        <div className="row wrap">
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search experiments"
          />
          <select className="select" style={{ maxWidth: 200 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by type">
            <option value="">All types</option>
            {EXPERIMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="select" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="completed">Completed</option>
          </select>
          <select className="select" style={{ maxWidth: 170 }} value={minQai} onChange={(e) => setMinQai(e.target.value)} aria-label="Filter by QAI range">
            <option value="">Any QAI</option>
            <option value="0.75">QAI ≥ 0.75</option>
            <option value="0.5">QAI ≥ 0.50</option>
            <option value="0.25">QAI ≥ 0.25</option>
          </select>
          <select className="select" style={{ maxWidth: 150 }} value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date' | 'qai')} aria-label="Sort">
            <option value="date">Sort by date</option>
            <option value="qai">Sort by QAI</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No experiments match"
          body="Adjust filters or create a new experiment."
          action={
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/experiments/new')}>
              <IconPlus size={14} /> New Experiment
            </button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Experiment</th>
                <th>Type</th>
                <th>Date</th>
                <th>Dataset</th>
                <th>Models</th>
                <th>Best Model</th>
                <th className="num">QAI</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const models = (Object.keys(e.models) as Array<keyof typeof e.models>).filter((m) => e.models[m]);
                return (
                  <tr key={e.id}>
                    <td>
                      <button
                        onClick={() => navigate(`/experiments/${e.id}`)}
                        style={{ fontWeight: 600, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                      >
                        {e.name}
                      </button>
                      <div className="xsmall text-3">{e.researchQuestion}</div>
                    </td>
                    <td><Badge tone="gray">{e.category}</Badge></td>
                    <td className="nowrap text-2 small">{formatDate(e.updatedAt)}</td>
                    <td className="xsmall text-2">{e.datasetId ? 'Attached' : '—'}</td>
                    <td>
                      <div className="row wrap" style={{ gap: 4 }}>
                        {models.map((m) => (
                          <span key={m} className={`model-chip ${m}`}>{m === 'classical' ? 'C' : m === 'bayesian' ? 'B' : 'Q'}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {e.results ? (
                        <Badge tone={e.results.recommendation.modelId === 'quantum' ? 'purple' : e.results.recommendation.modelId === 'bayesian' ? 'green' : 'blue'}>
                          {e.results.recommendation.modelId}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num">{e.results ? e.results.qai.value.toFixed(2) : '—'}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-sm" title="Open" onClick={() => navigate(`/experiments/${e.id}`)}>
                          <IconEdit size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Duplicate"
                          onClick={() => {
                            const copy = store.duplicateExperiment(e.id);
                            if (copy) navigate(`/experiments/${copy.id}`);
                          }}
                        >
                          <IconDuplicate size={14} />
                        </button>
                        {e.status !== 'completed' && (
                          <button className="btn btn-ghost btn-sm" title="Run" onClick={() => store.runExperimentAction(e.id)}>
                            <IconRun size={14} />
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" title="Delete" onClick={() => setDeleteTarget(e)}>
                          <IconDelete size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={deleteTarget != null}
        title="Delete Experiment"
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (deleteTarget) store.deleteExperiment(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p>
          Delete <strong>{deleteTarget?.name}</strong>? This removes the experiment and its results. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}