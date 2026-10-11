import type { ResultInput, RoundInfo } from '../types'
import { fmtPts, resultLabel } from '../format'

interface Props {
  round: RoundInfo
  /** results being typed (only for the round awaiting results) */
  results?: Record<number, number>
  editable: boolean
  onSetResult?: (table: number, whiteScore: number) => void
  onSubmit?: (results: ResultInput[]) => void
  onPrint?: () => void
  onCancelRound?: () => void
  /** label of the submit button */
  submitLabel?: string
  /** extra buttons shown next to the submit button */
  extraActions?: React.ReactNode
}

const OPTIONS = [
  { value: 1, label: '1-0' },
  { value: 0.5, label: '½-½' },
  { value: 0, label: '0-1' },
]

export function Pairings({
  round,
  results = {},
  editable,
  onSetResult,
  onSubmit,
  onPrint,
  onCancelRound,
  submitLabel = 'Valider les résultats',
  extraActions,
}: Props) {
  const games = round.pairings.filter((p) => !p.is_bye)
  const entered = games.filter((g) => results[g.table] !== undefined).length
  const allEntered = entered === games.length

  function submit() {
    const payload: ResultInput[] = games.map((g) => ({
      table: g.table,
      white_score: results[g.table],
    }))
    onSubmit?.(payload)
  }

  return (
    <div>
      <div className="table-scroll">
        <table className="pairings">
          <thead>
            <tr>
              <th className="num">Table</th>
              <th className="num">Pts</th>
              <th>Blancs</th>
              <th className="num">Elo</th>
              <th className="center">Résultat</th>
              <th className="num">Elo</th>
              <th>Noirs</th>
              <th className="num">Pts</th>
            </tr>
          </thead>
          <tbody>
            {round.pairings.map((p) => (
              <tr key={p.table}>
                <td className="num">{p.table}</td>
                <td className="num pts">{fmtPts(p.white_pts)}</td>
                <td className="player">{p.white_name}</td>
                <td className="num muted">{p.white_elo}</td>
                <td className="center">
                  {p.is_bye ? (
                    <span className="badge">exempt</span>
                  ) : editable ? (
                    <select
                      value={results[p.table] ?? ''}
                      onChange={(e) => onSetResult?.(p.table, Number(e.target.value))}
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
                  ) : (
                    <b>{resultLabel(p.white_score)}</b>
                  )}
                </td>
                <td className="num muted">{p.is_bye ? '' : p.black_elo}</td>
                <td className="player">{p.is_bye ? '' : p.black_name}</td>
                <td className="num pts">{p.is_bye ? '' : fmtPts(p.black_pts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Pts = points avant la ronde.</p>

      <div className="actions">
        {editable && onSubmit && (
          <button disabled={!allEntered} onClick={submit}>
            {submitLabel} ({entered}/{games.length})
          </button>
        )}
        {onPrint && (
          <button className="secondary" onClick={onPrint}>
            Imprimer
          </button>
        )}
        {extraActions}
        {onCancelRound && (
          <button className="secondary danger" onClick={onCancelRound}>
            Annuler les appariements
          </button>
        )}
      </div>
    </div>
  )
}
