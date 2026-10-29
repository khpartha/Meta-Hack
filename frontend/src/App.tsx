import { useEffect, useState } from 'react'

type Health = { status: string; service: string }

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setHealth)
      .catch((e) => setError(String(e)))
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <h1 className="text-2xl font-semibold">SceneGuard AI</h1>
        <p className="text-sm text-slate-400">AI-assisted warehouse safety inspection (prototype)</p>
        <div className="rounded-lg bg-slate-800 p-4 text-sm">
          <span className="text-slate-400">Backend: </span>
          {error ? (
            <span className="text-red-400">unreachable ({error})</span>
          ) : health ? (
            <span className="text-emerald-400">{health.status}</span>
          ) : (
            <span className="text-slate-400">checking…</span>
          )}
        </div>
        {health && <pre className="text-xs text-slate-500">{JSON.stringify(health, null, 2)}</pre>}
      </div>
    </main>
  )
}
