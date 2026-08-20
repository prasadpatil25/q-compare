import type { ReactNode } from 'react';
import type { ExperimentStatus } from '../types';
import { IconClose } from './icons';

export function Panel({
  title,
  sub,
  actions,
  children,
  className = '',
  tight = false,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return (
    <section className={`panel ${tight ? 'panel-tight' : ''} ${className}`}>
      {(title || actions) && (
        <div className="panel-title">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <div className="panel-sub">{sub}</div>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: 'purple' | 'teal' | 'blue' | 'green' | 'amber';
}) {
  const color =
    accent === 'purple'
      ? 'text-purple'
      : accent === 'teal'
        ? 'text-teal'
        : accent === 'blue'
          ? 'text-blue'
          : accent === 'green'
            ? 'text-green'
            : accent === 'amber'
              ? 'text-amber'
              : undefined;
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${color ?? ''}`}>{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = 'gray',
}: {
  children: ReactNode;
  tone?: 'purple' | 'teal' | 'blue' | 'green' | 'amber' | 'red' | 'gray';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: ExperimentStatus }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`badge badge-${status === 'completed' ? 'green' : status === 'running' ? 'amber' : status === 'ready' ? 'blue' : 'gray'}`}>
      <span className={`status-dot status-${status}`} />
      {label}
    </span>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="row-between mb-2">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <IconClose size={15} />
          </button>
        </div>
        {children}
        {actions && <div className="row mt-2" style={{ justifyContent: 'flex-end' }}>{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div style={{ fontWeight: 650, color: 'var(--text-2)', marginBottom: 4 }}>{title}</div>
      {body && <div>{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.label} className="legend-item">
          <span className="legend-swatch" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-2">
      <h2>{title}</h2>
      {sub && <p className="text-2 small mb-0">{sub}</p>}
    </div>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const tone = value >= 0.75 ? 'var(--green)' : value >= 0.5 ? 'var(--amber)' : 'var(--text-3)';
  return (
    <div className="comp-bar-track" style={{ width: 60, height: 6 }} role="img" aria-label={`Confidence ${Math.round(value * 100)}%`}>
      <div className="comp-bar-fill" style={{ width: `${value * 100}%`, background: tone }} />
    </div>
  );
}
export function PageLoader({ label }: { label: string }) {
  return (
    <div className="page-loader" role="status" aria-label={label}>
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}
