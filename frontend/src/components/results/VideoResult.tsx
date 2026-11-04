import { useEffect, useRef, useState } from 'react'
import { formatTimestamp } from '../../lib/format'
import type { InspectionResult } from '../../types/inspection'
import BoxOverlay from './BoxOverlay'
import { SEVERITY_STYLES, highestSeverity } from './severity'

interface Props {
  url: string
  result: InspectionResult
  /** Index into result.frames whose boxes are shown, or null. */
  selected: number | null
  onSelect: (frameIndex: number | null) => void
  highlighted?: number | null
}

export default function VideoResult({ url, result, selected, onSelect, highlighted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(result.duration_sec)
  const [current, setCurrent] = useState(0)
  const [playbackError, setPlaybackError] = useState(false)
  const selectedFrame = selected !== null ? (result.frames[selected] ?? null) : null

  // Selecting a frame (marker or card) seeks there and pauses.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !selectedFrame) return
    video.pause()
    if (Math.abs(video.currentTime - selectedFrame.timestamp_sec) > 0.05) {
      video.currentTime = selectedFrame.timestamp_sec
    }
  }, [selectedFrame])

  // If the user scrubs away from the selected moment, its boxes no longer apply.
  function handleSeeked() {
    const video = videoRef.current
    if (video && selectedFrame && Math.abs(video.currentTime - selectedFrame.timestamp_sec) > 0.3) {
      onSelect(null)
    }
  }

  const total = duration > 0 ? duration : Math.max(1, ...result.frames.map((f) => f.timestamp_sec))
  const pct = (t: number) => `${Math.min(Math.max(t / total, 0), 1) * 100}%`
  const markers = result.frames
    .map((frame, index) => ({ frame, index, severity: highestSeverity(frame.findings) }))
    .filter((m) => m.severity !== null)

  return (
    <div>
      <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-line bg-black">
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          className="block max-h-[60vh] max-w-full"
          onLoadedMetadata={(e) => {
            if (!(result.duration_sec > 0)) setDuration(e.currentTarget.duration)
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onPlay={() => onSelect(null)}
          onSeeked={handleSeeked}
          onError={() => setPlaybackError(true)}
        />
        {selectedFrame && (
          <BoxOverlay
            findings={selectedFrame.findings}
            width={result.frame_width}
            height={result.frame_height}
            highlighted={highlighted}
          />
        )}
      </div>
      {playbackError && (
        <p className="mt-2 text-sm text-orange-300">This browser can't play this video, but the findings are listed below.</p>
      )}

      {/* Timeline with a marker for each moment that has findings */}
      <div className="mt-4">
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
          <div
            className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-500/60"
            style={{ width: pct(current) }}
          />
          {markers.map(({ frame, index, severity }) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(index)}
              title={`${formatTimestamp(frame.timestamp_sec)}: ${frame.findings.length} possible hazard(s)`}
              aria-label={`Jump to ${formatTimestamp(frame.timestamp_sec)}, ${frame.findings.length} possible hazard(s)`}
              className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink transition hover:scale-125 ${
                SEVERITY_STYLES[severity!].marker
              } ${selected === index ? 'scale-125 ring-2 ring-white' : ''}`}
              style={{ left: pct(frame.timestamp_sec) }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>0:00</span>
          <span className="flex items-center gap-3">
            {(['high', 'medium', 'low'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${SEVERITY_STYLES[s].marker}`} />
                {SEVERITY_STYLES[s].label}
              </span>
            ))}
          </span>
          <span>{formatTimestamp(total)}</span>
        </div>
      </div>
    </div>
  )
}
