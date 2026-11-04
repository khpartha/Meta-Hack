import type { Finding } from '../../types/inspection'
import { SEVERITY_STYLES } from './severity'

interface Props {
  findings: Finding[]
  /** Original media size the boxes are expressed in. */
  width: number
  height: number
  highlighted?: number | null
}

const pct = (value: number, total: number) => `${(Math.min(Math.max(value, 0), total) / total) * 100}%`

/**
 * Draws numbered boxes over media. Positions are percentages of the original
 * size, so they stay aligned at any display size without measuring the DOM.
 * The parent must be `relative` and exactly the size of the displayed media.
 */
export default function BoxOverlay({ findings, width, height, highlighted = null }: Props) {
  if (!width || !height) return null
  return (
    <div className="pointer-events-none absolute inset-0">
      {findings.map((f, i) => {
        if (!f.bounding_box) return null
        const [x1, y1, x2, y2] = f.bounding_box
        const s = SEVERITY_STYLES[f.severity]
        const active = highlighted === i
        return (
          <div
            key={i}
            className={`absolute rounded-sm border-2 transition ${s.box} ${
              active ? 'bg-white/10 ring-2 ring-white/80' : highlighted !== null ? 'opacity-50' : ''
            }`}
            style={{
              left: pct(x1, width),
              top: pct(y1, height),
              width: pct(x2 - x1, width),
              height: pct(y2 - y1, height),
            }}
          >
            <span className={`absolute left-0 top-0 rounded-br px-1.5 text-xs font-bold leading-5 ${s.chip}`}>
              {i + 1}
            </span>
          </div>
        )
      })}
    </div>
  )
}
