import { CircleAlert, ScanSearch } from 'lucide-react'
import type { InspectState } from '../../types/inspection'
import { btnSecondary } from '../ui/buttons'
import PanelCard from '../ui/PanelCard'
import Disclaimer from './Disclaimer'
import LoadingState from './LoadingState'
import ResultView from './ResultView'

interface Props {
  state: InspectState
  idleText: string
  onRetry?: () => void
}

export default function ResultsPanel({ state, idleText, onRetry }: Props) {
  return (
    <PanelCard title="Results">
      {state.kind === 'idle' && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
          <ScanSearch className="h-10 w-10" aria-hidden="true" />
          <p className="mt-3 max-w-xs text-sm">{idleText}</p>
        </div>
      )}

      {state.kind === 'loading' && <LoadingState />}

      {state.kind === 'error' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4" role="alert">
          <p className="flex items-center gap-2 font-semibold text-red-300">
            <CircleAlert className="h-5 w-5" aria-hidden="true" />
            Inspection failed
          </p>
          <p className="mt-1 text-sm text-gray-300">{state.message}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className={`${btnSecondary} mt-3`}>
              Try again
            </button>
          )}
        </div>
      )}

      {state.kind === 'done' && (
        <ResultView key={state.result.inspection_id} result={state.result} mediaUrl={state.mediaUrl} />
      )}

      <Disclaimer />
    </PanelCard>
  )
}
