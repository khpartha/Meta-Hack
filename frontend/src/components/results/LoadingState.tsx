import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

// The API doesn't report progress, so these advance on a timer to show it's still working.
const STEPS = [
  { text: 'Analyzing scene…', at: 0 },
  { text: 'Locating objects…', at: 1200 },
  { text: 'Checking safety rules…', at: 6000 },
  { text: 'Preparing report…', at: 14000 },
]

export default function LoadingState() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers = STEPS.slice(1).map((s, i) => setTimeout(() => setStep(i + 1), s.at))
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="status" aria-live="polite">
      <LoaderCircle className="h-10 w-10 animate-spin text-safety" aria-hidden="true" />
      <p className="mt-4 font-medium text-white">{STEPS[step].text}</p>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span key={s.text} className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-safety' : 'bg-line'}`} />
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-500">This can take 10–30 seconds.</p>
    </div>
  )
}
