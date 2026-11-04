import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { formatTimestamp } from '../../lib/format'
import type { InspectionResult } from '../../types/inspection'
import FindingCard from './FindingCard'
import ImageResult from './ImageResult'
import VideoResult from './VideoResult'

interface Props {
  result: InspectionResult
  mediaUrl: string
}

/** A finished inspection: summary, media with boxes, and finding cards. */
export default function ResultView({ result, mediaUrl }: Props) {
  const isVideo = result.media_type === 'video'
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null)
  const [hovered, setHovered] = useState<{ frame: number; finding: number } | null>(null)

  const total = result.frames.reduce((n, f) => n + f.findings.length, 0)
  const moments = result.frames.filter((f) => f.findings.length > 0).length
  const highlightIn = (frame: number) => (hovered?.frame === frame ? hovered.finding : null)

  // Video: cards for the selected moment, or every moment. Image: the single frame.
  const frameIndexes = isVideo
    ? selectedFrame !== null
      ? [selectedFrame]
      : result.frames.map((_, i) => i)
    : [0]
  const cards = frameIndexes.flatMap((fi) =>
    (result.frames[fi]?.findings ?? []).map((finding, i) => ({ fi, i, finding })),
  )

  return (
    <div className="space-y-5">
      {total === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <div>
            <p className="font-semibold text-white">No possible hazards found</p>
            <p className="mt-1 text-sm text-gray-400">
              The AI didn't flag anything in this {isVideo ? 'video' : 'scene'}. A person should still check the area.
            </p>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 font-semibold text-white">
          <TriangleAlert className="h-5 w-5 text-safety" aria-hidden="true" />
          {total} possible hazard{total === 1 ? '' : 's'} found
          {isVideo && ` at ${moments} moment${moments === 1 ? '' : 's'}`}
        </p>
      )}

      {isVideo ? (
        <VideoResult
          url={mediaUrl}
          result={result}
          selected={selectedFrame}
          onSelect={setSelectedFrame}
          highlighted={selectedFrame !== null ? highlightIn(selectedFrame) : null}
        />
      ) : (
        <ImageResult
          url={mediaUrl}
          findings={result.frames[0]?.findings ?? []}
          width={result.frame_width}
          height={result.frame_height}
          highlighted={highlightIn(0)}
        />
      )}

      {cards.length > 0 && (
        <div>
          {isVideo && (
            <div className="mb-3 flex items-center justify-between text-sm">
              <p className="text-gray-400">
                {selectedFrame !== null
                  ? `Findings at ${formatTimestamp(result.frames[selectedFrame].timestamp_sec)}`
                  : 'All findings. Click a timeline marker or a time to see its boxes.'}
              </p>
              {selectedFrame !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedFrame(null)}
                  className="text-safety hover:underline"
                >
                  Show all
                </button>
              )}
            </div>
          )}
          <div className="space-y-3">
            {cards.map(({ fi, i, finding }) => (
              <FindingCard
                key={`${fi}-${i}`}
                finding={finding}
                number={i + 1}
                timestamp={isVideo ? result.frames[fi].timestamp_sec : undefined}
                active={hovered?.frame === fi && hovered.finding === i}
                onHover={(on) => setHovered(on ? { frame: fi, finding: i } : null)}
                onTimestampClick={() => setSelectedFrame(fi)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
