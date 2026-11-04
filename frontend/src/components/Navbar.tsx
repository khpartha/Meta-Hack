import { Menu, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home' },
  { to: '/inspect', label: 'Inspect' },
]

function linkClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-safety/10 text-safety'
      : 'text-gray-300 hover:bg-white/5 hover:text-white',
  ].join(' ')
}

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-ink/70 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-white" onClick={() => setOpen(false)}>
          <ShieldCheck className="h-6 w-6 text-safety" aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight">SceneGuard AI</span>
        </Link>

        <div className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <button
          type="button"
          className="rounded-md p-2 text-gray-300 hover:bg-white/5 hover:text-white sm:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-line/80 px-4 pb-4 pt-2 sm:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
