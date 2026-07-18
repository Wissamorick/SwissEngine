import type { StandingEntry } from '../types'

interface Props {
  standings: StandingEntry[]
}

export function Standings({ standings }: Props) {
  if (standings.length === 0) return null

  const tiebreakKeys = Object.keys(standings[0].tiebreaks)

  return (
    <div className="card">
      <h2>Classement</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Nom</th>
            <th>Elo</th>
            <th>Pts</th>
            {tiebreakKeys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.name}>
              <td>{s.rank}</td>
              <td>{s.name}</td>
              <td>{s.elo}</td>
              <td>{s.pts}</td>
              {tiebreakKeys.map((k) => (
                <td key={k}>{s.tiebreaks[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
