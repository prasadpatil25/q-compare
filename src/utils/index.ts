export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function normalizeWeights(values: number[]): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum <= 0) return values.map(() => 1 / values.length);
  return values.map((v) => v / sum);
}

/** Soft-normalize a probability vector (sums to 1). Values are clamped to >= 0. */
export function normalizeProbabilities(values: Record<string, number>): Record<string, number> {
  const keys = Object.keys(values);
  const raw = keys.map((k) => Math.max(0, values[k]));
  const sum = raw.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  if (sum <= 0) {
    keys.forEach((k) => (out[k] = 1 / keys.length));
    return out;
  }
  keys.forEach((k, i) => (out[k] = raw[i] / sum));
  return out;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

export function maxKey(values: Record<string, number>): string {
  let best = '';
  let bestValue = -Infinity;
  for (const [k, v] of Object.entries(values)) {
    if (v > bestValue) {
      bestValue = v;
      best = k;
    }
  }
  return best;
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 3): string {
  return value.toFixed(digits);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function downloadFile(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function shuffleSeed(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}