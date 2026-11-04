import { Clock, UserCheck } from 'lucide-react'
import { formatTimestamp } from '../../lib/format'
import type { Finding } from '../../types/inspection'
import SeverityBadge from './SeverityBadge'
import { SEVERITY_STYLES } from './severity'

interface Props {
  finding: Finding
  /** Matches the number drawn on its box. */
  number: number
  /** Video only: when this finding was seen. */
  timestamp?: number
  active?: boolean
  onHover?: (hovering: boolean) => void
  onTimestampClick?: () => void
}

function categoryLabel(category: string) {
  const text = category.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function FindingCard({ finding, number, timestamp, active, onHover, onTimestampClick }: Props) {
  const s = SEVERITY_STYLES[finding.severity]
  return (
    <article
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={`rounded-lg border p-4 transition ${active ? 'border-safety/60 bg-white/4' : 'border-line bg-ink/40'}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className={`flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-bold ${s.chip}`}>
          {number}
        </span>
        <h3 className="font-semibold capitalize text-white">{finding.object}</h3>
        <SeverityBadge severity={finding.severity} />
        {timestamp !== undefined && (
          <button
            type="button"
            onClick={onTimestampClick}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatTimestamp(timestamp)}
          </button>
        )}
      </header>
      <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{categoryLabel(finding.category)}</p>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-gray-500">Observation</dt>
          <dd className="text-gray-200">{finding.observation}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Evidence</dt>
          <dd className="text-gray-300">{finding.evidence}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Recommendation</dt>
          <dd className="text-gray-200">{finding.recommendation}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {finding.requires_human_review && (
          <span className="inline-flex items-center gap-1 rounded-full border border-safety/40 bg-safety/10 px-2 py-0.5 text-xs font-medium text-safety">
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Needs human review
          </span>
        )}
        {!finding.bounding_box && (
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-gray-400">No location box</span>
        )}
      </div>
    </article>
  )
}
