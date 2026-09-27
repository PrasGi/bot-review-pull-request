export type ChartTone = 'accent' | 'success' | 'warning' | 'error' | 'info' | 'highlight' | 'ink' | 'neutral';

export const TONE: Record<ChartTone, string> = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  info: 'var(--info)',
  highlight: 'var(--highlight)',
  ink: 'var(--text)',
  neutral: 'var(--surface)',
};

/** Rounds up to 1, 2, 5 or 10 × a power of ten, so axis ticks land on readable values. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}
