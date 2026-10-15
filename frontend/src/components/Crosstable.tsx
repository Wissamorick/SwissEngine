import { useEffect, useState } from 'react'
import * as api from '../api'
import type { Crosstable as CrosstableData, CrosstableCell } from '../types'
import { TIEBREAK_LABELS } from '../types'
import { fmtPts } from '../format'
import { Banner, EmptyState, Spinner } from './Feedback'
import { Icon } from './Icon'

interface Props {
  tournamentId: string
  completedRounds: number
  showClub: boolean
  /** changes whenever the tournament changes, to refetch */
  version: number
}

function Cell({ cell }: { cell: CrosstableCell }) {
  if (cell.bye) {
    return (
      <td className="rc bye" title="Exempt">
        EXE
      </td>
    )
  }
  if (cell.result === null) return <td className="rc">—</td>
  const kind = cell.result === '+' ? 'win' : cell.result === '-' ? 'loss' : 'draw'
  const color = cell.color === 'W' ? 'B' : 'N'
  return (
    <td
      className={`rc ${kind}`}
      title={`${cell.color === 'W' ? 'Blancs' : 'Noirs'} contre ${cell.opponent} (${fmtPts(cell.points)} pt)`}
    >
      <span className="sym">{cell.result === '-' ? '−' : cell.result}</span>
      <span className="opp">{cell.opponent_rank ?? '?'}</span>
      <span className="col">{color}</span>
    </td>
  )
}

// Grille américaine: one row per player (ranking order), one column per round.
export function Crosstable({ tournamentId, completedRounds, showClub, version }: Props) {
  const [afterRound, setAfterRound] = useState(completedRounds)
  const [data, setData] = useState<CrosstableData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)

  // Follow the latest round when a new round is completed
  useEffect(() => {
    setAfterRound(completedRounds)
  }, [completedRounds])

  useEffect(() => {
    let cancelled = false
    api
      .getCrosstable(tournamentId, Math.min(afterRound, completedRounds))
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [tournamentId, afterRound, completedRounds, version])

  if (completedRounds === 0) {
    return (
      <EmptyState title="Pas encore de grille">
        La grille américaine apparaîtra dès que les résultats de la première ronde seront validés.
      </EmptyState>
    )
  }
  if (error) return <Banner tone="error">{error}</Banner>
  if (!data) return <Spinner label="Chargement de la grille…" />

  const rounds = Array.from({ length: data.after_round }, (_, i) => i + 1)
  const highlighted = data.rows.find((r) => r.name === highlight)
  const opponents = new Set(highlighted?.cells.map((c) => c.opponent).filter(Boolean))

  return (
    <div>
      <div className="panel-toolbar">
        <label className="inline-label">
          Après la ronde
          <select
            className="input-sm"
            value={afterRound}
            onChange={(e) => setAfterRound(Number(e.target.value))}
          >
            {Array.from({ length: completedRounds }, (_, i) => i + 1).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary sm"
          onClick={() =>
            window.open(api.urls.printCrosstable(tournamentId, data.after_round), '_blank')
          }
        >
          <Icon name="print" />
          Imprimer
        </button>
      </div>

      <div className="table-scroll">
        <table className="data crosstable">
          <thead>
            <tr>
              <th className="sticky-1">Pl</th>
              <th className="left sticky-2">Nom</th>
              {showClub && <th className="left">Club / équipe</th>}
              <th>Elo</th>
              {rounds.map((r) => (
                <th key={r} className="round-col">
                  R{r}
                </th>
              ))}
              <th className="pts-col">Pts</th>
              {data.tiebreak_keys.map((k) => (
                <th key={k}>{TIEBREAK_LABELS[k] ?? k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.name}
                className={
                  row.name === highlight ? 'hl-self' : opponents.has(row.name) ? 'hl-opp' : undefined
                }
                onClick={() => setHighlight(row.name === highlight ? null : row.name)}
                aria-selected={row.name === highlight}
              >
                <td className="rank sticky-1">{row.rank}</td>
                <td className="name sticky-2">{row.name}</td>
                {showClub && <td className="club">{row.club ?? ''}</td>}
                <td className="elo">{row.elo}</td>
                {row.cells.map((c) => (
                  <Cell key={c.round} cell={c} />
                ))}
                <td className="pts">{fmtPts(row.pts)}</td>
                {data.tiebreak_keys.map((k) => (
                  <td key={k} className="tb">
                    {fmtPts(row.tiebreaks[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint table-note">
        <b className="sym-win">+</b> gain · <b>=</b> nulle · <b className="sym-loss">−</b> perte ·
        numéro = place de l'adversaire · B = Blancs, N = Noirs · EXE = exempt · Tr. = Buchholz
        tronqué. Cliquez sur un joueur pour surligner ses adversaires.
      </p>
    </div>
  )
}
