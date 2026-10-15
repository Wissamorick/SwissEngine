// Brand assets: the logo mark and the "SWISS ENGINE" wordmark.
//
// The mark is logo/Logo.png cropped to its circle with a transparent
// background (the drawing itself is untouched).
// The wordmark is drawn on the same construction as the S and E of the logo:
// bars one stroke thick, a stroke of air between them, 45° chamfers on the
// outer corners only. Units: 1 = one stroke, letters are 5 units high.

import logoMark128 from '../assets/brand/logo-mark-128.png'
import logoMark256 from '../assets/brand/logo-mark-256.png'

const GLYPHS: Record<string, [number, string]> = {
  S: [5, 'M0 1L1 0H5V1H1V2H4L5 3V4L4 5H0V4H4V3H1L0 2Z'],
  E: [5, 'M0 1L1 0H5V1H1V2H4V3H1V4H5V5H1L0 4Z'],
  W: [5, 'M0 0H1V4H2V2H3V4H4V0H5V4L4 5H1L0 4Z'],
  I: [1, 'M0 0H1V5H0Z'],
  N: [5, 'M0 0H1.25L4 3.3V0H5V5H3.75L1 1.7V5H0Z'],
  G: [5, 'M0 1L1 0H5V1H1V4H4V3H2.5V2H5V4L4 5H1L0 4Z'],
}

const LETTER_GAP = 1
const WORD_GAP = 2.4

function layout(text: string) {
  let x = 0
  const paths: { x: number; d: string }[] = []
  for (const ch of text) {
    if (ch === ' ') {
      x += WORD_GAP - LETTER_GAP
      continue
    }
    const [w, d] = GLYPHS[ch]
    paths.push({ x, d })
    x += w + LETTER_GAP
  }
  return { width: x - LETTER_GAP, paths }
}

const WORDMARK = layout('SWISS ENGINE')

export function Wordmark({ height = 13, className }: { height?: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${WORDMARK.width} 5`}
      height={height}
      width={(height * WORDMARK.width) / 5}
      role="img"
      aria-label="SwissEngine"
      fill="currentColor"
    >
      {WORDMARK.paths.map((p, i) => (
        <path key={i} transform={`translate(${p.x} 0)`} d={p.d} />
      ))}
    </svg>
  )
}

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      className={className}
      src={size > 64 ? logoMark256 : logoMark128}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  )
}

/** Logo + wordmark, used in the application header. */
export function BrandLockup({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="brand" onClick={onClick} aria-label="SwissEngine — accueil">
      <LogoMark size={30} />
      <Wordmark height={12} />
    </button>
  )
}
