import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EvidenceItem, Experiment, ModelId, ModelSelection, Outcome } from '../types';
import { EXPERIMENT_CATEGORIES, MODEL_LABELS } from '../types';
import { useAppStore } from '../store/AppStore';
import { Panel, Badge, Modal } from '../components/ui';
import { EvidenceList } from '../components/EvidenceList';
import { ResultsView } from '../components/ResultsView';
import { ModelDetailDrawer } from '../components/ModelDetailDrawer';
import { IconCheck } from '../components/icons';
import { uid } from '../utils';

const STEP_LABELS = ['Problem', 'Evidence', 'Models', 'Configure', 'Run', 'Results'];

const EMPTY_EVIDENCE: EvidenceItem = {
  id: '',
  name: '',
  description: '',
  value: '',
  confidence: 0.7,
  context: '',
  sequence: 0,
  source: '',
  likelihood: {},
};

export function NewExperiment() {
  const store = useAppStore();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Experiment>(() => ({
    id: uid('exp'),
    name: '',
    description: '',
    researchQuestion: '',
    category: 'Sequential Evidence',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    status: 'draft',
    problem: {
      decisionQuestion: '',
      alternatives: [
        { id: 'a1', label: 'Alternative A' },
        { id: 'a2', label: 'Alternative B' },
      ],
      outcomes: [
        { id: 'o1', label: 'Outcome 1', utility: 5, priorProbability: 0.4 },
        { id: 'o2', label: 'Outcome 2', utility: 3, priorProbability: 0.35 },
        { id: 'o3', label: 'Outcome 3', utility: 1, priorProbability: 0.25 },
      ],
    },
    evidence: [],
    models: { classical: true, bayesian: true, quantum: true },
    config: {
      classical: { probabilityMethod: 'frequency', utilityMethod: 'expected-utility' },
      bayesian: { priorSource: 'outcome-priors', updateStrategy: 'sequential' },
      quantum: {
        stateRepresentation: 'amplitude-vector',
        amplitudeInit: 'sqrt-prior',
        contextTransformation: 'unitary-mix',
        interferenceMode: 'on',
        measurement: 'born-rule',
        rotationStrength: 1,
        contextStrength: 1,
      },
      qaiWeights: { ...store.settings.qaiWeights },
    },
  }));

  const [editingEvidence, setEditingEvidence] = useState<EvidenceItem | null>(null);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [runPhase, setRunPhase] = useState(-1);
  const [runComplete, setRunComplete] = useState(false);
  const [drawerModel, setDrawerModel] = useState<ModelId | null>(null);

  const patch = (p: Partial<Experiment>) => setDraft((d) => ({ ...d, ...p, updatedAt: new Date().toISOString() }));

  const patchOutcomes = (outcomes: Outcome[]) =>
    patch({ problem: { ...draft.problem, outcomes } });

  const patchEvidence = (evidence: EvidenceItem[]) => patch({ evidence });

  const validateStep = (s: number): boolean => {
    if (s === 0) {
      if (!draft.name.trim()) return false;
      if (!draft.problem.decisionQuestion.trim()) return false;
      if (draft.problem.outcomes.length < 2) return false;
      return true;
    }
    if (s === 1) {
      return draft.evidence.every((e) => e.name.trim() && e.value.trim());
    }
    if (s === 2) {
      return Object.values(draft.models).some(Boolean);
    }
    return true;
  };

  const go = (s: number) => {
    if (s < step) {
      setStep(s);
      return;
    }
    if (validateStep(step)) setStep(s);
  };

  const saveDraft = () => {
    const saved = store.saveDraft({ ...draft, status: draft.status === 'completed' ? 'completed' : 'draft' });
    setSavedId(saved.id);
  };

  const run = () => {
    saveDraft();
    const phases = [
      'Preparing experiment',
      'Validating input',
      'Running Classical model',
      'Running Bayesian model',
      'Running Quantum-Inspired model',
      'Calculating evaluation metrics',
      'Calculating QAI',
    ];
    setRunComplete(false);
    setRunPhase(0);
    phases.forEach((_, i) => {
      window.setTimeout(() => setRunPhase(i), i * 140);
    });
    window.setTimeout(() => {
      const completed = store.runExperimentAction(draft.id);
      if (completed) {
        setDraft(completed);
        setRunComplete(true);
        setRunPhase(phases.length);
        window.setTimeout(() => setStep(5), 250);
      }
    }, phases.length * 140 + 60);
  };

  const outcomeIds = useMemo(() => draft.problem.outcomes.map((o) => o.id), [draft.problem.outcomes]);

  const openEvidenceEditor = (item?: EvidenceItem) => {
    if (item) {
      setEditingEvidence({ ...item });
    } else {
      const likelihood: Record<string, number> = {};
      outcomeIds.forEach((id) => (likelihood[id] = 0.5));
      setEditingEvidence({ ...EMPTY_EVIDENCE, id: uid('ev'), likelihood });
    }
    setEvidenceModalOpen(true);
  };

  const saveEvidence = () => {
    if (!editingEvidence) return;
    const exists = draft.evidence.some((e) => e.id === editingEvidence.id);
    const next = exists
      ? draft.evidence.map((e) => (e.id === editingEvidence.id ? editingEvidence : e))
      : [...draft.evidence, { ...editingEvidence, sequence: draft.evidence.length + 1 }];
    patchEvidence(next);
    setEvidenceModalOpen(false);
    setEditingEvidence(null);
  };

  const toggleModel = (m: ModelId) => {
    const models: ModelSelection = { ...draft.models, [m]: !draft.models[m] };
    patch({ models });
  };

  return (
    <div>
      <div className="row-between mb-2 wrap">
        <div>
          <h1>New Experiment</h1>
          <p className="text-2 small mb-0">Define Problem → Evidence → Models → Configure → Run → Results</p>
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={saveDraft}>Save Draft</button>
        </div>
      </div>

      <div className="wizard-steps" role="tablist" aria-label="Experiment wizard steps">
        {STEP_LABELS.map((label, i) => (
          <button
            key={label}
            role="tab"
            aria-selected={step === i}
            className={`wizard-step ${step === i ? 'active' : ''} ${i < step ? 'done' : ''}`}
            onClick={() => go(i)}
          >
            <span className="step-num">{i < step ? '✓' : i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="grid grid-2">
          <Panel title="Basic Information">
            <div className="field">
              <label htmlFor="exp-name">Experiment name *</label>
              <input
                id="exp-name"
                className="input"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Job Offer — Sequential Evidence"
              />
            </div>
            <div className="field">
              <label htmlFor="exp-desc">Description</label>
              <textarea
                id="exp-desc"
                className="textarea"
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="What is this experiment about?"
              />
            </div>
            <div className="field">
              <label htmlFor="exp-rq">Research question</label>
              <textarea
                id="exp-rq"
                className="textarea"
                value={draft.researchQuestion}
                onChange={(e) => patch({ researchQuestion: e.target.value })}
                placeholder="What question does this experiment answer?"
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="exp-cat">Category</label>
                <select
                  id="exp-cat"
                  className="select"
                  value={draft.category}
                  onChange={(e) => patch({ category: e.target.value as Experiment['category'] })}
                >
                  {EXPERIMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="exp-dataset">Dataset</label>
                <select
                  id="exp-dataset"
                  className="select"
                  value={draft.datasetId ?? ''}
                  onChange={(e) => patch({ datasetId: e.target.value || undefined })}
                >
                  <option value="">None</option>
                  {store.datasets.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>

          <Panel title="Decision Definition">
            <div className="field">
              <label htmlFor="exp-question">Decision question *</label>
              <input
                id="exp-question"
                className="input"
                value={draft.problem.decisionQuestion}
                onChange={(e) => patch({ problem: { ...draft.problem, decisionQuestion: e.target.value } })}
                placeholder="Which job offer should the decision-maker accept?"
              />
            </div>
            <h4 className="mb-1">Alternatives</h4>
            <div className="col mb-2">
              {draft.problem.alternatives.map((alt, i) => (
                <div key={alt.id} className="row">
                  <input
                    className="input flex-1"
                    value={alt.label}
                    aria-label={`Alternative ${i + 1}`}
                    onChange={(e) =>
                      patch({
                        problem: {
                          ...draft.problem,
                          alternatives: draft.problem.alternatives.map((a) =>
                            a.id === alt.id ? { ...a, label: e.target.value } : a,
                          ),
                        },
                      })
                    }
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-label={`Remove alternative ${alt.label}`}
                    onClick={() =>
                      patch({ problem: { ...draft.problem, alternatives: draft.problem.alternatives.filter((a) => a.id !== alt.id) } })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn btn-sm"
              onClick={() =>
                patch({
                  problem: {
                    ...draft.problem,
                    alternatives: [...draft.problem.alternatives, { id: uid('a'), label: `Alternative ${draft.problem.alternatives.length + 1}` }],
                  },
                })
              }
            >
              + Add Alternative
            </button>

            <h4 className="mt-3 mb-1">Outcomes, Utility & Prior</h4>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Outcome</th>
                    <th className="num">Utility</th>
                    <th className="num">Prior P(H)</th>
                    <th>Observed?</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.problem.outcomes.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <input
                          className="input"
                          style={{ minWidth: 130 }}
                          value={o.label}
                          aria-label={`Outcome label ${o.id}`}
                          onChange={(e) =>
                            patchOutcomes(
                              draft.problem.outcomes.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                            )
                          }
                        />
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          step="1"
                          className="input"
                          style={{ width: 74 }}
                          value={o.utility}
                          aria-label={`Utility for ${o.label}`}
                          onChange={(e) =>
                            patchOutcomes(
                              draft.problem.outcomes.map((x) => (x.id === o.id ? { ...x, utility: Number(e.target.value) || 0 } : x)),
                            )
                          }
                        />
                      </td>
                      <td className="num">
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          className="input"
                          style={{ width: 74 }}
                          value={o.priorProbability}
                          aria-label={`Prior for ${o.label}`}
                          onChange={(e) =>
                            patchOutcomes(
                              draft.problem.outcomes.map((x) =>
                                x.id === o.id ? { ...x, priorProbability: Math.min(1, Math.max(0, Number(e.target.value) || 0)) } : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="radio"
                          name="observed-outcome"
                          checked={draft.problem.observedOutcomeId === o.id}
                          aria-label={`Mark ${o.label} as observed`}
                          onChange={() => patch({ problem: { ...draft.problem, observedOutcomeId: o.id } })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn btn-sm mt-1"
              onClick={() =>
                patchOutcomes([
                  ...draft.problem.outcomes,
                  { id: uid('o'), label: `Outcome ${draft.problem.outcomes.length + 1}`, utility: 0, priorProbability: 0.1 },
                ])
              }
            >
              + Add Outcome
            </button>
            <p className="xsmall text-3 mt-1 mb-0">
              The observed outcome (ground truth) enables accuracy, log-likelihood, Brier score and prediction-error metrics.
            </p>
          </Panel>
        </div>
      )}

      {step === 1 && (
        <Panel
          title="Evidence / Context"
          sub="Order is preserved — order effects are important for quantum-inspired modeling. Drag evidence cards to reorder."
          actions={
            <button className="btn btn-primary btn-sm" onClick={() => openEvidenceEditor()}>+ Add Evidence</button>
          }
        >
          <EvidenceList items={draft.evidence} onChange={patchEvidence} onEdit={openEvidenceEditor} />
        </Panel>
      )}

      {step === 2 && (
        <div className="grid grid-3">
          {(
            [
              {
                id: 'classical' as ModelId,
                desc: 'Frequency-based probability and expected-utility reasoning.',
                items: ['Normalized outcome probabilities', 'Expected utility', 'Maximum-probability decision'],
              },
              {
                id: 'bayesian' as ModelId,
                desc: 'Explicit priors, likelihoods and sequential posterior updates.',
                items: ['Prior + Evidence → Posterior', 'Sequential update visualization', 'P(H|E) = P(E|H)·P(H) / P(E)'],
              },
              {
                id: 'quantum' as ModelId,
                desc: 'Amplitude vectors, context phases and interference (simulated).',
                items: ['Amplitudes + Born rule', 'Context transformation', 'Interference + order sensitivity'],
              },
            ] as Array<{ id: ModelId; desc: string; items: string[] }>
          ).map((card) => (
            <div
              key={card.id}
              className={`model-select-card ${draft.models[card.id] ? 'selected' : ''}`}
              role="checkbox"
              aria-checked={draft.models[card.id]}
              tabIndex={0}
              onClick={() => toggleModel(card.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleModel(card.id);
                }
              }}
            >
              <div className="model-title">
                {MODEL_LABELS[card.id]}
                {draft.models[card.id] && (
                  <span className="badge badge-green"><IconCheck size={11} /> Selected</span>
                )}
              </div>
              <div className="model-desc">{card.desc}</div>
              <ul className="small text-2 mb-1" style={{ margin: 0, paddingLeft: 18 }}>
                {card.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-2">
          <Panel title="Classical Configuration">
            <div className="field">
              <label htmlFor="class-method">Probability method</label>
              <select
                id="class-method"
                className="select"
                value={draft.config.classical.probabilityMethod}
                onChange={(e) =>
                  patch({ config: { ...draft.config, classical: { ...draft.config.classical, probabilityMethod: e.target.value as 'frequency' | 'conditional' } } })
                }
              >
                <option value="frequency">Frequency (prior × mean likelihood)</option>
                <option value="conditional">Conditional (prior × product of likelihoods)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="class-util">Utility method</label>
              <select
                id="class-util"
                className="select"
                value={draft.config.classical.utilityMethod}
                onChange={(e) =>
                  patch({ config: { ...draft.config, classical: { ...draft.config.classical, utilityMethod: e.target.value as 'expected-utility' | 'max-probability' } } })
                }
              >
                <option value="expected-utility">Expected utility</option>
                <option value="max-probability">Maximum probability</option>
              </select>
            </div>
          </Panel>

          <Panel title="Bayesian Configuration">
            <div className="field">
              <label htmlFor="bay-prior">Prior distribution</label>
              <select
                id="bay-prior"
                className="select"
                value={draft.config.bayesian.priorSource}
                onChange={(e) =>
                  patch({ config: { ...draft.config, bayesian: { ...draft.config.bayesian, priorSource: e.target.value as 'outcome-priors' | 'uniform' } } })
                }
              >
                <option value="outcome-priors">Outcome base probabilities</option>
                <option value="uniform">Uniform</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="bay-update">Update strategy</label>
              <select
                id="bay-update"
                className="select"
                value={draft.config.bayesian.updateStrategy}
                onChange={(e) =>
                  patch({ config: { ...draft.config, bayesian: { ...draft.config.bayesian, updateStrategy: e.target.value as 'sequential' | 'batch' } } })
                }
              >
                <option value="sequential">Sequential (per evidence item)</option>
                <option value="batch">Batch (all evidence at once)</option>
              </select>
            </div>
          </Panel>

          <div className="mt-2" style={{ gridColumn: '1 / -1' }}><Panel title="Quantum-Inspired Configuration">
            <div className="grid grid-3">
              <div className="field">
                <label htmlFor="q-amp">Amplitude initialization</label>
                <select
                  id="q-amp"
                  className="select"
                  value={draft.config.quantum.amplitudeInit}
                  onChange={(e) =>
                    patch({ config: { ...draft.config, quantum: { ...draft.config.quantum, amplitudeInit: e.target.value as 'sqrt-prior' | 'uniform' } } })
                  }
                >
                  <option value="sqrt-prior">αᵢ = √P(Hᵢ) (sqrt of priors)</option>
                  <option value="uniform">αᵢ = 1/√N (uniform)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="q-ctx">Context transformation</label>
                <select
                  id="q-ctx"
                  className="select"
                  value={draft.config.quantum.contextTransformation}
                  onChange={(e) =>
                    patch({ config: { ...draft.config, quantum: { ...draft.config.quantum, contextTransformation: e.target.value as 'unitary-mix' | 'none' } } })
                  }
                >
                  <option value="unitary-mix">Unitary phase mix e&#123;iλ|c⟩⟨c|&#125;</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="q-int">Interference mode</label>
                <select
                  id="q-int"
                  className="select"
                  value={draft.config.quantum.interferenceMode}
                  onChange={(e) =>
                    patch({ config: { ...draft.config, quantum: { ...draft.config.quantum, interferenceMode: e.target.value as 'on' | 'off' } } })
                  }
                >
                  <option value="on">On (phases active)</option>
                  <option value="off">Off (no phase interference)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="q-strength">Rotation strength <span className="text-3">({draft.config.quantum.rotationStrength.toFixed(1)}×)</span></label>
                <input
                  id="q-strength"
                  type="range"
                  min="0.2"
                  max="2"
                  step="0.1"
                  className="input"
                  value={draft.config.quantum.rotationStrength}
                  onChange={(e) => patch({ config: { ...draft.config, quantum: { ...draft.config.quantum, rotationStrength: Number(e.target.value) } } })}
                />
              </div>
              <div className="field">
                <label htmlFor="q-ctxstr">Context strength <span className="text-3">({draft.config.quantum.contextStrength.toFixed(1)}×)</span></label>
                <input
                  id="q-ctxstr"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  className="input"
                  value={draft.config.quantum.contextStrength}
                  onChange={(e) => patch({ config: { ...draft.config, quantum: { ...draft.config.quantum, contextStrength: Number(e.target.value) } } })}
                />
              </div>
            </div>
            <p className="xsmall text-3 mb-0">
              State representation: amplitude vector |ψ⟩ = Σαᵢ|i⟩; measurement: Born rule P(i) = |αᵢ|².
              The quantum-inspired model is a classical numerical simulation — it does not run on a quantum computer.
            </p>
          </Panel></div>
        </div>
      )}

      {step === 4 && (
        <Panel title="Run Models" sub="All selected models run on the same experiment definition">
          <div className="run-steps mb-2">
            {[
              'Preparing experiment',
              'Validating input',
              'Running Classical model',
              'Running Bayesian model',
              'Running Quantum-Inspired model',
              'Calculating evaluation metrics',
              'Calculating QAI',
            ].map((label, i) => (
              <div
                key={label}
                className={`run-step-row ${runPhase > i || runComplete ? 'done' : ''} ${runPhase === i && !runComplete ? 'active' : ''}`}
              >
                <span className="state">{runPhase > i || runComplete ? '✓' : runPhase === i ? '●' : '○'}</span>
                {label}
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-primary btn-lg" onClick={run} disabled={runPhase >= 0 && !runComplete}>
              {runPhase >= 0 && !runComplete ? 'Running…' : 'Run Models'}
            </button>
            {runComplete && <Badge tone="green">Completed — {draft.results?.durationMs}ms</Badge>}
          </div>
          <p className="xsmall text-3 mt-2 mb-0">
            Progress reflects the actual pipeline stages. The run is deterministic — results are reproducible from the
            stored configuration.
          </p>
        </Panel>
      )}

      {step === 5 && draft.results && (
        <ResultsView experiment={draft} onOpenModel={setDrawerModel} />
      )}

      <div className="wizard-actions">
        <button className="btn" onClick={() => (step === 0 ? navigate('/experiments') : go(step - 1))} disabled={step === 4 && runPhase >= 0 && !runComplete}>
          {step === 0 ? 'Cancel' : '← Back'}
        </button>
        <div className="row">
          {savedId && <Badge tone="green">Draft saved</Badge>}
          {step < 5 && (
            <button className="btn btn-primary" onClick={() => (step === 4 ? run() : go(step + 1))} disabled={!validateStep(step)}>
              {step === 4 ? 'Run Models' : 'Continue →'}
            </button>
          )}
          {step === 5 && (
            <button className="btn btn-primary" onClick={() => navigate(`/experiments/${draft.id}`)}>
              Open Experiment Detail
            </button>
          )}
        </div>
      </div>

      <Modal
        open={evidenceModalOpen}
        title={editingEvidence && draft.evidence.some((e) => e.id === editingEvidence.id) ? 'Edit Evidence' : 'Add Evidence'}
        onClose={() => setEvidenceModalOpen(false)}
        actions={
          <>
            <button className="btn" onClick={() => setEvidenceModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEvidence}>Save</button>
          </>
        }
      >
        {editingEvidence && (
          <div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="ev-name">Name *</label>
                <input
                  id="ev-name"
                  className="input"
                  value={editingEvidence.name}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, name: e.target.value })}
                  placeholder="e.g. Salary"
                />
              </div>
              <div className="field">
                <label htmlFor="ev-value">Value *</label>
                <input
                  id="ev-value"
                  className="input"
                  value={editingEvidence.value}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, value: e.target.value })}
                  placeholder="e.g. ₹20 LPA"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="ev-desc">Description</label>
              <input
                id="ev-desc"
                className="input"
                value={editingEvidence.description ?? ''}
                onChange={(e) => setEditingEvidence({ ...editingEvidence, description: e.target.value })}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="ev-conf">Confidence: <span className="text-teal">{Math.round(editingEvidence.confidence * 100)}%</span></label>
                <input
                  id="ev-conf"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  className="input"
                  value={editingEvidence.confidence}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, confidence: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor="ev-ctx">Context</label>
                <input
                  id="ev-ctx"
                  className="input"
                  value={editingEvidence.context}
                  onChange={(e) => setEditingEvidence({ ...editingEvidence, context: e.target.value })}
                  placeholder="e.g. Compensation"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="ev-src">Source / reference</label>
              <input
                id="ev-src"
                className="input"
                value={editingEvidence.source ?? ''}
                onChange={(e) => setEditingEvidence({ ...editingEvidence, source: e.target.value })}
              />
            </div>
            <h4 className="mb-1">Likelihood P(E | outcome)</h4>
            <p className="xsmall text-3 mb-1">Probability of observing this evidence given each outcome.</p>
            <div className="col">
              {draft.problem.outcomes.map((o) => (
                <div key={o.id} className="row">
                  <span className="small text-2" style={{ width: 120 }}>{o.label}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="input flex-1"
                    aria-label={`Likelihood for ${o.label}`}
                    value={editingEvidence.likelihood[o.id] ?? 0.5}
                    onChange={(e) =>
                      setEditingEvidence({
                        ...editingEvidence,
                        likelihood: { ...editingEvidence.likelihood, [o.id]: Number(e.target.value) },
                      })
                    }
                  />
                  <span className="mono small" style={{ width: 44, textAlign: 'right' }}>
                    {((editingEvidence.likelihood[o.id] ?? 0.5) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ModelDetailDrawer experiment={draft} modelId={drawerModel} onClose={() => setDrawerModel(null)} />
    </div>
  );
}