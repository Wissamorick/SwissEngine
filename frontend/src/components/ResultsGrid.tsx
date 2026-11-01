import { useEffect, useState } from 'react'
import * as api from '../api'
import type { GridGame, ResultsGrid as GridData } from '../types'
import { TIEBREAK_HELP, TIEBREAK_LABELS } from '../types'
import { fmtPts } from '../format'
import { Banner, Spinner } from './Feedback'
import { Icon } from './Icon'

interface Props {
  tournamentId: string
  showClub: boolean
  /** changes whenever the tournament changes, to refetch */
  version: number
}

function scoreLabel(score: number | null, forfeit = false): string {
  if (score === null) return '·'
  const label = score === 1 ? '1' : score === 0 ? '0' : score === 0.5 ? '½' : fmtPts(score)
  return forfeit ? `${label}F` : label
}

function kind(score: number | null): string {
  if (score === null) return 'todo'
  return score > 0.5 ? 'win' : score < 0.5 ? 'loss' : 'draw'
}

function gameTitle(g: GridGame, opponent: string): string {
  const color = g.color === 'W' ? 'Blancs' : 'Noirs'
  const res = g.score === null ? 'à jouer' : g.forfeit ? `${scoreLabel(g.score)} par forfait` : scoreLabel(g.score)
  return `Ronde ${g.round}, ${color} contre ${opponent} : ${res}`
}

// Round-robin results grid: one row and one column per player (ranking order).
export function ResultsGrid({ tournamentId, showClub, version }: Props) {
  const [data, setData] = useState<GridData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .getResultsGrid(tournamentId)
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
  }, [tournamentId, version])

  if (error) return <Banner tone="error">{error}</Banner>
  if (!data) return <Spinner label="Chargement de la grille…" />

  return (
    <div>
      <div className="panel-toolbar">
        <span className="hint">
          {data.games_played} partie{data.games_played > 1 ? 's' : ''} saisie
          {data.games_played > 1 ? 's' : ''} sur {data.games_total}
        </span>
        <button
          className="secondary sm"
          onClick={() => window.open(api.urls.printResultsGrid(tournamentId), '_blank')}
        >
          <Icon name="print" />
          Imprimer
        </button>
      </div>

      <div className="table-scroll">
        <table className="data crosstable results-grid">
          <thead>
            <tr>
              <th className="sticky-1">Pl</th>
              <th className="left sticky-2">Nom</th>
              {showClub && <th className="left">Club / équipe</th>}
              <th>Elo</th>
              {data.rows.map((r) => (
                <th key={r.name} className="gn" title={r.name}>
                  {r.rank}
                </th>
              ))}
              <th className="pts-col">Pts</th>
              <th title="Parties jouées">J</th>
              {data.tiebreak_keys.map((k) => (
                <th key={k} title={TIEBREAK_HELP[k]}>
                  {TIEBREAK_LABELS[k] ?? k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.name}>
                <td className="rank sticky-1">{row.rank}</td>
                <td className="name sticky-2">{row.name}</td>
                {showClub && <td className="club">{row.club ?? ''}</td>}
                <td className="elo">{row.elo}</td>
                {row.cells.map((games, j) =>
                  games === null ? (
                    <td key={j} className="gc self" aria-label="—" />
                  ) : (
                    <td key={j} className="gc">
                      {games.map((g) => (
                        <span
                          key={g.round}
                          className={`g ${kind(g.score)}`}
                          title={gameTitle(g, data.rows[j].name)}
                        >
                          {scoreLabel(g.score, g.forfeit)}
                        </span>
                      ))}
                    </td>
                  ),
                )}
                <td className="pts">{fmtPts(row.pts)}</td>
                <td className="tb">{row.played}</td>
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
        Chaque case donne le résultat du joueur de la ligne contre le joueur de la colonne
        (numéro = place) : <b className="sym-win">1</b> gain · <b>½</b> nulle ·{' '}
        <b className="sym-loss">0</b> perte · F = forfait · point = partie à jouer.
        {data.legs === 2 && ' Aller-retour : partie aller à gauche, retour à droite.'} Survolez une
        case pour voir la ronde et la couleur.
        {data.tiebreak_keys.includes('Perf') && ' Perf. = performance Elo.'}
      </p>
    </div>
  )
}
