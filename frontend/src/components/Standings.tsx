import type { StandingEntry } from '../types'
import { TIEBREAK_LABELS } from '../types'
import { fmtPts } from '../format'
import { EmptyState } from './Feedback'

interface Props {
  standings: StandingEntry[]
  showClub: boolean
}

export function Standings({ standings, showClub }: Props) {
  if (standings.length === 0)
    return (
      <EmptyState title="Aucun joueur inscrit">
        Le classement s'affichera dès que les joueurs seront enregistrés.
      </EmptyState>
    )

  const tiebreakKeys = Object.keys(standings[0].tiebreaks)

  return (
    <div className="table-scroll">
      <table className="data standings">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Nom</th>
            {showClub && <th className="col-club">Club / équipe</th>}
            <th className="num col-elo">Elo</th>
            <th className="num col-points">Pts</th>
            {tiebreakKeys.map((k) => (
              <th key={k} className="num">
                {TIEBREAK_LABELS[k] ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.name}>
              <td className="num rank">{s.rank}</td>
              <td className="player">{s.name}</td>
              {showClub && <td className="club col-club">{s.club ?? ''}</td>}
              <td className="num muted col-elo">{s.elo}</td>
              <td className="num col-points">{fmtPts(s.pts)}</td>
              {tiebreakKeys.map((k) => (
                <td key={k} className="num tb">
                  {fmtPts(s.tiebreaks[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
