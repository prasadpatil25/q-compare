import { useState } from 'react';
import { useAppStore } from '../store/AppStore';
import { Badge, Modal, Panel } from '../components/ui';
import { DEFAULT_WEIGHTS } from '../models/run';
import { useTheme } from '../hooks/useTheme';

const COMPONENT_DOCS: Record<keyof typeof DEFAULT_WEIGHTS, string> = {
  context: 'Relative context sensitivity of the quantum model beyond the best classical alternative.',
  interference: 'Total interference magnitude from phase mixing in the quantum pipeline (normalized).',
  errorReduction: 'Relative prediction-error (or Brier-score) reduction of quantum vs best classical alternative.',
  nonCommutativity: 'Normalized order-effect distance between forward and reversed evidence orders.',
  calibration: 'Calibration-error reduction of quantum vs best classical alternative.',
};

export function Settings() {
  const store = useAppStore();
  const { mode, setThemeMode } = useTheme();
  const [resetOpen, setResetOpen] = useState(false);
  const weights = store.settings.qaiWeights;

  const setWeight = (key: keyof typeof weights, value: number) => {
    store.updateSettings({
      qaiWeights: {
        ...weights,
        [key]: Math.min(1, Math.max(0, value)),
      },
    });
  };

  const total = weights.context + weights.interference + weights.errorReduction + weights.nonCommutativity + weights.calibration;

  return (
    <div>
      <h1 className="mb-2">Settings</h1>

      <Panel
        title="Quantum Advantage Indicator — Weights"
        sub="QAI = w₁·Ctx + w₂·Interf + w₃·ErrRed + w₄·NonComm + w₅·Calib (weighted mean, normalized to 0–1)"
        className="mb-2"
      >
        {(Object.keys(COMPONENT_DOCS) as Array<keyof typeof COMPONENT_DOCS>).map((key) => (
          <div key={key} className="mb-2">
            <div className="row-between mb-1">
              <label htmlFor={`w-${key}`} className="small" style={{ fontWeight: 600 }}>
                {key} <span className="text-3">({weights[key].toFixed(2)})</span>
              </label>
              <span className="xsmall text-3">{((weights[key] / (total || 1)) * 100).toFixed(0)}% share</span>
            </div>
            <input
              id={`w-${key}`}
              type="range"
              min="0"
              max="1"
              step="0.05"
              className="input"
              value={weights[key]}
              onChange={(e) => setWeight(key, Number(e.target.value))}
            />
            <p className="xsmall text-3 mb-0">{COMPONENT_DOCS[key]}</p>
          </div>
        ))}
        <div className="row mt-2 wrap">
          <Badge tone="amber">Total raw weight: {total.toFixed(2)} (share-normalized)</Badge>
          <button
            className="btn btn-sm"
            onClick={() =>
              store.updateSettings({ qaiWeights: { ...DEFAULT_WEIGHTS } })
            }
          >
            Reset to defaults
          </button>
        </div>
        <p className="xsmall text-3 mt-2 mb-0">
          Weights apply to newly run experiments. Changing them does not rewrite historical results.
        </p>
      </Panel>

      <Panel title="Appearance — Slate & Steel Theme" sub="Applies a slate palette with a sky accent across the research lab" className="mb-2">
        <div className="row wrap" role="radiogroup" aria-label="Theme mode">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'dark'}
            className={`btn ${mode === 'dark' ? 'btn-primary' : ''}`}
            onClick={() => setThemeMode('dark')}
          >
            Dark mode
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'light'}
            className={`btn ${mode === 'light' ? 'btn-primary' : ''}`}
            onClick={() => setThemeMode('light')}
          >
            Light mode
          </button>
        </div>
        <p className="xsmall text-3 mt-1 mb-0">Your choice is saved in browser storage.</p>
      </Panel>

      <Panel title="Reproducibility Seed" className="mb-2">
        <div className="row">
          <div className="field flex-1" style={{ maxWidth: 320 }}>
            <label htmlFor="seed">Random seed (used for reproducible benchmark generation)</label>
            <input
              id="seed"
              type="number"
              className="input"
              value={store.settings.seed}
              onChange={(e) => store.updateSettings({ seed: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Data" tight>
        <div className="row-between wrap">
          <div>
            <h4>Application data</h4>
            <p className="small text-2 mb-0">
              Experiments, datasets, benchmark runs and settings are persisted in browser local storage. No server is
              required.
            </p>
          </div>
          <button className="btn btn-danger" onClick={() => setResetOpen(true)}>Reset all data</button>
        </div>
      </Panel>

      <Modal
        open={resetOpen}
        title="Reset all data"
        onClose={() => setResetOpen(false)}
        actions={
          <>
            <button className="btn" onClick={() => setResetOpen(false)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => {
                store.resetAll();
                setResetOpen(false);
              }}
            >
              Reset
            </button>
          </>
        }
      >
        <p>
          This removes all experiments, datasets, benchmark runs, insights and settings, then restores the sample seed
          data. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}