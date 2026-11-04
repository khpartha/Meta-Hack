const base =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-safety disabled:cursor-not-allowed disabled:opacity-50'

export const btnPrimary = `${base} bg-safety text-ink hover:bg-yellow-300 disabled:hover:bg-safety`
export const btnSecondary = `${base} border border-line bg-white/5 text-gray-200 hover:bg-white/10`
export const btnDanger = `${base} bg-red-600 text-white hover:bg-red-500`
