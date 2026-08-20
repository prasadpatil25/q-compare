import { useState, type DragEvent } from 'react';
import type { EvidenceItem } from '../types';
import { IconDelete, IconEdit, IconGrip } from './icons';
import { ConfidenceBar } from './ui';

/**
 * Drag-and-drop evidence list. Order is preserved because order effects
 * matter for quantum-inspired modeling.
 */
export function EvidenceList({
  items,
  onChange,
  onEdit,
}: {
  items: EvidenceItem[];
  onChange: (items: EvidenceItem[]) => void;
  onEdit?: (item: EvidenceItem) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const onDrop = (targetIndex: number) => {
    if (dragIndex == null || dragIndex === targetIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    next.forEach((e, i) => (e.sequence = i + 1));
    onChange(next);
    setDragIndex(null);
    setOverIndex(null);
  };

  const onDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    setOverIndex(index);
  };

  return (
    <div className="col">
      {items.map((item, index) => (
        <div
          key={item.id}
          className={`evidence-card ${dragIndex === index ? 'dragging' : ''} ${overIndex === index && dragIndex != null ? 'drag-over' : ''}`}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => onDragOver(e, index)}
          onDrop={() => onDrop(index)}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
          role="listitem"
        >
          <span className="evidence-index">
            <IconGrip size={15} />
          </span>
          <div className="evidence-index">{String(index + 1).padStart(2, '0')}</div>
          <div className="evidence-body">
            <div className="evidence-name">{item.name}</div>
            <div className="evidence-value">{item.value}</div>
            <div className="evidence-meta mt-1">
              <span>Confidence</span>
              <ConfidenceBar value={item.confidence} />
              <span>{Math.round(item.confidence * 100)}%</span>
              <span>Context: {item.context || '—'}</span>
            </div>
          </div>
          {onEdit && (
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`}>
              <IconEdit size={14} />
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            aria-label={`Delete ${item.name}`}
            onClick={() => onChange(items.filter((x) => x.id !== item.id).map((x, i) => ({ ...x, sequence: i + 1 })))}
          >
            <IconDelete size={14} />
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <div className="empty-state">No evidence yet. Add evidence to define the decision context.</div>
      )}
    </div>
  );
}