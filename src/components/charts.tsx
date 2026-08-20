import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend as RLegend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ModelId, Outcome } from '../types';
import { MODEL_COLORS, MODEL_LABELS } from '../types';

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--panel-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12.5,
  color: 'var(--text)',
};

const AXIS_TICK = { fill: 'var(--text-3)', fontSize: 11.5 };

const BAR_CURSOR = { fill: 'var(--border)', fillOpacity: 0.3 };
const LINE_CURSOR = { stroke: 'var(--border)', strokeWidth: 1 };

const activeBarProps = (color: string) => ({
  fill: color,
  fillOpacity: 1,
  stroke: 'var(--bar-stroke)',
  strokeWidth: 1.5,
});

const CELL_ACTIVE_BAR = {
  stroke: 'var(--bar-stroke)',
  strokeWidth: 1.5,
};

const activeDot = { r: 5, strokeWidth: 2, stroke: 'var(--bg)' };

const GRID_STROKE = 'var(--border-soft)';
const AXIS_LINE = { stroke: 'var(--border)' };

export function ProbabilityComparisonChart({
  outcomes,
  probabilities,
  height = 240,
}: {
  outcomes: Outcome[];
  probabilities: Partial<Record<ModelId, Record<string, number>>>;
  height?: number;
}) {
  const models = (['classical', 'bayesian', 'quantum'] as ModelId[]).filter((m) => probabilities[m]);
  const data = outcomes.map((o) => {
    const row: Record<string, string | number> = { name: o.label };
    models.forEach((m) => (row[MODEL_LABELS[m]] = Math.round((probabilities[m]?.[o.id] ?? 0) * 1000) / 1000));
    return row;
  });

  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 10, bottom: 4, left: -14 }} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} formatter={(value) => [(Number(value) * 100).toFixed(1) + '%', '']} />
          <RLegend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          {models.map((m) => (
            <Bar
              key={m}
              dataKey={MODEL_LABELS[m]}
              fill={MODEL_COLORS[m]}
              radius={[4, 4, 0, 0]}
              maxBarSize={44}
              activeBar={activeBarProps(MODEL_COLORS[m])}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ModelPerformanceChart({
  data,
  height = 240,
}: {
  data: Array<{ model: string; metric: string; value: number }>;
  height?: number;
}) {
  const models = Array.from(new Set(data.map((d) => d.model)));
  const metrics = Array.from(new Set(data.map((d) => d.metric)));
  const chartData = metrics.map((metric) => {
    const row: Record<string, string | number> = { name: metric };
    models.forEach((model) => {
      row[model] = data.find((d) => d.model === model && d.metric === metric)?.value ?? 0;
    });
    return row;
  });

  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 6, right: 10, bottom: 4, left: -14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={LINE_CURSOR} />
          <RLegend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          {models.map((model) => (
            <Line
              key={model}
              type="monotone"
              dataKey={model}
              stroke={MODEL_COLORS[model as ModelId] ?? model}
              strokeWidth={2}
              dot={{ r: 3.5 }}
              activeDot={activeDot}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionChart({
  data,
  height = 240,
}: {
  data: Array<{ name: string; p: number; color: string }>;
  height?: number;
}) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
          <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={90} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} formatter={(value) => [(Number(value) * 100).toFixed(1) + '%', 'Probability']} />
          <Bar dataKey="p" radius={[0, 4, 4, 0]} maxBarSize={26} activeBar={CELL_ACTIVE_BAR}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrderEffectChart({
  data,
  height = 220,
}: {
  data: Array<{ name: string; classical: number | null; quantum: number | null }>;
  height?: number;
}) {
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 10, bottom: 4, left: -14 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 'auto']} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} formatter={(value) => [Number(value).toFixed(3), 'ΔP']} />
          <RLegend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          <Bar dataKey="classical" name="Classical ΔP" fill={MODEL_COLORS.classical} radius={[4, 4, 0, 0]} maxBarSize={40} activeBar={activeBarProps(MODEL_COLORS.classical)} />
          <Bar dataKey="quantum" name="Quantum ΔP" fill={MODEL_COLORS.quantum} radius={[4, 4, 0, 0]} maxBarSize={40} activeBar={activeBarProps(MODEL_COLORS.quantum)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ContextChart({
  data,
  height = 240,
}: {
  data: Array<{ context: string; model: string; probability: number }>;
  height?: number;
}) {
  const models = Array.from(new Set(data.map((d) => d.model)));
  const contexts = Array.from(new Set(data.map((d) => d.context)));
  const chartData = contexts.map((ctx) => {
    const row: Record<string, string | number> = { name: ctx };
    models.forEach((m) => (row[m] = Math.round((data.find((d) => d.context === ctx && d.model === m)?.probability ?? 0) * 1000) / 1000));
    return row;
  });
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 6, right: 10, bottom: 4, left: -14 }} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} formatter={(value) => [(Number(value) * 100).toFixed(1) + '%', '']} />
          <RLegend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          {models.map((m) => (
            <Bar
              key={m}
              dataKey={m}
              fill={MODEL_COLORS[m as ModelId]}
              radius={[4, 4, 0, 0]}
              maxBarSize={38}
              activeBar={activeBarProps(MODEL_COLORS[m as ModelId])}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EvidenceTimeline({
  evidence,
}: {
  evidence: Array<{ id: string; sequence: number; name: string; value: string; confidence: number }>;
}) {
  return (
    <div className="col">
      {evidence.map((e) => (
        <div key={e.id} className="trace" style={{ margin: 0 }}>
          <div className="trace-head">
            <span>
              <span className="mono text-3">E{e.sequence}</span> — {e.name}
            </span>
            <span className="badge badge-gray">{Math.round(e.confidence * 100)}% conf.</span>
          </div>
          <div className="trace-explanation mt-1">{e.value}</div>
        </div>
      ))}
    </div>
  );
}