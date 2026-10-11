// Display helpers shared by the tables (same conventions as the printed files).

/** 3 -> "3", 2.5 -> "2½", 0.5 -> "½", 2.25 -> "2.25" */
export function fmtPts(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const v = Math.round(value * 100) / 100
  const whole = Math.trunc(v)
  const frac = Math.round((v - whole) * 100) / 100
  if (frac === 0) return String(whole)
  if (frac === 0.5) return whole === 0 ? '½' : `${whole}½`
  return String(v)
}

export function resultLabel(whiteScore: number | null): string {
  if (whiteScore === null) return ''
  if (whiteScore === 1) return '1-0'
  if (whiteScore === 0) return '0-1'
  if (whiteScore === 0.5) return '½-½'
  return String(whiteScore)
}

export function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
