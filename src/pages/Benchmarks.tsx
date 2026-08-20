import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/AppStore';
import { Badge, EmptyState, Modal, Panel } from '../components/ui';
import { IconDelete, IconRun } from '../components/icons';
import { formatDateTime } from '../utils';
import {
  DISJUNCTION_BENCHMARKS,
  QQ_BENCHMARKS,
  type EmpiricalDisjunctionBenchmark,
  type EmpiricalQQBenchmark,
} from '../data/empirical';
import type { DisjunctionBenchmarkRun, QQBenchmarkRun } from '../services/empirical';

function DisjunctionCard({ benchmark }: { benchmark: EmpiricalDisjunctionBenchmark }) {
  const store = useAppStore();
  const [detail, setDetail] = useState<DisjunctionBenchmarkRun | null>(null);
  const runs = store.empiricalRuns
    .filter((r): r is DisjunctionBenchmarkRun => r.domain === 'disjunction' && r.benchmarkId === benchmark.id)
    .sort((a, b) => b.ranAt.localeCompare(a.ranAt));
  const latest = runs[0];
  const { observed } = benchmark.dataset;

  return (
    <Panel
      title={benchmark.name}
      sub={benchmark.description}
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => store.runEmpiricalBenchmarkAction(benchmark)}>
          <IconRun size={13} /> Run
        </button>
      }
    >
      <div className="row wrap mb-2">
        <Badge tone="teal">Disjunction effect</Badge>
        <Badge tone="gray">{benchmark.source}</Badge>
      </div>

      <div className="small text-2 mb-1">
        <span className="text-3">Observed take/defect rates:</span>{' '}
        <span className="mono">
          {observed.map((p) => p.toFixed(2)).join(' / ')}
        </span>{' '}
        <span className="text-3">
          ({benchmark.dataset.conditionLabels.join(' · ')})
        </span>
      </div>

      {latest ? (
        <div className="mt-2">
          <div className="small mb-1">
            <span className="text-3">Quantum fit:</span>{' '}
            <span className="mono">
              μ = {latest.output.models[0].params.mu?.toFixed(2) ?? '—'} · γ ={' '}
              {latest.output.models[0].params.gamma?.toFixed(2) ?? '—'} · predicted{' '}
              {latest.output.models[0].predictions.map((p) => p.toFixed(2)).join(' / ')}
            </span>
          </div>
          <div className="row wrap">
            <Badge tone={latest.output.bestByRmsd === 'quantum-disjunction' ? 'purple' : 'gray'}>
              best RMSD: {latest.output.bestByRmsd.replace('-', ' ')}
            </Badge>
            <Badge tone={latest.output.violationMagnitude > 0.05 ? 'amber' : 'green'}>
              interference {latest.output.observedInterference >= 0 ? '+' : ''}
              {latest.output.observedInterference.toFixed(3)}
            </Badge>
            <Badge tone="gray">
              RMSD {latest.output.models[0].rmsd.toFixed(3)}
            </Badge>
          </div>
          <div className="row-between mt-2">
            <span className="xsmall text-2">Last run {formatDateTime(latest.ranAt)}</span>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(latest)}>
                Details
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => store.deleteEmpiricalRun(latest.id)}>
                <IconDelete size={12} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <span className="xsmall text-3">No runs yet — run the fit to compare models on the published data.</span>
      )}

      <Modal
        open={detail !== null}
        title={benchmark.name}
        onClose={() => setDetail(null)}
      >
        {detail && (<div className="col" style={{ gap: 12 }}>
            <div className="small text-2">
              <span className="text-3">Conclusion:</span> {detail.output.conclusion}
            </div>
            <div>
              <h4 className="mb-1">Model comparison</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th className="ta-r">Predicted (A · B · U)</th>
                    <th className="ta-r">RMSD</th>
                    <th className="ta-r">Interference</th>
                    <th className="ta-r">Params</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.output.models.map((m) => (
                    <tr key={m.modelId}>
                      <td>{m.label}</td>
                      <td className="mono ta-r">{m.predictions.map((p) => p.toFixed(3)).join(' · ')}</td>
                      <td className="mono ta-r">{m.rmsd.toFixed(4)}</td>
                      <td className="mono ta-r">{m.interference.toFixed(4)}</td>
                      <td className="mono ta-r">{m.nParams}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="small text-2">
              Sure-thing mixture prediction:{' '}
              <span className="mono">{detail.output.mixturePrediction.toFixed(3)}</span> · observed unknown:{' '}
              <span className="mono">{detail.output.dataset.observed[2].toFixed(3)}</span> · violation magnitude:{' '}
              <span className="mono">{detail.output.violationMagnitude.toFixed(3)}</span>
            </div>
            {detail.output.bootstrap && (
              <div className="small text-2">
                Bootstrap 95% CIs — μ:{' '}
                <span className="mono">
                  [{detail.output.bootstrap.mu[0].toFixed(3)}, {detail.output.bootstrap.mu[1].toFixed(3)}]
                </span>{' '}
                · interference:{' '}
                <span className="mono">
                  [{detail.output.bootstrap.interference[0].toFixed(3)}, {detail.output.bootstrap.interference[1].toFixed(3)}]
                </span>{' '}
                ({detail.output.bootstrap.resamples} resamples, seed {detail.output.bootstrap.seed})
              </div>
            )}
            <div>
              <h4 className="mb-1">Notes</h4>
              <ul className="small text-2 mb-0">
                {detail.output.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        </Modal>
    </Panel>
  );
}

function QQCard({ benchmark }: { benchmark: EmpiricalQQBenchmark }) {
  const store = useAppStore();
  const [detail, setDetail] = useState<QQBenchmarkRun | null>(null);
  const runs = store.empiricalRuns
    .filter((r): r is QQBenchmarkRun => r.domain === 'question-order' && r.benchmarkId === benchmark.id)
    .sort((a, b) => b.ranAt.localeCompare(a.ranAt));
  const latest = runs[0];
  const { dataset } = benchmark;

  return (
    <Panel
      title={benchmark.name}
      sub={benchmark.description}
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => store.runEmpiricalBenchmarkAction(benchmark)}>
          <IconRun size={13} /> Run
        </button>
      }
    >
      <div className="row wrap mb-2">
        <Badge tone="blue">Question order</Badge>
        <Badge tone="gray">{benchmark.source}</Badge>
        <Badge tone="gray">
          N = {dataset.nAB} / {dataset.nBA}
        </Badge>
      </div>
      <div className="small text-2 mb-1">
        <span className="text-3">A:</span> {dataset.questionA}
        <br />
        <span className="text-3">B:</span> {dataset.questionB}
      </div>

      {latest ? (
        <div className="mt-2">
          <div className="small mb-1">
            <span className="text-3">QQ test:</span>{' '}
            <span className="mono">
              q = {latest.output.qqTest.q.toFixed(4)} · z = {latest.output.qqTest.z.toFixed(2)} · χ²(1) ={' '}
              {latest.output.qqTest.chiSquare.toFixed(2)}
            </span>
          </div>
          <div className="row wrap">
            <Badge tone={latest.output.qqTest.significant ? 'red' : 'green'}>
              {latest.output.qqTest.significant ? 'QQ equality rejected' : 'consistent with QQ equality'}
            </Badge>
            <Badge tone="purple">h = {latest.output.similarity.h.toFixed(4)}</Badge>
            <Badge tone={latest.output.bestByBic === 'quantum-qq' ? 'purple' : 'blue'}>
              BIC: {latest.output.bestByBic.replace('-', ' ')}
            </Badge>
          </div>
          <div className="row-between mt-2">
            <span className="xsmall text-2">Last run {formatDateTime(latest.ranAt)}</span>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(latest)}>
                Details
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => store.deleteEmpiricalRun(latest.id)}>
                <IconDelete size={12} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <span className="xsmall text-3">No runs yet — run the fit to test the QQ prediction on the published data.</span>
      )}

      <Modal
        open={detail !== null}
        title={benchmark.name}
        onClose={() => setDetail(null)}
      >
        {detail && (<div className="col" style={{ gap: 12 }}>
            <div className="small text-2">
              <span className="text-3">Conclusion:</span> {detail.output.conclusion}
            </div>
            <div>
              <h4 className="mb-1">Observed vs. constrained-model fit</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Cell</th>
                    <th className="ta-r">Observed</th>
                    <th className="ta-r">Quantum fit</th>
                  </tr>
                </thead>
                <tbody>
                  {(['AyBy', 'AyBn', 'AnBy', 'AnBn'] as const).map((c, i) => (
                    <tr key={c}>
                      <td>{c}</td>
                      <td className="mono ta-r">{detail.output.dataset.abCells[i].toFixed(4)}</td>
                      <td className="mono ta-r">{detail.output.models.find((m) => m.modelId === 'quantum-qq')!.abCells[i].toFixed(4)}</td>
                    </tr>
                  ))}
                  {(['ByAy', 'ByAn', 'BnAy', 'BnAn'] as const).map((c, i) => (
                    <tr key={c}>
                      <td>{c}</td>
                      <td className="mono ta-r">{detail.output.dataset.baCells[i].toFixed(4)}</td>
                      <td className="mono ta-r">{detail.output.models.find((m) => m.modelId === 'quantum-qq')!.baCells[i].toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="small text-2">
              Order effects — C<sub>A</sub> ={' '}
              <span className="mono">{detail.output.orderEffect.ca.toFixed(4)}</span>, C<sub>B</sub> ={' '}
              <span className="mono">{detail.output.orderEffect.cb.toFixed(4)}</span> · similarity h ={' '}
              <span className="mono">{detail.output.similarity.h.toFixed(4)}</span> (implied 2D angle θ ={' '}
              <span className="mono">{detail.output.similarity.theta.toFixed(3)} rad</span>)
            </div>
            <div>
              <h4 className="mb-1">Model comparison (BIC)</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th className="ta-r">Params</th>
                    <th className="ta-r">LR χ²</th>
                    <th className="ta-r">df</th>
                    <th className="ta-r">BIC</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.output.models.map((m) => (
                    <tr key={m.modelId}>
                      <td>{m.label}</td>
                      <td className="mono ta-r">{m.nParams}</td>
                      <td className="mono ta-r">{m.chiSquare.toFixed(3)}</td>
                      <td className="mono ta-r">{m.df}</td>
                      <td className="mono ta-r">{m.bic.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="mb-1">Notes</h4>
              <ul className="small text-2 mb-0">
                {detail.output.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        </Modal>
    </Panel>
  );
}

export function Benchmarks() {
  const store = useAppStore();
  const navigate = useNavigate();

  const runsFor = (benchmarkId: string) =>
    store.benchmarkRuns
      .filter((r) => r.benchmarkId === benchmarkId)
      .sort((a, b) => b.ranAt.localeCompare(a.ranAt));

  const history = (benchmarkId: string) => {
    const runs = runsFor(benchmarkId);
    if (runs.length === 0) return <span className="xsmall text-3">No runs yet</span>;
    return (
      <div className="col" style={{ gap: 4 }}>
        {runs.slice(0, 5).map((r) => (
          <div key={r.id} className="row-between">
            <span className="xsmall text-2">
              {formatDateTime(r.ranAt)} · QAI <span className="mono">{r.qai.toFixed(2)}</span> · best{' '}
              <Badge tone={r.bestModel === 'quantum' ? 'purple' : r.bestModel === 'bayesian' ? 'green' : 'blue'}>
                {r.bestModel}
              </Badge>
            </span>
            <div className="row" style={{ gap: 4 }}>
              <button
                className="btn btn-ghost btn-sm"
                title="Open run result"
                onClick={() => navigate(`/experiments/${r.experimentId}`)}
              >
                Open
              </button>
              <button
                className="btn btn-ghost btn-sm"
                title="Delete run"
                onClick={() => store.deleteBenchmarkRun(r.id)}
              >
                <IconDelete size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-2">
        <h1>Benchmarks</h1>
        <p className="text-2 small mb-0">
          Predefined benchmark experiments, plus literature benchmarks that re-run the published
          quantum-cognition analyses on their original data.
        </p>
      </div>

      <SectionTitle label="Standard benchmarks" />
      {store.benchmarks.length === 0 ? (
        <EmptyState title="No benchmarks defined" body="Benchmarks ship with the application." />
      ) : (
        <div className="grid grid-2">
          {store.benchmarks.map((b) => {
            const outcomeCount = b.problem.outcomes.length;
            const evidenceCount = b.evidence.length;
            return (
              <Panel
                key={b.id}
                title={b.name}
                sub={b.description}
                actions={
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      store.runBenchmark(b);
                      navigate('/benchmarks');
                    }}
                  >
                    <IconRun size={13} /> Run
                  </button>
                }
              >
                <div className="row wrap mb-2">
                  <Badge tone="gray">{b.category}</Badge>
                  <Badge tone="teal">{outcomeCount} outcomes</Badge>
                  <Badge tone="blue">{evidenceCount} evidence items</Badge>
                  {b.tags.map((t) => (
                    <Badge key={t} tone="gray">{t}</Badge>
                  ))}
                </div>
                <div className="small text-2 mb-1">
                  <span className="text-3">Question:</span> {b.problem.decisionQuestion}
                </div>
                <div className="divider" />
                <h4 className="mb-1">Run History</h4>
                {history(b.id)}
              </Panel>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <SectionTitle label="Literature benchmarks — disjunction effect" />
        <p className="text-2 small">
          Sure-thing-principle violations in two-stage gambling, vacation choice and the prisoner's dilemma
          (Tversky & Shafir 1992; Shafir & Tversky 1992; replications; Pothos & Busemeyer 2009).
          Quantum-inspired model vs. dephased ablation vs. Markov mixture.
        </p>
        <div className="grid grid-2">
          {DISJUNCTION_BENCHMARKS.map((b) => (
            <DisjunctionCard key={b.id} benchmark={b} />
          ))}
        </div>
      </div>

      <div className="mt-3">
        <SectionTitle label="Literature benchmarks — question order effects" />
        <p className="text-2 small">
          Split-ballot survey and laboratory question-order studies (Moore 2002; Wang & Busemeyer 2013).
          Tests the parameter-free QQ equality and compares the constrained quantum model against the
          Markov baseline.
        </p>
        <div className="grid grid-2">
          {QQ_BENCHMARKS.map((b) => (
            <QQCard key={b.id} benchmark={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <h3 className="mt-0 mb-1">{label}</h3>;
}