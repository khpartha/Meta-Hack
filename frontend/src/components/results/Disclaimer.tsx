import { TriangleAlert } from 'lucide-react'

export default function Disclaimer() {
  return (
    <p className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-xs text-gray-400">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-safety" aria-hidden="true" />
      AI-assisted inspection. Findings require human verification.
    </p>
  )
}
