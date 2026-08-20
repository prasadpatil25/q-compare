import type { Experiment, ModelId } from '../types';
import { MODEL_COLORS, MODEL_LABELS } from '../types';
import { IconClose } from './icons';
import { Badge } from './ui';
import { round } from '../utils';

function amplitudeText(experiment: Experiment, modelId: ModelId): string {
  const result = experiment.results?.models[modelId];
  if (!result || result.status !== 'ok') return '';
  const amps = result.details.amplitudes as Record<string, { re: number; im: number }> | undefined;
  if (!amps) return '';
  const parts = Object.values(amps).map((a) => {
    const re = round(a.re, 3);
    const im = round(a.im, 3);
    return `${re >= 0 ? '' : ''}${re.toFixed(3)}${im >= 0 ? '+' : ''}${im.toFixed(3)}i`;
  });
  return `|ψ⟩ = (${parts.join(' , ')})`;
}

export function ModelDetailDrawer({
  experiment,
  modelId,
  onClose,
}: {
  experiment: Experiment;
  modelId: ModelId | null;
  onClose: () => void;
}) {
  if (!modelId) return null;
  const result = experiment.results?.models[modelId];
  const metrics = experiment.results?.metrics[modelId];
  const label = MODEL_LABELS[modelId];
  const color = MODEL_COLORS[modelId];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" role="dialog" aria-label={`${label} model detail`} onClick={(e) => e.stopPropagation()}>
        <div className="row-between mb-2">
          <h2 className="row" style={{ color }}>
            <span className="model-chip" style={{ borderColor: color, color }}>
              {label}
            </span>
            Model
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close drawer">
            <IconClose size={15} />
          </button>
        </div>

        {!result || result.status !== 'ok' ? (
          <p className="text-2">This model was not run for this experiment.</p>
        ) : (
          <>
            {modelId === 'quantum' && (
              <>
                <h3 className="mb-1">State</h3>
                <div className="formula mb-2">{amplitudeText(experiment, 'quantum')}</div>
              </>
            )}

            <h3 className="mb-1">Probabilities</h3>
            <div className="table-wrap mb-2">
              <table className="data">
                <tbody>
                  {experiment.problem.outcomes.map((o) => (
                    <tr key={o.id}>
                      <td>{o.label}</td>
                      <td className="num">{round(result.probabilities[o.id] ?? 0, 3).toFixed(3)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Expected utility</td>
                    <td className="num">{round(result.expectedUtility, 4).toFixed(4)}</td>
                  </tr>
                  <tr>
                    <td>Decision</td>
                    <td><Badge tone="purple">{result.decisionLabel}</Badge></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {metrics && (
              <>
                <h3 className="mb-1">Evaluation</h3>
                <div className="table-wrap mb-2">
                  <table className="data">
                    <tbody>
                      <tr><td>Accuracy</td><td className="num">{metrics.accuracy != null ? metrics.accuracy.toFixed(2) : '—'}</td></tr>
                      <tr><td>Calibration error</td><td className="num">{metrics.calibrationError?.toFixed(4) ?? '—'}</td></tr>
                      <tr><td>Log-likelihood</td><td className="num">{metrics.logLikelihood?.toFixed(4) ?? '—'}</td></tr>
                      <tr><td>Brier score</td><td className="num">{metrics.brierScore?.toFixed(4) ?? '—'}</td></tr>
                      <tr><td>Complexity</td><td className="num">{metrics.complexity}</td></tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {modelId === 'quantum' && (
              <>
                <h3 className="mb-1">Context Effect</h3>
                <p className="small text-2 mb-2">
                  The context transformation applies a phase to the component of the state along each evidence's
                  support direction, changing the measured probabilities only when subsequent rotations mix those phases.
                </p>
              </>
            )}

            {modelId === 'quantum' && (
              <>
                <h3 className="mb-1">Interference</h3>
                <div className="trace mb-2">
                  <div className="trace-head">Contribution per outcome</div>
                  <div className="trace-values">
                    {experiment.problem.outcomes.map((o) => (
                      <span key={o.id}>
                        {o.label}: {(result.details.interference as Record<string, number>)?.[o.id]?.toFixed(4) ?? '—'}
                      </span>
                    ))}
                    <span>
                      Total: {(result.details.totalInterference as number | undefined)?.toFixed(4) ?? '—'}
                    </span>
                  </div>
                </div>
              </>
            )}

            <h3 className="mb-1">Calculation</h3>
            <p className="small text-2 mb-2">
              {modelId === 'classical' &&
                'Classical: posterior ∝ prior × evidence likelihoods, normalized to sum to 1. Decision by expected utility.'}
              {modelId === 'bayesian' &&
                'Bayesian: P(H|E) ∝ P(H) × Π P(Eⱼ|H), applied sequentially, normalized after each evidence item.'}
              {modelId === 'quantum' &&
                'Quantum-inspired: amplitudes αᵢ = √P(Hᵢ), unitary context phases + Givens evidence rotations, Born-rule measurement P(i) = |αᵢ|². Simulation only — not a quantum computer.'}
            </p>

            {result.steps.map((s, i) => (
              <div className="trace" key={i}>
                <div className="trace-head">{s.label}</div>
                <div className="trace-formula">{s.formula}</div>
                <div className="trace-values">
                  {Object.entries(s.values).map(([k, v]) => (
                    <span key={k}>{k}: {round(v, 4).toFixed(4)}</span>
                  ))}
                </div>
                <div className="trace-explanation mt-1">{s.explanation}</div>
              </div>
            ))}

            <p className="xsmall text-3 mt-2">
              Assumptions are shown per step above. The quantum-inspired model is a classical numerical simulation of
              quantum-probability formalism and does not run on a quantum computer.
            </p>
          </>
        )}
      </div>
    </div>
  );
}