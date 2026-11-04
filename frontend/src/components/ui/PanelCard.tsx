import type { ReactNode } from 'react'

interface Props {
  title: string
  action?: ReactNode
  children: ReactNode
}

export default function PanelCard({ title, action, children }: Props) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-panel/70 p-4 backdrop-blur-sm sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
