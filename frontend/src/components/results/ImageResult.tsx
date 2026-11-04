import type { Finding } from '../../types/inspection'
import BoxOverlay from './BoxOverlay'

interface Props {
  url: string
  findings: Finding[]
  width: number
  height: number
  highlighted?: number | null
}

export default function ImageResult({ url, findings, width, height, highlighted }: Props) {
  return (
    <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-line bg-black">
      <img src={url} alt="Inspected scene" className="block max-h-[60vh] max-w-full" />
      <BoxOverlay findings={findings} width={width} height={height} highlighted={highlighted} />
    </div>
  )
}
