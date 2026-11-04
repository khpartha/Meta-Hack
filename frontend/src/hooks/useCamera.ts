import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'off' | 'starting' | 'on'

function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was denied. Allow camera access for this site in your browser settings, then try again.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found. Connect a camera and try again.'
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is in use by another app or could not be started. Close other apps using it and try again.'
    default:
      return 'Could not start the camera.'
  }
}

/**
 * Webcam access. Attach `videoRef` to a <video> that stays mounted.
 * The stream stops automatically when the component unmounts.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Bumped on every start/stop so a slow, outdated start cleans up after itself.
  const attemptRef = useRef(0)
  const [status, setStatus] = useState<CameraStatus>('off')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    attemptRef.current++
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('off')
  }, [])

  const start = useCallback(async (): Promise<boolean> => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't access a camera here. Use a recent browser on localhost or HTTPS.")
      return false
    }

    const attempt = ++attemptRef.current
    setStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { ideal: 'environment' } },
        audio: false,
      })
      if (attempt !== attemptRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return false
      }
      streamRef.current = stream
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current !== stream) return
        stop()
        setError('The camera was disconnected.')
      })

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
      if (attempt !== attemptRef.current) return false
      setStatus('on')
      return true
    } catch (err) {
      if (attempt === attemptRef.current) {
        setError(describeCameraError(err))
        setStatus('off')
      }
      return false
    }
  }, [stop])

  useEffect(() => stop, [stop])

  return { videoRef, status, error, start, stop }
}
