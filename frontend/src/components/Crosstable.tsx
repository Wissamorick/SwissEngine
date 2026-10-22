import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
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

type Outcome = 'win' | 'loss' | 'draw'

/** outcome of the selected player against each opponent ('+' → beaten, '-' → lost to) */
function outcomeOf(result: CrosstableCell['result']): Outcome {
  return result === '+' ? 'win' : result === '-' ? 'loss' : 'draw'
}

/** meet: this cell is the game against the selected player */
function Cell({ cell, meet = false }: { cell: CrosstableCell; meet?: boolean }) {
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
      className={`rc ${kind}${meet ? ' meet' : ''}`}
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
  // The selection may disappear when another round is displayed
  const highlighted = data.rows.find((r) => r.name === highlight)
  const selected = highlighted?.name ?? null
  // opponent name -> result of the selected player against them
  const opponents = new Map<string, Outcome>()
  for (const c of highlighted?.cells ?? []) {
    if (c.opponent && c.result !== null) opponents.set(c.opponent, outcomeOf(c.result))
  }
  const count = (o: Outcome) => [...opponents.values()].filter((v) => v === o).length

  function toggle(name: string) {
    setHighlight(name === selected ? null : name)
  }

  function onRowKey(e: KeyboardEvent<HTMLTableRowElement>, name: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle(name)
    } else if (e.key === 'Escape') {
      setHighlight(null)
    }
  }

  function rowClass(name: string): string | undefined {
    if (!selected) return undefined
    if (name === selected) return 'hl-self'
    const outcome = opponents.get(name)
    return outcome ? `hl-opp hl-${outcome}` : 'hl-dim'
  }

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

      <div className={selected ? 'hl-bar active' : 'hl-bar'} role="status" aria-live="polite">
        <Icon name="info" className="hl-bar-icon" />
        {selected ? (
          <>
            <span>
              Adversaires de <b>{selected}</b> :{' '}
              <span className="hl-key hl-key-win">battus par lui ({count('win')})</span>{' '}
              <span className="hl-key hl-key-loss">l'ont battu ({count('loss')})</span>{' '}
              <span className="hl-key hl-key-draw">nulles ({count('draw')})</span>
              <span className="hl-bar-note">La case encadrée indique la ronde de la rencontre.</span>
            </span>
            <button type="button" className="secondary sm" onClick={() => setHighlight(null)}>
              <Icon name="close" size={14} />
              Effacer
            </button>
          </>
        ) : (
          <span>
            <b>Astuce :</b> cliquez sur un joueur pour surligner ses adversaires.
          </span>
        )}
      </div>

      <div className="table-scroll">
        <table className={selected ? 'data crosstable has-selection' : 'data crosstable'}>
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
                className={rowClass(row.name)}
                onClick={() => toggle(row.name)}
                onKeyDown={(e) => onRowKey(e, row.name)}
                tabIndex={0}
                aria-selected={row.name === selected}
                title={
                  row.name === selected
                    ? 'Cliquer pour désélectionner'
                    : `Voir les adversaires de ${row.name}`
                }
              >
                <td className="rank sticky-1">{row.rank}</td>
                <td className="name sticky-2">{row.name}</td>
                {showClub && <td className="club">{row.club ?? ''}</td>}
                <td className="elo">{row.elo}</td>
                {row.cells.map((c) => (
                  <Cell
                    key={c.round}
                    cell={c}
                    meet={!!selected && row.name !== selected && c.opponent === selected}
                  />
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
        tronqué.
      </p>
    </div>
  )
}
