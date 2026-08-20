import { useMemo, useState } from 'react';
import type { Dataset, DatasetRow } from '../types';
import { useAppStore } from '../store/AppStore';
import { Badge, EmptyState, Modal, Panel } from '../components/ui';
import { IconDelete, IconPlus } from '../components/icons';
import { formatDate, uid } from '../utils';

function parseCsv(text: string): { columns: string[]; rows: DatasetRow[] } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { columns: [], rows: [] };
  const columns = lines[0].split(',').map((c) => c.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const values: Record<string, string | number> = {};
    columns.forEach((col, i) => {
      const raw = cells[i] ?? '';
      const num = Number(raw);
      values[col] = raw !== '' && !Number.isNaN(num) ? num : raw;
    });
    return { id: uid('r'), values };
  });
  return { columns, rows };
}

export function Datasets() {
  const store = useAppStore();
  const [preview, setPreview] = useState<Dataset | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Dataset | null>(null);

  const usageCount = useMemo(() => {
    const counts: Record<string, number> = {};
    store.experiments.forEach((e) => {
      if (e.datasetId) counts[e.datasetId] = (counts[e.datasetId] ?? 0) + 1;
    });
    return counts;
  }, [store.experiments]);

  const createDataset = () => {
    setError('');
    if (!name.trim()) {
      setError('A dataset name is required.');
      return;
    }
    let rows: DatasetRow[] = [];
    let columns: string[] = [];
    if (csvText.trim()) {
      const parsed = parseCsv(csvText);
      if (parsed.columns.length === 0) {
        setError('CSV needs a header row and at least one data row.');
        return;
      }
      rows = parsed.rows;
      columns = parsed.columns;
    } else {
      columns = ['value'];
      rows = [{ id: uid('r'), values: { value: 'sample' } }];
    }
    store.addDataset({
      id: uid('ds'),
      name: name.trim(),
      description: description.trim(),
      createdAt: new Date().toISOString(),
      rows,
      columns,
    });
    setCreateOpen(false);
    setName('');
    setDescription('');
    setCsvText('');
  };

  return (
    <div>
      <div className="row-between mb-2 wrap">
        <div>
          <h1>Datasets</h1>
          <p className="text-2 small mb-0">Simple tabular datasets used as experiment metadata and evidence sources.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
          <IconPlus size={14} /> Create Dataset
        </button>
      </div>

      {store.datasets.length === 0 ? (
        <EmptyState
          title="No datasets"
          body="Create a dataset or upload a CSV (header row + data rows)."
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
              <IconPlus size={14} /> Create Dataset
            </button>
          }
        />
      ) : (
        <div className="grid grid-2">
          {store.datasets.map((d) => (
            <Panel key={d.id} title={d.name} sub={`${d.rows.length} rows · ${d.columns.length} columns`}>
              <div className="row wrap mb-2">
                <Badge tone="teal">{d.rows.length} rows</Badge>
                <Badge tone="gray">{d.columns.join(', ')}</Badge>
                {usageCount[d.id] ? <Badge tone="blue">Used by {usageCount[d.id]} experiment(s)</Badge> : <Badge tone="gray">Unused</Badge>}
              </div>
              <p className="small text-2 mb-1">{d.description || 'No description.'}</p>
              <div className="row">
                <button className="btn btn-sm" onClick={() => setPreview(d)}>Preview</button>
                <button className="btn btn-sm" onClick={() => setDeleteTarget(d)}>
                  <IconDelete size={14} /> Delete
                </button>
                <span className="xsmall text-3">Created {formatDate(d.createdAt)}</span>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        title="Create Dataset"
        onClose={() => setCreateOpen(false)}
        actions={
          <>
            <button className="btn" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createDataset}>
              <IconPlus size={14} /> Create
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="ds-name">Name *</label>
          <input id="ds-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Job Offers 2024" />
        </div>
        <div className="field">
          <label htmlFor="ds-desc">Description</label>
          <input id="ds-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ds-csv">CSV content (optional — header row + data rows)</label>
          <textarea
            id="ds-csv"
            className="textarea"
            style={{ minHeight: 140, fontFamily: 'var(--mono)' }}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'offer,salary,remote\nalpha,20,yes\nbeta,18,no'}
          />
          <span className="field-hint">CSV upload is parsed in-browser; files are validated (header + ≥1 row).</span>
        </div>
        {error && <p className="text-red small">{error}</p>}
      </Modal>

      <Modal open={preview != null} title={`Preview: ${preview?.name ?? ''}`} onClose={() => setPreview(null)}>
        {preview && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {preview.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 12).map((r) => (
                  <tr key={r.id}>
                    {preview.columns.map((c) => (
                      <td key={c}>{String(r.values[c] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={deleteTarget != null}
        title="Delete Dataset"
        onClose={() => setDeleteTarget(null)}
        actions={
          <>
            <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (deleteTarget) store.deleteDataset(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p>
          Delete <strong>{deleteTarget?.name}</strong>? Experiments referencing it will keep their stored data but the
          dataset link will be lost.
        </p>
      </Modal>
    </div>
  );
}