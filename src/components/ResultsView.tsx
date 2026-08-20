import type { Experiment, ModelId } from '../types';
import { MODEL_COLORS, MODEL_LABELS } from '../types';
import { Panel } from './ui';
import { QaiGauge } from './QaiGauge';
import { ContextChart, OrderEffectChart, ProbabilityComparisonChart } from './charts';
import { ComparisonTable, RecommendationBar } from './ComparisonTable';
import { formatDateTime } from '../utils';
import { round } from '../utils';

export function ResultsView({
  experiment,
  onOpenModel,
}: {
  experiment: Experiment;
  onOpenModel: (modelId: ModelId) => void;
}) {
  const results = experiment.results;
  if (!results) {
    return <EmptyResults />;
  }

  const activeModels = (['classical', 'bayesian', 'quantum'] as ModelId[]).filter(
    (id) => results.models[id].status === 'ok',
  );

  const contextData =
    results.contextAnalysis && results.contextAnalysis.applicable
      ? results.contextAnalysis.contexts.flatMap((ctx) =>
          activeModels.map((m) => {
            const perModel: Record<string, Record<string, number>> =
              results.contextAnalysis?.perContextProbabilities[m] ?? {};
            const perCtx: Record<string, number> = perModel[ctx] ?? {};
            return {
              context: ctx,
              model: MODEL_LABELS[m],
              probability: perCtx[experiment.problem.outcomes[0]?.id ?? ''] ?? 0,
            };
          }),
        )
      : [];

  const orderData = results.orderAnalysis?.applicable
    ? results.orderAnalysis.pairs.map((p) => ({
        name: `${p.a} ↔ ${p.b}`,
        classical: p.deltaClassical,
        quantum: p.deltaQuantum,
      }))
    : [];

  return (
    <div>
      <div className="row-between mb-2 wrap">
        <div>
          <h2>Results</h2>
          <p className="small text-2 mb-0">
            Ran {formatDateTime(results.ranAt)} · {results.durationMs}ms · All models evaluated on the same experiment definition.
          </p>
        </div>
        <div className="row">
          {activeModels.map((m) => (
            <button key={m} className="btn btn-sm" onClick={() => onOpenModel(m)}>
              <span className="legend-swatch" style={{ background: MODEL_COLORS[m] }} />
              {MODEL_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-2 mb-2">
        <Panel title="Probability Comparison" sub="Outcome probabilities by model">
          <ProbabilityComparisonChart
            outcomes={experiment.problem.outcomes}
            probabilities={{
              classical: results.models.classical.probabilities,
              bayesian: results.models.bayesian.probabilities,
              quantum: results.models.quantum.probabilities,
            }}
            height={260}
          />
        </Panel>
        <Panel title="Decision Comparison" sub="Selected outcome per model">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Decision</th>
                  <th className="num">P(decision)</th>
                  <th className="num">Expected Utility</th>
                </tr>
              </thead>
              <tbody>
                {activeModels.map((m) => {
                  const r = results.models[m];
                  return (
                    <tr key={m}>
                      <td>
                        <span className="model-chip" style={{ color: MODEL_COLORS[m], borderColor: MODEL_COLORS[m] }}>
                          {MODEL_LABELS[m]}
                        </span>
                      </td>
                      <td>{r.decisionLabel}</td>
                      <td className="num">{round(r.probabilities[r.decision] ?? 0, 3).toFixed(3)}</td>
                      <td className="num">{r.expectedUtility.toFixed(4)}</td>
                    </tr>
                  );
                })}
                <tr className="row-best">
                  <td>Observed outcome</td>
                  <td>
                    {experiment.problem.outcomes.find((o) => o.id === experiment.problem.observedOutcomeId)?.label ?? '—'}
                  </td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Performance Metrics" sub="Same evaluation conditions for all models — best value marked ✓" className="mb-2">
        <ComparisonTable metrics={results.metrics} />
      </Panel>

      {results.orderAnalysis?.applicable && (
        <Panel
          title="Order Effects"
          sub="ΔP = P(A→B) − P(B→A) per evidence pair. Classical update commutes; the quantum-inspired pipeline does not."
          className="mb-2"
        >
          <OrderEffectChart data={orderData} />
          <div className="row wrap mt-1 small text-2">
            {results.orderAnalysis.pairs.map((p) => (
              <span key={`${p.a}-${p.b}`} className="badge badge-gray">
                {p.a} → {p.b}: ΔP = {p.deltaP >= 0 ? '+' : ''}{p.deltaP.toFixed(4)}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {results.contextAnalysis?.applicable && (
        <Panel title="Context Dependence" sub="Probability of the first outcome under each evidence context" className="mb-2">
          <ContextChart data={contextData} />
          <div className="row wrap mt-1">
            {(Object.keys(results.contextAnalysis.sensitivity) as ModelId[]).map((m) => (
              <span key={m} className="badge badge-gray">
                {MODEL_LABELS[m]} sensitivity: {results.contextAnalysis?.sensitivity[m].toFixed(4) ?? '—'}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid grid-2 mb-2">
        <Panel title="Quantum Advantage Indicator" sub="Composite research visualization metric">
          <div className="row" style={{ justifyContent: 'space-evenly', gap: 24 }}>
            <QaiGauge qai={results.qai} size={200} />
            <div className="col flex-1">
              <h4>Component breakdown</h4>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th className="num">Value</th>
                      <th className="num">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(results.qai.components) as Array<keyof typeof results.qai.components>).map((k) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td className="num">{results.qai.components[k].toFixed(4)}</td>
                        <td className="num">{results.qai.weights[k].toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="divider" />
          <h4 className="mb-1">Why?</h4>
          <ul className="small text-2 mb-1" style={{ margin: 0, paddingLeft: 18 }}>
            {results.qai.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <h4 className="mb-1">Caveats</h4>
          <ul className="xsmall text-3 mb-0" style={{ margin: 0, paddingLeft: 18 }}>
            {results.qai.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Panel>

        <Panel title="Interference & Non-Commutativity" sub="Quantum-specific measures where applicable">
          <div className="table-wrap mb-2">
            <table className="data">
              <tbody>
                <tr>
                  <td>Total interference (quantum pipeline)</td>
                  <td className="num">{results.interferenceAnalysis?.total.toFixed(4) ?? '—'}</td>
                </tr>
                <tr>
                  <td>Non-commutativity distance (TV)</td>
                  <td className="num">{results.nonCommutativityAnalysis?.distance.toFixed(4) ?? '—'}</td>
                </tr>
                <tr>
                  <td>Interference applicable</td>
                  <td className="num">{results.interferenceAnalysis?.applicable ? 'Yes' : 'No'}</td>
                </tr>
                <tr>
                  <td>Order analysis applicable</td>
                  <td className="num">{results.orderAnalysis?.applicable ? 'Yes' : 'No'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="xsmall text-3 mb-0">
            Interference: P(i) − Σₖ|Uᵢₖ|²P₀(k), the cross-term contribution from phase mixing in the quantum-inspired
            pipeline. Non-commutativity: total variation distance between forward and reversed evidence orders.
            These measures are reported only where the formalism supports them.
          </p>
        </Panel>
      </div>

      <RecommendationBar recommendation={results.recommendation} />

      <div className="mt-2">
        <Panel title="Calculation Traces" sub="Show Calculation — every model step is reproducible from inputs">
          <div className="grid grid-3">
            {activeModels.map((m) => (
              <div key={m}>
                <h4 className="mb-1" style={{ color: MODEL_COLORS[m] }}>{MODEL_LABELS[m]}</h4>
                {results.models[m].steps.map((s, i) => (
                  <div className="trace" key={i}>
                    <div className="trace-head">{s.label}</div>
                    <div className="trace-formula">{s.formula}</div>
                    <div className="trace-values">
                      {Object.entries(s.values).slice(0, 6).map(([k, v]) => (
                        <span key={k}>{k}: {round(v, 3).toFixed(3)}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="empty-state">
      <div style={{ fontWeight: 650, color: 'var(--text-2)', marginBottom: 4 }}>No results yet</div>
      <div>Run the experiment to compute model outputs, metrics, QAI and recommendation.</div>
    </div>
  );
}