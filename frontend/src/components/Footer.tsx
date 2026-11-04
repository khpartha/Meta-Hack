import { TriangleAlert } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-line/80 bg-ink/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-6 text-center text-sm text-gray-400 sm:flex-row sm:justify-between sm:px-6 sm:text-left">
        <p className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 shrink-0 text-safety" aria-hidden="true" />
          AI-assisted inspection. Findings require human verification.
        </p>
        <p className="text-gray-500">© 2026 SceneGuard AI</p>
      </div>
    </footer>
  )
}
