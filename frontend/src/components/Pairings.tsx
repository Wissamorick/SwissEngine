import type { Pairing, ResultInput } from '../types'

interface Props {
  pairings: Pairing[]
  results: Record<number, number>
  awaitingResults: boolean
  onSetResult: (table: number, whiteScore: number) => void
  onSubmit: (results: ResultInput[]) => void
}

const OPTIONS = [
  { value: 1, label: '1-0' },
  { value: 0.5, label: '½-½' },
  { value: 0, label: '0-1' },
]

export function Pairings({
  pairings,
  results,
  awaitingResults,
  onSetResult,
  onSubmit,
}: Props) {
  const games = pairings.filter((p) => !p.is_bye)
  const allEntered = games.every((g) => results[g.table] !== undefined)

  function submit() {
    const payload: ResultInput[] = games.map((g) => ({
      table: g.table,
      white_score: results[g.table],
    }))
    onSubmit(payload)
  }

  return (
    <div className="card">
      <h2>Appariements</h2>
      <table>
        <thead>
          <tr>
            <th>Table</th>
            <th>Blancs</th>
            <th>Noirs</th>
            <th>Résultat</th>
          </tr>
        </thead>
        <tbody>
          {pairings.map((p) => (
            <tr key={p.table}>
              <td>{p.table}</td>
              <td>{p.white_name}</td>
              <td>{p.is_bye ? '— (bye)' : p.black_name}</td>
              <td>
                {p.is_bye ? (
                  <span className="muted">bye</span>
                ) : (
                  <select
                    value={results[p.table] ?? ''}
                    disabled={!awaitingResults}
                    onChange={(e) => onSetResult(p.table, Number(e.target.value))}
                  >
                    <option value="" disabled>
                      …
                    </option>
                    {OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {awaitingResults && (
        <button disabled={!allEntered} onClick={submit}>
          Valider les résultats
        </button>
      )}
    </div>
  )
}
