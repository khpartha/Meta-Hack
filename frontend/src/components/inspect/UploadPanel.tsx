import { FileImage, FileVideo, Play, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { inspectFile } from '../../api/inspect'
import { errorMessage, formatBytes } from '../../lib/format'
import { isVideoFile } from '../../lib/media'
import type { InspectState } from '../../types/inspection'
import ResultsPanel from '../results/ResultsPanel'
import { btnPrimary, btnSecondary } from '../ui/buttons'
import PanelCard from '../ui/PanelCard'
import InspectGrid from './InspectGrid'

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPT = '.jpg,.jpeg,.png,.mp4,.mov,image/jpeg,image/png,video/mp4,video/quicktime'
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'])

function validate(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type) && !/\.(jpe?g|png|mp4|mov)$/i.test(file.name)) {
    return 'Unsupported file type. Use a JPG, PNG, MP4 or MOV file.'
  }
  if (file.size > MAX_BYTES) return `This file is ${formatBytes(file.size)}. The limit is 50 MB.`
  return null
}

export default function UploadPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [state, setState] = useState<InspectState>({ kind: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0) // ignore responses for a file that's been replaced or removed

  // Free the old preview URL whenever it changes, and on unmount.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const isVideo = file ? isVideoFile(file) : false

  function selectFile(f: File) {
    const err = validate(f)
    if (err) {
      setFileError(err)
      return
    }
    requestRef.current++
    setFileError(null)
    setPreviewFailed(false)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setState({ kind: 'idle' })
  }

  function remove() {
    requestRef.current++
    setFile(null)
    setPreviewUrl(null)
    setFileError(null)
    setState({ kind: 'idle' })
  }

  async function run() {
    if (!file || !previewUrl) return
    const id = ++requestRef.current
    setState({ kind: 'loading' })
    try {
      const result = await inspectFile(file)
      if (id === requestRef.current) setState({ kind: 'done', result, mediaUrl: previewUrl })
    } catch (err) {
      if (id === requestRef.current) setState({ kind: 'error', message: errorMessage(err) })
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) selectFile(f)
  }

  const loading = state.kind === 'loading'

  return (
    <InspectGrid
      left={
        <PanelCard title="Upload a photo or video">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) selectFile(f)
              e.target.value = '' // allow picking the same file again
            }}
          />

          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
              }}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-12 text-center transition ${
                dragging ? 'border-safety bg-safety/5' : 'border-line hover:border-gray-500'
              }`}
            >
              <Upload className={`h-10 w-10 ${dragging ? 'text-safety' : 'text-gray-500'}`} aria-hidden="true" />
              <p className="mt-3 font-medium text-white">Drag and drop a photo or video</p>
              <p className="mt-1 text-sm text-gray-500">JPG, PNG, MP4 or MOV, up to 50 MB</p>
              <button type="button" onClick={() => inputRef.current?.click()} className={`${btnSecondary} mt-5`}>
                Browse files
              </button>
            </div>
          ) : (
            <div>
              <div className="overflow-hidden rounded-lg border border-line bg-black">
                {isVideo ? (
                  <video
                    src={previewUrl ?? undefined}
                    controls
                    playsInline
                    className="mx-auto block max-h-80 w-full"
                    onError={() => setPreviewFailed(true)}
                  />
                ) : (
                  <img src={previewUrl ?? undefined} alt="Preview" className="mx-auto block max-h-80 max-w-full" />
                )}
              </div>
              {previewFailed && (
                <p className="mt-2 text-sm text-orange-300">
                  This browser can't preview this video. You can still run the inspection.
                </p>
              )}

              <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-ink/40 p-3">
                {isVideo ? (
                  <FileVideo className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                ) : (
                  <FileImage className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={remove}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Remove
                </button>
              </div>

              <button type="button" onClick={run} disabled={loading} className={`${btnPrimary} mt-4 w-full`}>
                <Play className="h-4 w-4" aria-hidden="true" />
                {loading ? 'Running inspection…' : 'Run inspection'}
              </button>
            </div>
          )}

          {fileError && (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {fileError}
            </p>
          )}
        </PanelCard>
      }
      right={
        <ResultsPanel
          state={state}
          idleText="Upload a photo or video and run an inspection. Results will appear here."
          onRetry={file ? run : undefined}
        />
      }
    />
  )
}
