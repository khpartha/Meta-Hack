// Mirrors the POST /api/inspect contract in CLAUDE.md.

export type Severity = 'low' | 'medium' | 'high'

/** [x1, y1, x2, y2] in ORIGINAL media pixels. */
export type BBox = [number, number, number, number]

export interface Finding {
  category: string // "walkway_obstruction" for the MVP
  severity: Severity
  observation: string
  evidence: string
  object: string
  bounding_box: BBox | null
  requires_human_review: boolean
  recommendation: string
}

export interface InspectionFrame {
  timestamp_sec: number
  findings: Finding[]
}

export interface InspectionResult {
  inspection_id: string
  media_type: 'image' | 'video'
  status: 'review_required' | 'no_findings'
  frame_width: number
  frame_height: number
  duration_sec: number
  frames: InspectionFrame[]
}

/** UI state of one inspection request. */
export type InspectState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; result: InspectionResult; mediaUrl: string }
