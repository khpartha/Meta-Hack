import type { ReactNode } from 'react'

/** Mode panel on the left (top on mobile), results on the right (below on mobile). */
export default function InspectGrid({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {left}
      {right}
    </div>
  )
}
