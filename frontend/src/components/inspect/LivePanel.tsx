import { Radio, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { inspectFrame } from '../../api/inspect'
import { useCamera } from '../../hooks/useCamera'
import { errorMessage, formatClock } from '../../lib/format'
import { captureFrame } from '../../lib/media'
import type { InspectionResult } from '../../types/inspection'
import Disclaimer from '../results/Disclaimer'
import ResultView from '../results/ResultView'
import SeverityBadge from '../results/SeverityBadge'
import { highestSeverity } from '../results/severity'
import { btnDanger, btnPrimary } from '../ui/buttons'
import PanelCard from '../ui/PanelCard'
import InspectGrid from './InspectGrid'

const INTERVALS = [3, 5, 10] as const
const MAX_ALERTS = 50

interface Alert {
  id: string
  time: Date
  url: string
  result: InspectionResult
  count: number
}

export default function LivePanel() {
  const { videoRef, status: camStatus, error: camError, start: startCamera, stop: stopCamera } = useCamera()
  const [running, setRunning] = useState(false)
  // Monitoring stops by itself if the camera drops out (unplugged, permission revoked).
  const active = running && camStatus === 'on'
  const [intervalSec, setIntervalSec] = useState<(typeof INTERVALS)[number]>(5)
  const [frameCount, setFrameCount] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [lastCheck, setLastCheck] = useState<{ time: Date; count: number } | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const alertsRef = useRef<Alert[]>([]) // mirror of `alerts` so URLs can be freed outside render
  const runRef = useRef(0) // bumps on start/stop/unmount; late responses from an old run are dropped
  const busyRef = useRef(false)

  async function startMonitoring() {
    setLiveError(null)
    const ok = await startCamera()
    if (!ok) return
    runRef.current++
    busyRef.current = false
    setFrameCount(0)
    setLastCheck(null)
    setRunning(true)
  }

  function stopMonitoring() {
    runRef.current++
    busyRef.current = false
    setAnalyzing(false)
    setRunning(false)
    stopCamera()
  }

  // Capture + analyze on an interval while monitoring. Skips a tick if the last frame is still being analyzed.
  useEffect(() => {
    if (!active) return
    const run = runRef.current

    async function tick() {
      const video = videoRef.current
      if (busyRef.current || !video) return
      busyRef.current = true
      try {
        const blob = await captureFrame(video, 0.85)
        if (run !== runRef.current) return
        setFrameCount((c) => c + 1)
        setAnalyzing(true)
        const result = await inspectFrame(blob)
        if (run !== runRef.current) return

        const count = result.frames.reduce((n, f) => n + f.findings.length, 0)
        const time = new Date()
        setLastCheck({ time, count })
        setLiveError(null)
        if (count > 0) {
          const alert: Alert = { id: `${time.getTime()}`, time, url: URL.createObjectURL(blob), result, count }
          const next = [alert, ...alertsRef.current]
          next.splice(MAX_ALERTS).forEach((a) => URL.revokeObjectURL(a.url))
          alertsRef.current = next
          setAlerts(next)
        }
      } catch (err) {
        if (run === runRef.current) setLiveError(errorMessage(err))
      } finally {
        if (run === runRef.current) {
          busyRef.current = false
          setAnalyzing(false)
        }
      }
    }

    void tick()
    const id = setInterval(tick, intervalSec * 1000)
    return () => clearInterval(id)
  }, [active, intervalSec, videoRef])

  // Leaving the page: drop pending results and free snapshot URLs. (useCamera stops the stream.)
  useEffect(
    () => () => {
      runRef.current++
      alertsRef.current.forEach((a) => URL.revokeObjectURL(a.url))
      alertsRef.current = []
    },
    [],
  )

  function clearAlerts() {
    alertsRef.current.forEach((a) => URL.revokeObjectURL(a.url))
    alertsRef.current = []
    setAlerts([])
    setSelectedId(null)
  }

  const selected = alerts.find((a) => a.id === selectedId) ?? null

  return (
    <InspectGrid
      left={
        <PanelCard title="Live monitoring">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-line bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`h-full w-full object-contain ${camStatus === 'on' ? '' : 'hidden'}`}
            />
            {camStatus !== 'on' && (
              <div className="flex flex-col items-center text-gray-500">
                <Radio className="h-10 w-10" aria-hidden="true" />
                <p className="mt-2 text-sm">{camStatus === 'starting' ? 'Starting camera…' : 'Not monitoring'}</p>
              </div>
            )}
            {active && (
              <>
                <span className="absolute left-3 top-3 inline-flex animate-pulse items-center gap-1.5 rounded bg-red-600 px-2 py-0.5 text-xs font-bold tracking-wider text-white shadow">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  LIVE
                </span>
                <span className="absolute right-3 top-3 rounded bg-black/70 px-2 py-0.5 font-mono text-xs text-gray-200">
                  Frame {frameCount}
                </span>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {active ? (
              <button type="button" onClick={stopMonitoring} className={`${btnDanger} flex-1`}>
                <Square className="h-4 w-4" aria-hidden="true" />
                Stop monitoring
              </button>
            ) : (
              <button
                type="button"
                onClick={startMonitoring}
                disabled={camStatus === 'starting'}
                className={`${btnPrimary} flex-1`}
              >
                <Radio className="h-4 w-4" aria-hidden="true" />
                {camStatus === 'starting' ? 'Starting…' : 'Start monitoring'}
              </button>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Every</span>
              <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="Capture interval">
                {INTERVALS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setIntervalSec(s)}
                    aria-pressed={intervalSec === s}
                    className={`rounded-md px-2.5 py-1 text-sm font-medium transition ${
                      intervalSec === s ? 'bg-safety text-ink' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 min-h-5 text-sm text-gray-400" aria-live="polite">
            {analyzing
              ? 'Analyzing frame…'
              : lastCheck
                ? `Last check ${formatClock(lastCheck.time)}: ${
                    lastCheck.count > 0 ? `${lastCheck.count} possible hazard(s)` : 'nothing flagged'
                  }`
                : active
                  ? 'Waiting for the first frame…'
                  : ''}
          </p>

          {(camError || liveError) && (
            <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {camError ?? liveError}
            </p>
          )}
        </PanelCard>
      }
      right={
        <PanelCard
          title={`Alerts${alerts.length ? ` (${alerts.length})` : ''}`}
          action={
            alerts.length > 0 && (
              <button type="button" onClick={clearAlerts} className="text-sm text-gray-400 hover:text-white">
                Clear
              </button>
            )
          }
        >
          {selected && (
            <div className="mb-5 rounded-lg border border-line bg-ink/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-white">Frame from {formatClock(selected.time)}</p>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-md p-1 text-gray-400 hover:bg-white/5 hover:text-white"
                  aria-label="Close frame"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ResultView key={selected.id} result={selected.result} mediaUrl={selected.url} />
            </div>
          )}

          {alerts.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">
              No alerts yet. Start monitoring; frames with possible hazards will show up here.
            </p>
          ) : (
            <ul className="max-h-112 space-y-2 overflow-y-auto pr-1">
              {alerts.map((a) => {
                const severity = highestSeverity(a.result.frames.flatMap((f) => f.findings))
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                        a.id === selectedId ? 'border-safety/60 bg-white/4' : 'border-line hover:bg-white/3'
                      }`}
                    >
                      <img src={a.url} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">
                          {a.count} possible hazard{a.count === 1 ? '' : 's'}
                        </p>
                        <p className="font-mono text-xs text-gray-500">{formatClock(a.time)}</p>
                      </div>
                      {severity && <SeverityBadge severity={severity} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <Disclaimer />
        </PanelCard>
      }
    />
  )
}
