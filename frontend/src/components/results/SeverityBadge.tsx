import type { Severity } from '../../types/inspection'
import { SEVERITY_STYLES } from './severity'

export default function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLES[severity]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.badge}`}>
      {s.label}
    </span>
  )
}
