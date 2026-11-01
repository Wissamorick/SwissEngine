import { useEffect, useState } from 'react'
import type { RoundInfo, Score } from '../types'
import { Pairings } from './Pairings'

interface Props {
  rounds: RoundInfo[]
  /** rounds of one leg (second leg = "retour" in a double round-robin) */
  legRounds: number
  double: boolean
  /** round to show first (first round with a missing result) */
  initialRound: number
  /** save one result at once; null clears it */
  onSetResult: (round: number, table: number, whiteScore: Score | null) => void
  onPrint: (round: number) => void
}

/**
 * Round-robin calendar: every round exists from the start and the results
 * can be entered in any order (each click is saved immediately).
 */
export function Schedule({ rounds, legRounds, double, initialRound, onSetResult, onPrint }: Props) {
  const [selected, setSelected] = useState(Math.min(initialRound, rounds.length) || 1)

  // stay inside the calendar if it changes (reload, end of tournament)
  useEffect(() => {
    if (selected > rounds.length) setSelected(Math.max(1, rounds.length))
  }, [rounds.length, selected])

  const round = rounds[selected - 1]
  if (!round) return null

  const games = (r: RoundInfo) => r.pairings.filter((p) => !p.is_bye)
  const entered = (r: RoundInfo) => games(r).filter((p) => p.white_score !== null).length
  const results: Record<number, Score> = {}
  for (const p of games(round)) if (p.white_score !== null) results[p.table] = p.white_score

  const legs = double
    ? [
        { label: 'Aller', rounds: rounds.filter((r) => r.round <= legRounds) },
        { label: 'Retour', rounds: rounds.filter((r) => r.round > legRounds) },
      ].filter((l) => l.rounds.length > 0)
    : [{ label: '', rounds }]

  function label(r: RoundInfo): string {
    if (!double) return `R${r.round}`
    return r.round <= legRounds ? `A${r.round}` : `R${r.round - legRounds}`
  }

  function title(r: RoundInfo): string {
    const leg = double ? (r.round <= legRounds ? ' (aller)' : ` (retour ${r.round - legRounds})`) : ''
    return `Ronde ${r.round}${leg} : ${entered(r)}/${games(r).length} résultats`
  }

  return (
    <div className="schedule">
      <div className="schedule-tabs" role="tablist" aria-label="Rondes du calendrier">
        {legs.map((leg) => (
          <span key={leg.label || 'all'} className="schedule-group">
            {leg.label && <span className="schedule-leg">{leg.label}</span>}
            {leg.rounds.map((r) => {
              const done = entered(r) === games(r).length
              const started = entered(r) > 0
              return (
                <button
                  key={r.round}
                  role="tab"
                  aria-selected={r.round === selected}
                  className={`schedule-tab${done ? ' done' : started ? ' partial' : ''}`}
                  title={title(r)}
                  onClick={() => setSelected(r.round)}
                >
                  {double ? label(r) : r.round}
                </button>
              )
            })}
          </span>
        ))}
      </div>

      <div className="schedule-head">
        <h3>
          Ronde {round.round}
          {double && (
            <span className="card-sub">
              {round.round <= legRounds ? 'aller' : `retour de la ronde ${round.round - legRounds}`}
            </span>
          )}
        </h3>
        <span className="hint">
          Résultats saisis : {entered(round)}/{games(round).length} · enregistrés dès le clic ·
          recliquer pour effacer
        </span>
      </div>

      <Pairings
        round={round}
        results={results}
        editable
        onSetResult={(table, score) => onSetResult(round.round, table, score)}
        onClearResult={(table) => onSetResult(round.round, table, null)}
        onPrint={() => onPrint(round.round)}
      />
    </div>
  )
}
