import type { ForfeitCode, ResultInput, RoundInfo, Score } from '../types'
import { FORFEIT_CODES } from '../types'
import { fmtPts, resultLabel } from '../format'
import { Icon } from './Icon'

interface Props {
  round: RoundInfo
  /** results being typed (only for the round awaiting results) */
  results?: Record<number, Score>
  editable: boolean
  onSetResult?: (table: number, whiteScore: Score) => void
  /** when given, clicking the selected result again clears it */
  onClearResult?: (table: number) => void
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
const FORFEIT_HELP: Record<ForfeitCode, string> = {
  '1-F': 'Les Noirs ne se sont pas présentés : gain des Blancs',
  'F-1': 'Les Blancs ne se sont pas présentés : gain des Noirs',
  'F-F': 'Double forfait : aucun point',
}

function ResultPicker({
  table,
  value,
  onChange,
  onClear,
}: {
  table: number
  value: Score | undefined
  onChange: (v: Score) => void
  onClear?: () => void
}) {
  const forfeit = typeof value === 'string' ? value : ''
  return (
    <div className="result-picker">
      <div className="seg" role="radiogroup" aria-label={`Résultat table ${table}`}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={`Table ${table} : ${o.name}`}
          className="seg-btn"
          title={onClear && value === o.value ? 'Cliquer pour effacer ce résultat' : undefined}
          onClick={() => (onClear && value === o.value ? onClear() : onChange(o.value))}
        >
          {o.label}
        </button>
      ))}
      </div>
      <select
        className={forfeit ? 'forfeit-select chosen' : 'forfeit-select'}
        aria-label={`Table ${table} : forfait`}
        title="Partie non jouée : forfait"
        value={forfeit}
        onChange={(e) => {
          const v = e.target.value
          if (v) onChange(v as ForfeitCode)
          else onClear?.()
        }}
      >
        <option value="">{forfeit ? 'Annuler le forfait' : 'Forfait…'}</option>
        {FORFEIT_CODES.map((c) => (
          <option key={c} value={c} title={FORFEIT_HELP[c]}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}

type Outcome = 'win' | 'loss' | 'draw'

/** Outcome for White and Black of a result typed from White's side. */
function outcomes(value: Score | undefined): [Outcome, Outcome] | null {
  switch (value) {
    case 1:
    case '1-F':
      return ['win', 'loss']
    case 0:
    case 'F-1':
      return ['loss', 'win']
    case 0.5:
      return ['draw', 'draw']
    case 'F-F':
      return ['loss', 'loss']
    default:
      return null
  }
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
  onClearResult,
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
              // tint each player by outcome: the result being typed, or the
              // recorded one for a round already played
              const shown = editable ? value : (p.white_score ?? undefined)
              const [whiteOutcome, blackOutcome] =
                (!p.is_bye && outcomes(shown)) || [null, null]
              return (
                <tr
                  key={p.table}
                  className={
                    p.is_bye ? 'bye' : editable && value !== undefined ? 'entered' : undefined
                  }
                >
                  <td className="num col-table">{p.table}</td>
                  <td className="num col-pts">{fmtPts(p.white_pts)}</td>
                  <td className={whiteOutcome ? `player col-white res-${whiteOutcome}` : 'player col-white'}>
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
                        onClear={onClearResult ? () => onClearResult(p.table) : undefined}
                      />
                    ) : (
                      <span className="result">{resultLabel(p.white_score)}</span>
                    )}
                  </td>
                  <td className="num col-elo muted">{p.is_bye ? '' : p.black_elo}</td>
                  <td className={blackOutcome ? `player col-black res-${blackOutcome}` : 'player col-black'}>
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
      {round.absent.length > 0 && (
        <p className="absent-note">
          <b>Non appariés :</b>{' '}
          {round.absent.map((a, i) => (
            <span key={a.name}>
              {i > 0 && ', '}
              {a.name}{' '}
              <span className="muted">
                ({fmtPts(a.points)} pt
                {a.reason === 'withdrawn' ? ', retiré' : a.reason === 'late' ? ', pas encore arrivé' : ', absent'})
              </span>
            </span>
          ))}
        </p>
      )}
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
