import { useEffect, useState } from 'react'
import type { ResultInput, RoundInfo } from '../types'
import { Pairings } from './Pairings'

/** Ask the history to open a round in edit mode (nonce: re-trigger on same round) */
export interface EditRequest {
  round: number
  nonce: number
}

interface Props {
  rounds: RoundInfo[]
  editRequest: EditRequest | null
  busy: boolean
  onPrintPairings: (round: number) => void
  onPrintCrosstable: (round: number) => void
  onRollback: (roundsToKeep: number) => void
  onCorrect: (round: number, results: ResultInput[], keepLaterRounds: boolean) => Promise<boolean>
}

function initialResults(round: RoundInfo): Record<number, number> {
  const out: Record<number, number> = {}
  for (const p of round.pairings) {
    if (!p.is_bye && p.white_score !== null) out[p.table] = p.white_score
  }
  return out
}

// Every round played so far: results, printable documents, corrections.
export function RoundHistory({
  rounds,
  editRequest,
  busy,
  onPrintPairings,
  onPrintCrosstable,
  onRollback,
  onCorrect,
}: Props) {
  const completed = rounds.filter((r) => r.completed)
  const [selected, setSelected] = useState(completed.length)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<number, number>>({})
  const [keepLater, setKeepLater] = useState(true)

  useEffect(() => {
    setSelected(completed.length)
    setEditing(false)
  }, [completed.length])

  const round = completed.find((r) => r.round === selected) ?? completed[completed.length - 1]
  const later = round ? rounds.filter((r) => r.round > round.round) : []
  const laterCompleted = later.filter((r) => r.completed).length

  function startEdit(r: RoundInfo) {
    const laterRounds = rounds.filter((x) => x.round > r.round)
    setSelected(r.round)
    setDraft(initialResults(r))
    // Only an unplayed round after it: re-pairing is the natural choice.
    setKeepLater(laterRounds.some((x) => x.completed))
    setEditing(true)
  }

  useEffect(() => {
    if (!editRequest) return
    const r = rounds.find((x) => x.round === editRequest.round && x.completed)
    if (r) startEdit(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest])

  if (!round) {
    return <p className="muted">Aucune ronde terminée pour l'instant.</p>
  }

  const isLast = round.round === completed.length && rounds.length === completed.length

  async function save(results: ResultInput[]) {
    const ok = await onCorrect(round.round, results, later.length > 0 ? keepLater : true)
    if (ok) setEditing(false)
  }

  return (
    <div>
      <div className="round-tabs">
        {completed.map((r) => (
          <button
            key={r.round}
            className={r.round === round.round ? 'tab active' : 'tab'}
            onClick={() => {
              setSelected(r.round)
              setEditing(false)
            }}
          >
            Ronde {r.round}
          </button>
        ))}
      </div>

      {editing ? (
        <div className="edit-box">
          <p className="edit-title">
            Correction des résultats de la ronde {round.round}
          </p>
          {later.length > 0 && (
            <fieldset className="choice">
              <legend>
                {later.length === 1 && !later[0].completed
                  ? `Les appariements de la ronde ${later[0].round} ont déjà été générés :`
                  : `Les rondes ${later[0].round} à ${later[later.length - 1].round} existent déjà :`}
              </legend>
              <label className="checkbox">
                <input
                  type="radio"
                  name="later"
                  checked={keepLater}
                  onChange={() => setKeepLater(true)}
                />
                Les conserver telles quelles (seuls les scores et le classement changent)
              </label>
              <label className="checkbox">
                <input
                  type="radio"
                  name="later"
                  checked={!keepLater}
                  onChange={() => setKeepLater(false)}
                />
                Les annuler pour refaire les appariements avec les scores corrigés
                {laterCompleted > 0 && (
                  <span className="danger-text">
                    {' '}
                    ({laterCompleted} ronde(s) déjà jouée(s) seront perdues)
                  </span>
                )}
              </label>
            </fieldset>
          )}
          <Pairings
            round={round}
            results={draft}
            editable
            onSetResult={(table, score) => setDraft((prev) => ({ ...prev, [table]: score }))}
            onSubmit={save}
            submitLabel={busy ? 'Enregistrement…' : 'Enregistrer les corrections'}
            extraActions={
              <button className="secondary" onClick={() => setEditing(false)}>
                Annuler
              </button>
            }
          />
        </div>
      ) : (
        <>
          <Pairings round={round} editable={false} />
          <div className="actions">
            <button onClick={() => startEdit(round)}>Modifier les résultats</button>
            <button className="secondary" onClick={() => onPrintPairings(round.round)}>
              Imprimer les résultats
            </button>
            <button className="secondary" onClick={() => onPrintCrosstable(round.round)}>
              Imprimer la grille après la ronde {round.round}
            </button>
            {!isLast && (
              <button className="secondary danger" onClick={() => onRollback(round.round)}>
                Revenir à la fin de cette ronde
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
