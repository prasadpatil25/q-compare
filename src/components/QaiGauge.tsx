import type { QaiResult } from '../types';

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const LEVEL_COLORS: Record<QaiResult['level'], string> = {
  low: '#64748b',
  limited: '#f59e0b',
  moderate: '#14b8a6',
  strong: '#7c3aed',
};

export function QaiGauge({
  qai,
  size = 220,
}: {
  qai: { value: number; label: string; level: QaiResult['level'] };
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;
  const value = Math.max(0, Math.min(1, qai.value));
  const angle = -90 + 180 * value;
  const color = LEVEL_COLORS[qai.level];

  return (
    <div className="qai-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`QAI ${qai.value.toFixed(2)} — ${qai.label}`}>
        <path d={arcPath(cx, cy, r, -90, 90)} stroke="var(--track-bg)" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path
          d={arcPath(cx, cy, r, -90, angle)}
          stroke={color}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
        {[0.25, 0.5, 0.75].map((t) => {
          const p = polar(cx, cy, r + 11, -90 + 180 * t);
          return <circle key={t} cx={p.x} cy={p.y} r={2.5} fill="var(--track-tick)" />;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text)" fontSize={30} fontWeight={750} fontFamily="var(--mono)">
          {qai.value.toFixed(2)}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fill={color} fontSize={11.5} fontWeight={700} letterSpacing="0.09em">
          {qai.level.toUpperCase()}
        </text>
      </svg>
      <div className="qai-gauge-label">{qai.label}</div>
    </div>
  );
}