import type { Finding, Severity } from '../../types/inspection'

export const SEVERITY_STYLES: Record<
  Severity,
  { label: string; badge: string; box: string; chip: string; marker: string }
> = {
  high: {
    label: 'High',
    badge: 'bg-red-500/15 text-red-300 ring-red-500/40',
    box: 'border-red-500',
    chip: 'bg-red-500 text-white',
    marker: 'bg-red-500',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-orange-400/15 text-orange-300 ring-orange-400/40',
    box: 'border-orange-400',
    chip: 'bg-orange-400 text-ink',
    marker: 'bg-orange-400',
  },
  low: {
    label: 'Low',
    badge: 'bg-sky-400/15 text-sky-300 ring-sky-400/40',
    box: 'border-sky-400',
    chip: 'bg-sky-400 text-ink',
    marker: 'bg-sky-400',
  },
}

const RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 }

export function highestSeverity(findings: Finding[]): Severity | null {
  return findings.reduce<Severity | null>(
    (top, f) => (top === null || RANK[f.severity] > RANK[top] ? f.severity : top),
    null,
  )
}
