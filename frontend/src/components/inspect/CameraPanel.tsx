import { Aperture, Camera, CameraOff, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { inspectFrame } from '../../api/inspect'
import { useCamera } from '../../hooks/useCamera'
import { errorMessage } from '../../lib/format'
import { captureFrame } from '../../lib/media'
import type { InspectState } from '../../types/inspection'
import ResultsPanel from '../results/ResultsPanel'
import { btnPrimary, btnSecondary } from '../ui/buttons'
import PanelCard from '../ui/PanelCard'
import InspectGrid from './InspectGrid'

interface Snapshot {
  blob: Blob
  url: string
}

export default function CameraPanel() {
  const { videoRef, status: camStatus, error: camError, start: startCamera, stop: stopCamera } = useCamera()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [state, setState] = useState<InspectState>({ kind: 'idle' })
  const requestRef = useRef(0)

  useEffect(() => () => {
    if (snapshot) URL.revokeObjectURL(snapshot.url)
  }, [snapshot])

  async function capture() {
    const video = videoRef.current
    if (!video) return
    try {
      const blob = await captureFrame(video)
      setCaptureError(null)
      setSnapshot({ blob, url: URL.createObjectURL(blob) })
      setState({ kind: 'idle' })
    } catch (err) {
      setCaptureError(errorMessage(err))
    }
  }

  function retake() {
    requestRef.current++
    setSnapshot(null)
    setState({ kind: 'idle' })
    if (camStatus === 'off') void startCamera()
  }

  async function run() {
    if (!snapshot) return
    const id = ++requestRef.current
    setState({ kind: 'loading' })
    try {
      const result = await inspectFrame(snapshot.blob)
      if (id === requestRef.current) setState({ kind: 'done', result, mediaUrl: snapshot.url })
    } catch (err) {
      if (id === requestRef.current) setState({ kind: 'error', message: errorMessage(err) })
    }
  }

  const live = camStatus === 'on' && !snapshot
  const loading = state.kind === 'loading'

  return (
    <InspectGrid
      left={
        <PanelCard
          title="Camera snapshot"
          action={
            camStatus === 'on' && (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
              >
                <CameraOff className="h-4 w-4" aria-hidden="true" />
                Stop camera
              </button>
            )
          }
        >
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-line bg-black">
            {/* Kept mounted so the stream can attach to it */}
            <video
              ref={videoRef}
              muted
              playsInline
              className={`h-full w-full object-contain ${live ? '' : 'hidden'}`}
            />
            {snapshot && <img src={snapshot.url} alt="Captured snapshot" className="h-full w-full object-contain" />}
            {!live && !snapshot && (
              <div className="flex flex-col items-center text-gray-500">
                <Camera className="h-10 w-10" aria-hidden="true" />
                <p className="mt-2 text-sm">{camStatus === 'starting' ? 'Starting camera…' : 'Camera is off'}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {!snapshot && camStatus !== 'on' && (
              <button
                type="button"
                onClick={() => void startCamera()}
                disabled={camStatus === 'starting'}
                className={`${btnPrimary} flex-1`}
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                {camStatus === 'starting' ? 'Starting…' : 'Start camera'}
              </button>
            )}
            {live && (
              <button type="button" onClick={capture} className={`${btnPrimary} flex-1`}>
                <Aperture className="h-4 w-4" aria-hidden="true" />
                Capture
              </button>
            )}
            {snapshot && (
              <>
                <button type="button" onClick={retake} disabled={loading} className={`${btnSecondary} flex-1`}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Retake
                </button>
                <button type="button" onClick={run} disabled={loading} className={`${btnPrimary} flex-1`}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {loading ? 'Running…' : 'Run inspection'}
                </button>
              </>
            )}
          </div>

          {(camError || captureError) && (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {camError ?? captureError}
            </p>
          )}
        </PanelCard>
      }
      right={
        <ResultsPanel
          state={state}
          idleText="Start the camera, capture a snapshot, and run an inspection. Results will appear here."
          onRetry={snapshot ? run : undefined}
        />
      }
    />
  )
}
