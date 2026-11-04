export interface MediaSize {
  width: number
  height: number
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|mov)$/i.test(file.name)
}

export function getImageSize(src: string): Promise<MediaSize> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not read the image.'))
    img.src = src
  })
}

export function getVideoMeta(src: string): Promise<MediaSize & { duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () =>
      resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration })
    video.onerror = () => reject(new Error('Could not read the video.'))
    video.src = src
  })
}

/** Draw the current video frame onto a canvas and return it as a JPEG. */
export function captureFrame(video: HTMLVideoElement, quality = 0.9): Promise<Blob> {
  const { videoWidth: width, videoHeight: height } = video
  if (!width || !height) return Promise.reject(new Error('The camera is not ready yet.'))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Could not capture a frame.'))
  ctx.drawImage(video, 0, 0, width, height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not capture a frame.'))),
      'image/jpeg',
      quality,
    ),
  )
}
