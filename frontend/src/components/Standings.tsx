import type { StandingEntry } from '../types'
import { TIEBREAK_LABELS } from '../types'
import { fmtPts } from '../format'

interface Props {
  standings: StandingEntry[]
  showClub: boolean
}

export function Standings({ standings, showClub }: Props) {
  if (standings.length === 0) return <p className="muted">Aucun joueur.</p>

  const tiebreakKeys = Object.keys(standings[0].tiebreaks)

  return (
    <div className="table-scroll">
      <table className="standings">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Nom</th>
            {showClub && <th>Club / équipe</th>}
            <th className="num">Elo</th>
            <th className="num">Pts</th>
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
              {showClub && <td className="club">{s.club ?? ''}</td>}
              <td className="num muted">{s.elo}</td>
              <td className="num">
                <b>{fmtPts(s.pts)}</b>
              </td>
              {tiebreakKeys.map((k) => (
                <td key={k} className="num">
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
