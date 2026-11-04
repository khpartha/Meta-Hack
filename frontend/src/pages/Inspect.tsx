import { Camera, Radio, Upload, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { USE_MOCK } from '../api/inspect'
import CameraPanel from '../components/inspect/CameraPanel'
import LivePanel from '../components/inspect/LivePanel'
import UploadPanel from '../components/inspect/UploadPanel'

type Mode = 'upload' | 'camera' | 'live'

const MODES: { id: Mode; label: string; icon: LucideIcon }[] = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'live', label: 'Live', icon: Radio },
]

export default function Inspect() {
  const [mode, setMode] = useState<Mode>('upload')

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Inspect</h1>
          <p className="mt-2 text-gray-400">
            Upload a photo or video, snap a camera picture, or monitor a live feed for possible hazards.
          </p>
        </div>
        {USE_MOCK && (
          <span className="rounded-full border border-safety/40 bg-safety/10 px-3 py-1 text-xs font-medium text-safety">
            Mock data
          </span>
        )}
      </div>

      <div role="tablist" aria-label="Inspection mode" className="mt-8 inline-flex rounded-xl border border-line bg-panel/70 p-1">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === id ? 'bg-safety text-ink' : 'text-gray-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Panels unmount on tab change, which stops any camera stream and interval */}
      <div className="mt-6" role="tabpanel">
        {mode === 'upload' && <UploadPanel />}
        {mode === 'camera' && <CameraPanel />}
        {mode === 'live' && <LivePanel />}
      </div>
    </section>
  )
}
