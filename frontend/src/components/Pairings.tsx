import type { ResultInput, RoundInfo } from '../types'
import { fmtPts, resultLabel } from '../format'
import { Icon } from './Icon'

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
  { value: 1, label: '1-0', name: 'gain des Blancs' },
  { value: 0.5, label: '½-½', name: 'nulle' },
  { value: 0, label: '0-1', name: 'gain des Noirs' },
]

/** One click per game instead of a drop-down: faster at the arbiter's table. */
function ResultPicker({
  table,
  value,
  onChange,
}: {
  table: number
  value: number | undefined
  onChange: (v: number) => void
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={`Résultat table ${table}`}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={`Table ${table} : ${o.name}`}
          className="seg-btn"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** "2½ pts · 1955" under the name on small screens (the columns are hidden there). */
function MobileMeta({ pts, elo }: { pts: number; elo: number }) {
  return (
    <span className="m-meta">
      {fmtPts(pts)} pt · {elo}
    </span>
  )
}

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
    <div className="pairings-block">
      <div className="table-scroll">
        <table className={editable ? 'data pairings editable' : 'data pairings'}>
          <thead>
            <tr>
              <th className="num col-table">Table</th>
              <th className="num col-pts">Pts</th>
              <th className="col-white">
                <span className="side side-w" aria-hidden />
                Blancs
              </th>
              <th className="num col-elo">Elo</th>
              <th className="center col-result">Résultat</th>
              <th className="num col-elo">Elo</th>
              <th className="col-black">
                <span className="side side-b" aria-hidden />
                Noirs
              </th>
              <th className="num col-pts">Pts</th>
            </tr>
          </thead>
          <tbody>
            {round.pairings.map((p) => {
              const value = results[p.table]
              return (
                <tr
                  key={p.table}
                  className={
                    p.is_bye ? 'bye' : editable && value !== undefined ? 'entered' : undefined
                  }
                >
                  <td className="num col-table">{p.table}</td>
                  <td className="num col-pts">{fmtPts(p.white_pts)}</td>
                  <td className="player col-white">
                    {p.white_name}
                    <MobileMeta pts={p.white_pts} elo={p.white_elo} />
                  </td>
                  <td className="num col-elo muted">{p.white_elo}</td>
                  <td className="center col-result">
                    {p.is_bye ? (
                      <span className="badge">Exempt</span>
                    ) : editable ? (
                      <ResultPicker
                        table={p.table}
                        value={value}
                        onChange={(v) => onSetResult?.(p.table, v)}
                      />
                    ) : (
                      <span className="result">{resultLabel(p.white_score)}</span>
                    )}
                  </td>
                  <td className="num col-elo muted">{p.is_bye ? '' : p.black_elo}</td>
                  <td className="player col-black">
                    {!p.is_bye && (
                      <>
                        {p.black_name}
                        <MobileMeta pts={p.black_pts} elo={p.black_elo} />
                      </>
                    )}
                  </td>
                  <td className="num col-pts">{p.is_bye ? '' : fmtPts(p.black_pts)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="hint table-note">Pts = points avant la ronde.</p>

      <div className="actions">
        {editable && onSubmit && (
          <button disabled={!allEntered} onClick={submit}>
            {submitLabel}
            <span className="btn-count">
              {entered}/{games.length}
            </span>
          </button>
        )}
        {onPrint && (
          <button className="secondary" onClick={onPrint}>
            <Icon name="print" />
            Imprimer
          </button>
        )}
        {extraActions}
        {onCancelRound && (
          <button className="danger push-end" onClick={onCancelRound}>
            <Icon name="undo" />
            Annuler les appariements
          </button>
        )}
      </div>
    </div>
  )
}
