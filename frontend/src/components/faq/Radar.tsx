// Spider (radar) charts for comparing systems, drawn in plain SVG.
// One small chart per system on identical axes (small multiples): overlaying
// nine polygons on one chart would be unreadable. The recommended system is
// drawn in the brand red, the others in ink; an optional reference system
// (Swiss Dutch by default) is repeated as a dashed outline for comparison.

import { useState } from 'react'
import type { RadarSet, RadarSystem } from './parse'

const SIZE = { w: 264, h: 206 }
const C = { x: 132, y: 110 }
const R = 70

function point(i: number, n: number, value: number, max: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
  const r = (Math.max(0, Math.min(value, max)) / max) * R
  return { x: C.x + r * Math.cos(a), y: C.y + r * Math.sin(a), a }
}

function polygon(scores: number[], max: number) {
  return scores
    .map((v, i) => point(i, scores.length, v, max))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')
}

function fmt(v: number) {
  return String(v).replace('.', ',')
}

export function Radar({
  set,
  system,
  showName = true,
}: {
  set: RadarSet
  system: RadarSystem
  showName?: boolean
}) {
  const [active, setActive] = useState<number | null>(null)
  const n = set.criteria.length
  const reference =
    set.reference && set.reference !== system.name
      ? set.systems.find((s) => s.name === set.reference)
      : undefined
  const rings = Array.from({ length: set.max }, (_, k) => k + 1)
  // no total by default: the criteria are not meant to be added up
  const status =
    active === null ? '' : `${set.criteria[active].long} : ${fmt(system.scores[active])} / ${set.max}`

  return (
    <figure className={system.highlight ? 'radar is-highlight' : 'radar'}>
      {showName && (
        <figcaption className="radar-name">
          {system.name}
          {system.highlight && <span className="badge badge-brand">Recommandé</span>}
        </figcaption>
      )}
      <svg
        viewBox={`0 0 ${SIZE.w} ${SIZE.h}`}
        role="img"
        aria-label={`${system.name} : ${set.criteria
          .map((c, i) => `${c.long} ${fmt(system.scores[i])} sur ${set.max}`)
          .join(', ')}`}
        onMouseLeave={() => setActive(null)}
      >
        {/* grid */}
        {rings.map((k) => (
          <polygon
            key={k}
            className={k === set.max ? 'radar-ring outer' : 'radar-ring'}
            points={polygon(Array(n).fill(k), set.max)}
          />
        ))}
        {set.criteria.map((_, i) => {
          const p = point(i, n, set.max, set.max)
          return <line key={i} className="radar-spoke" x1={C.x} y1={C.y} x2={p.x} y2={p.y} />
        })}

        {reference && (
          <polygon className="radar-ref" points={polygon(reference.scores, set.max)} />
        )}
        <polygon className="radar-area" points={polygon(system.scores, set.max)} />

        {/* axis labels */}
        {set.criteria.map((c, i) => {
          const p = point(i, n, set.max * 1.2, set.max)
          const cos = Math.cos(p.a)
          const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'
          const dx = anchor === 'start' ? 7 : anchor === 'end' ? -7 : 0
          const dy = Math.sin(p.a) > 0.5 ? 10 : Math.sin(p.a) < -0.5 ? -6 : 4
          return (
            <text
              key={i}
              className={active === i ? 'radar-label is-active' : 'radar-label'}
              x={p.x + dx}
              y={p.y + dy}
              textAnchor={anchor}
            >
              {c.short}
            </text>
          )
        })}

        {/* vertices + generous hit targets */}
        {system.scores.map((v, i) => {
          const p = point(i, n, v, set.max)
          return (
            <g key={i} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} tabIndex={0}>
              <circle className={active === i ? 'radar-dot is-active' : 'radar-dot'} cx={p.x} cy={p.y} r={active === i ? 4.5 : 3} />
              <circle className="radar-hit" cx={p.x} cy={p.y} r={12}>
                <title>{`${set.criteria[i].long} : ${fmt(v)} / ${set.max}`}</title>
              </circle>
            </g>
          )
        })}
      </svg>
      <p className="radar-status" aria-hidden>
        {status}
      </p>
    </figure>
  )
}

/** All systems side by side. */
export function RadarGrid({ set }: { set: RadarSet }) {
  return (
    <div className="radar-set">
      {set.title && <p className="radar-title">{set.title}</p>}
      <div className="radar-grid">
        {set.systems.map((s) => (
          <Radar key={s.name} set={set} system={s} />
        ))}
      </div>
      <RadarLegend set={set} />
    </div>
  )
}

export function RadarLegend({ set }: { set: RadarSet }) {
  return (
    <p className="radar-legend">
      {set.reference && (
        <span>
          <span className="radar-key-ref" aria-hidden /> {set.reference} (référence)
        </span>
      )}
      <span>
        Notes sur {set.max} :{' '}
        {set.criteria.map((c, i) => (
          <span key={c.short}>
            {i > 0 && ' · '}
            <b>{c.short}</b>
            {c.long !== c.short && <> = {c.long.charAt(0).toLowerCase() + c.long.slice(1)}</>}
          </span>
        ))}
      </span>
      {set.note && <span>{set.note}</span>}
    </p>
  )
}
