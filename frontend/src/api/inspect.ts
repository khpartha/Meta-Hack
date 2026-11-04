import { getImageSize, getVideoMeta, isVideoFile } from '../lib/media'
import imageMock from '../mocks/image-inspection.json'
import videoMock from '../mocks/video-inspection.json'
import type { BBox, Finding, InspectionResult } from '../types/inspection'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

const MOCK_DELAY_MS = 2000
const IMAGE_MOCK = imageMock as InspectionResult
const VIDEO_MOCK = videoMock as InspectionResult

/** Inspect an uploaded image or video. */
export async function inspectFile(file: File): Promise<InspectionResult> {
  if (!USE_MOCK) return postInspect(file)

  const url = URL.createObjectURL(file)
  try {
    const [result] = await Promise.all([
      isVideoFile(file) ? mockForVideo(url) : mockForImage(url, IMAGE_MOCK),
      delay(MOCK_DELAY_MS),
    ])
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Inspect a single camera frame (camera snapshot or live monitoring). */
export async function inspectFrame(blob: Blob): Promise<InspectionResult> {
  if (!USE_MOCK) {
    return postInspect(new File([blob], `frame-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }))
  }

  const url = URL.createObjectURL(blob)
  try {
    const [result] = await Promise.all([mockForImage(url, randomFrameMock()), delay(MOCK_DELAY_MS)])
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- real API ----------

async function postInspect(file: File): Promise<InspectionResult> {
  const body = new FormData()
  body.append('file', file)

  let res: Response
  try {
    res = await fetch(`${API_URL}/api/inspect`, { method: 'POST', body })
  } catch {
    throw new Error(`Couldn't reach the inspection server at ${API_URL}. Is the backend running?`)
  }

  if (!res.ok) {
    let detail = ''
    try {
      const data = await res.json()
      detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail ?? data)
    } catch {
      // response had no JSON body
    }
    throw new Error(`Inspection failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`)
  }

  return normalize(await res.json())
}

/** Older backend shape: one image, flat findings list. */
interface LegacyReport {
  inspection_id: string
  image_width: number
  image_height: number
  findings?: Finding[]
}

/** Accept the contract shape, plus the older flat shape until the backend is updated. */
function normalize(data: InspectionResult | LegacyReport): InspectionResult {
  if ('frames' in data) return data
  const findings = data.findings ?? []
  return {
    inspection_id: data.inspection_id,
    media_type: 'image',
    status: findings.length > 0 ? 'review_required' : 'no_findings',
    frame_width: data.image_width,
    frame_height: data.image_height,
    duration_sec: 0,
    frames: [{ timestamp_sec: 0, findings }],
  }
}

// ---------- mock helpers ----------

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mockForImage(url: string, mock: InspectionResult): Promise<InspectionResult> {
  const { width, height } = await getImageSize(url).catch(() => ({
    width: mock.frame_width,
    height: mock.frame_height,
  }))
  return scaleMock(mock, width, height)
}

async function mockForVideo(url: string): Promise<InspectionResult> {
  const meta = await getVideoMeta(url).catch(() => null)
  if (!meta || !meta.width || !meta.height) {
    return scaleMock(VIDEO_MOCK, VIDEO_MOCK.frame_width, VIDEO_MOCK.frame_height)
  }
  const duration = Number.isFinite(meta.duration) && meta.duration > 0 ? meta.duration : VIDEO_MOCK.duration_sec
  return scaleMock(VIDEO_MOCK, meta.width, meta.height, duration)
}

/** For camera/live frames: a random subset of the image mock's findings (sometimes none). */
function randomFrameMock(): InspectionResult {
  const findings = IMAGE_MOCK.frames[0].findings.filter(() => Math.random() < 0.5)
  return {
    ...IMAGE_MOCK,
    status: findings.length > 0 ? 'review_required' : 'no_findings',
    frames: [{ timestamp_sec: 0, findings }],
  }
}

/** Scale mock boxes (and timestamps) to the real media so they land somewhere sensible. */
function scaleMock(mock: InspectionResult, width: number, height: number, duration?: number): InspectionResult {
  const sx = width / mock.frame_width
  const sy = height / mock.frame_height
  const st = duration && mock.duration_sec ? duration / mock.duration_sec : 1
  const scaleBox = ([x1, y1, x2, y2]: BBox): BBox => [
    Math.round(x1 * sx),
    Math.round(y1 * sy),
    Math.round(x2 * sx),
    Math.round(y2 * sy),
  ]

  return {
    ...mock,
    inspection_id: `mock-${Math.random().toString(36).slice(2, 10)}`,
    frame_width: width,
    frame_height: height,
    duration_sec: duration ?? mock.duration_sec,
    frames: mock.frames.map((frame) => ({
      timestamp_sec: Math.round(frame.timestamp_sec * st * 10) / 10,
      findings: frame.findings.map((f) => ({
        ...f,
        bounding_box: f.bounding_box ? scaleBox(f.bounding_box) : null,
      })),
    })),
  }
}
