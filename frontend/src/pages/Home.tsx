import {
  ArrowRight,
  Cctv,
  ClipboardCheck,
  ImageIcon,
  ScanSearch,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const steps: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Upload,
    title: 'Upload a photo or connect a camera',
    text: 'Send in a photo of the floor, or point SceneGuard at a camera feed.',
  },
  {
    icon: ScanSearch,
    title: 'AI analyzes the scene and locates objects',
    text: 'The AI reviews the scene and outlines the objects that could be a hazard.',
  },
  {
    icon: ClipboardCheck,
    title: 'Get flagged hazards with recommended actions',
    text: 'Each possible hazard comes with evidence, a severity level, and a suggested fix.',
  },
]

const capabilities: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ImageIcon,
    title: 'Image inspection',
    text: 'Upload a photo of an aisle, dock, or work area. SceneGuard flags possible hazards, such as blocked walkways, and draws a box around each one.',
  },
  {
    icon: Cctv,
    title: 'Live camera monitoring',
    text: 'Connect existing cameras so SceneGuard can watch for new hazards as they appear and alert your team.',
  },
]

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        {/* Layers, back to front: photo, left gradient, yellow glow, bottom fade, grid/scanlines */}
        <picture aria-hidden="true" className="absolute inset-0">
          <source srcSet="/HomeMeta.webp" type="image/webp" />
          <img src="/HomeMeta.png" alt="" className="h-full w-full object-cover object-center" fetchPriority="high" />
        </picture>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_right,rgb(10_13_20/0.88)_0%,rgb(10_13_20/0.6)_45%,rgb(10_13_20/0.35)_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[680px] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-safety/15 blur-[120px]"
        />
        {/* Bottom fade sits above the glow so the hero blends into the page with no seam */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,#0a0d14_0%,rgb(10_13_20/0.7)_30%,transparent_65%)]"
        />
        <div aria-hidden="true" className="monitor-fx" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-safety/30 bg-safety/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-safety">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safety" />
            Visual safety inspection
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Spot workplace hazards before they become accidents
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-gray-400 sm:text-lg">
            SceneGuard AI analyzes photos and live camera feeds to flag possible safety hazards
            for your team to review.
          </p>
          <Link
            to="/inspect"
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-safety px-6 py-3 text-base font-semibold text-ink shadow-lg shadow-safety/20 transition hover:bg-yellow-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-safety"
          >
            Start inspection
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-xl border border-line bg-panel/70 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-safety/10 text-safety">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-safety">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-gray-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Capabilities
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {capabilities.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-xl border border-line bg-panel/70 p-6 backdrop-blur-sm transition hover:border-safety/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-safety/10 text-safety">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
              <p className="mt-2 text-gray-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Powered by */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 text-center sm:px-6">
        <p className="text-sm text-gray-500">
          Powered by <span className="font-medium text-gray-300">Meta Muse Spark</span> and{' '}
          <span className="font-medium text-gray-300">SAM 3.1</span>
        </p>
      </section>
    </>
  )
}
