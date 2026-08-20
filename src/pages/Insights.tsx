import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/AppStore';
import { Badge, EmptyState } from '../components/ui';
import { generateInsights } from '../services/insights';

const KIND_META: Record<string, { label: string; tone: 'purple' | 'green' | 'blue' | 'gray' }> = {
  quantum: { label: 'Quantum-Inspired', tone: 'purple' },
  bayesian: { label: 'Bayesian', tone: 'green' },
  classical: { label: 'Classical', tone: 'blue' },
  neutral: { label: 'Neutral', tone: 'gray' },
};

export function Insights() {
  const store = useAppStore();

  useEffect(() => {
    store.refreshInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.experiments]);

  const insights = useMemo(
    () => (store.insights.length > 0 ? store.insights : generateInsights(store.experiments)),
    [store.insights, store.experiments],
  );

  const summary = useMemo(() => {
    const counts: Record<string, number> = { quantum: 0, bayesian: 0, classical: 0, neutral: 0 };
    insights.forEach((i) => (counts[i.kind] += 1));
    const best = (Object.entries(counts) as Array<[string, number]>).sort((a, b) => b[1] - a[1])[0];
    return { counts, best: best ? (best[0] as keyof typeof KIND_META) : 'neutral' };
  }, [insights]);

  return (
    <div>
      <div className="mb-2">
        <h1>Insights</h1>
        <p className="text-2 small mb-0">
          Patterns detected across stored experiments. Every insight cites the supporting experiments; no causal claims
          are made.
        </p>
      </div>

      <div className="grid grid-4 mb-2">
        {(Object.keys(KIND_META) as Array<keyof typeof KIND_META>).map((kind) => (
          <div key={kind} className="kpi">
            <div className="kpi-label">{KIND_META[kind].label} insights</div>
            <div className="kpi-value">{summary.counts[kind]}</div>
            <div className="kpi-hint">{kind === summary.best ? 'Dominant pattern' : 'Insight count'}</div>
          </div>
        ))}
      </div>

      {insights.length === 0 ? (
        <EmptyState title="No insights yet" body="Complete experiments to generate pattern insights." />
      ) : (
        <div className="grid grid-2">
          {insights.map((ins) => (
            <div key={ins.id} className={`insight-card ${ins.kind}`}>
              <div className="row-between mb-1">
                <Badge tone={KIND_META[ins.kind].tone}>{KIND_META[ins.kind].label}</Badge>
                <span className="xsmall text-3">{ins.evidenceCount} experiment(s)</span>
              </div>
              <h3>{ins.title}</h3>
              <p className="small text-2 mb-1">{ins.body}</p>
              <p className="xsmall text-3 mb-0">{ins.support}</p>
            </div>
          ))}
        </div>
      )}

      <p className="xsmall text-3 mt-2">
        Language note: insights describe observed associations under the selected configurations — they do not prove
        that any model family is generally superior.
      </p>
    </div>
  );
}