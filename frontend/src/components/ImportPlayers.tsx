// Import a player list from a CSV / XLSX / ODS file, in two steps:
// 1. match the file's columns to the player fields (pre-filled automatically),
// 2. check every player (fill missing Elo, rename or skip duplicates), then import.

import { useEffect, useMemo, useState } from 'react'
import type { PlayerInput } from '../types'
import {
  FIELD_KEYS,
  FIELD_LABELS,
  PROBLEM_LABELS,
  buildDraft,
  checkRows,
  columnLetter,
  detectMapping,
  eloProblem,
  hasNameField,
  summarize,
  toPlayers,
} from '../import/playerImport'
import type { Detection, DraftRow, FieldKey, Mapping, Sheet } from '../import/playerImport'
import { readSheets } from '../import/readSheet'
import { Banner, Modal, Spinner } from './Feedback'
import { Icon } from './Icon'

interface Props {
  file: File
  /** names already registered or waiting to be registered */
  existingNames: string[]
  busy?: boolean
  onCancel: () => void
  /** resolves to an error message, or null once the players are registered */
  onImport: (players: PlayerInput[], hasClub: boolean) => Promise<string | null>
}

const FIELD_HELP: Partial<Record<FieldKey, string>> = {
  username: 'prioritaire quand il est rempli',
  fullName: 'nom et prénom dans une seule colonne',
  lastName: 'combiné en « Nom, Prénom »',
  elo: 'nombre entier, 0 si non classé',
}

const PREVIEW_ROWS = 5

/** first non-empty value of a column, to recognise it in the lists */
function example(sheet: Sheet, col: number): string {
  const v = sheet.rows.find((r) => r[col])?.[col] ?? ''
  return v.length > 24 ? `${v.slice(0, 23)}…` : v
}

export function ImportPlayers({ file, existingNames, busy = false, onCancel, onImport }: Props) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [detection, setDetection] = useState<Detection | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [step, setStep] = useState<'map' | 'review'>('map')
  const [rows, setRows] = useState<DraftRow[]>([])
  const [onlyProblems, setOnlyProblems] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sheet = sheets?.[sheetIndex] ?? null

  // read the file once
  useEffect(() => {
    let cancelled = false
    readSheets(file)
      .then((s) => {
        if (cancelled) return
        if (s.length === 0) setError(`Le fichier « ${file.name} » ne contient aucune donnée.`)
        setSheets(s)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            `Impossible de lire « ${file.name} » : ${e instanceof Error ? e.message : String(e)}`,
          )
      })
    return () => {
      cancelled = true
    }
  }, [file])

  // automatic column matching, again for each sheet
  useEffect(() => {
    if (!sheet) return
    const d = detectMapping(sheet.header)
    setDetection(d)
    setMapping(d.mapping)
  }, [sheet])

  const preview = useMemo(
    () => (sheet && mapping ? buildDraft(sheet, mapping, existingNames) : []),
    [sheet, mapping, existingNames],
  )
  const problems = useMemo(() => checkRows(rows, existingNames), [rows, existingNames])
  const summary = summarize(rows, problems)
  const withClub = mapping?.club !== null && mapping?.club !== undefined
  const players = step === 'review' ? toPlayers(rows, problems, withClub) : null

  function setField(key: FieldKey, value: string) {
    if (!mapping) return
    setMapping({ ...mapping, [key]: value === '' ? null : Number(value) })
  }

  function goReview() {
    setRows(preview)
    setOnlyProblems(false)
    setStep('review')
  }

  function updateRow(id: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const eloToFill = rows.filter((r) => r.include && eloProblem(r.elo)).length

  function zeroMissingElo() {
    setRows((prev) => prev.map((r) => (r.include && eloProblem(r.elo) ? { ...r, elo: '0' } : r)))
  }

  async function submit() {
    if (!players) return
    setSaving(true)
    const hasClub = players.some((p) => !!p.club)
    const err = await onImport(players, hasClub)
    setSaving(false)
    if (err) setError(err)
  }

  // ------------------------------------------------------------- render
  if (!sheets || (sheet && !mapping)) {
    return (
      <Modal title="Importer une liste de joueurs" onClose={onCancel} size="lg">
        {error ? <Banner tone="error">{error}</Banner> : <Spinner label={`Lecture de ${file.name}…`} />}
      </Modal>
    )
  }
  if (!sheet || !mapping || !detection) {
    return (
      <Modal
        title="Importer une liste de joueurs"
        onClose={onCancel}
        size="lg"
        footer={
          <button className="secondary" onClick={onCancel}>
            Fermer
          </button>
        }
      >
        <Banner tone="error">{error ?? 'Aucune donnée à importer.'}</Banner>
      </Modal>
    )
  }

  if (step === 'map') {
    const nameOk = hasNameField(mapping)
    const ambiguous = detection.eloCandidates.length > 1 && mapping.elo === null
    const footer = (
      <>
        <button className="secondary" onClick={onCancel}>
          Annuler
        </button>
        <button disabled={!nameOk || preview.length === 0} onClick={goReview}>
          Suivant : vérifier {preview.length} joueur{preview.length > 1 ? 's' : ''}
          <Icon name="chevron-right" />
        </button>
      </>
    )
    return (
      <Modal title="Importer une liste de joueurs — colonnes" onClose={onCancel} footer={footer} size="lg">
        <p className="import-file">
          <Icon name="file" />
          <b>{file.name}</b>
          <span className="muted">
            {sheet.rows.length} ligne{sheet.rows.length > 1 ? 's' : ''} · {sheet.header.length} colonnes
          </span>
          {sheets.length > 1 && (
            <label className="inline-label push-end">
              Feuille
              <select
                className="input-sm"
                value={sheetIndex}
                onChange={(e) => setSheetIndex(Number(e.target.value))}
              >
                {sheets.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </p>

        <p className="hint">
          Les colonnes ont été reconnues automatiquement. Vérifiez-les et corrigez si besoin : le
          nom retenu est le nom d'utilisateur s'il est rempli, sinon « Nom, Prénom », sinon le
          nom complet.
        </p>

        {ambiguous && (
          <Banner tone="warning">
            Plusieurs colonnes peuvent contenir l'Elo :{' '}
            {detection.eloCandidates.map((c) => `« ${sheet.header[c]} »`).join(', ')}. Choisissez
            celle à utiliser.
          </Banner>
        )}
        {!nameOk && (
          <Banner tone="error">
            Aucune colonne de nom n'a été reconnue : choisissez au moins une colonne pour le nom.
          </Banner>
        )}

        <div className="import-map">
          {FIELD_KEYS.map((key) => {
            const flagged = key === 'elo' && ambiguous
            return (
              <label key={key} className={flagged ? 'field import-field flagged' : 'field import-field'}>
                <span className="field-label">{FIELD_LABELS[key]}</span>
                <select
                  className="input-sm"
                  value={mapping[key] ?? ''}
                  onChange={(e) => setField(key, e.target.value)}
                >
                  <option value="">— Aucune —</option>
                  {sheet.header.map((h, i) => {
                    const ex = example(sheet, i)
                    return (
                      <option key={i} value={i}>
                        {columnLetter(i)} · {h}
                        {ex ? ` (ex. ${ex})` : ''}
                      </option>
                    )
                  })}
                </select>
                {FIELD_HELP[key] && <span className="field-help">{FIELD_HELP[key]}</span>}
                {detection.multiple[key] && (
                  <span className="field-help">
                    Autres colonnes possibles :{' '}
                    {detection.multiple[key]!
                      .filter((c) => c !== mapping[key])
                      .map((c) => `« ${sheet.header[c]} »`)
                      .join(', ')}
                  </span>
                )}
              </label>
            )
          })}
        </div>

        {nameOk && (
          <div className="table-scroll">
            <table className="data import-preview">
              <caption>Aperçu ({Math.min(PREVIEW_ROWS, preview.length)} premières lignes)</caption>
              <thead>
                <tr>
                  <th className="num">Ligne</th>
                  <th className="left">Nom</th>
                  <th className="num">Elo</th>
                  {withClub && <th className="left">Club / équipe</th>}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, PREVIEW_ROWS).map((r) => (
                  <tr key={r.id}>
                    <td className="num muted">{r.line}</td>
                    <td className="left">{r.name || <span className="cell-missing">manquant</span>}</td>
                    <td className="num">
                      {eloProblem(r.elo) ? (
                        <span className="cell-missing">{r.elo || 'manquant'}</span>
                      ) : (
                        r.elo
                      )}
                    </td>
                    {withClub && <td className="left">{r.club}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    )
  }

  // ------------------------------------------------------------ review
  const visible = onlyProblems
    ? rows.filter((r) => (problems.get(r.id) ?? []).length > 0)
    : rows
  const count = players?.length ?? rows.filter((r) => r.include).length

  const footer = (
    <>
      <button className="secondary push-start" onClick={() => setStep('map')} disabled={saving}>
        <Icon name="undo" />
        Colonnes
      </button>
      {!players && summary.toFix > 0 && (
        <span className="hint import-foot-hint">
          Complétez ou décochez les {summary.toFix} ligne{summary.toFix > 1 ? 's' : ''} signalée
          {summary.toFix > 1 ? 's' : ''}.
        </span>
      )}
      <button className="secondary" onClick={onCancel} disabled={saving}>
        Annuler
      </button>
      <button disabled={!players || saving || busy} onClick={submit}>
        <Icon name="check" />
        {saving ? 'Import…' : `Importer ${count} joueur${count > 1 ? 's' : ''}`}
      </button>
    </>
  )

  return (
    <Modal title="Importer une liste de joueurs — vérification" onClose={onCancel} footer={footer} size="lg">
      <div className="import-summary" role="status">
        <span className="badge badge-ok">{summary.ready} prêt{summary.ready > 1 ? 's' : ''}</span>
        {summary.toFix > 0 && (
          <span className="badge badge-warn">
            {summary.toFix} à compléter
          </span>
        )}
        {summary.duplicates > 0 && (
          <span className="badge">
            {summary.duplicates} doublon{summary.duplicates > 1 ? 's' : ''}
          </span>
        )}
        {summary.skipped > 0 && (
          <span className="badge">
            {summary.skipped} non importé{summary.skipped > 1 ? 's' : ''}
          </span>
        )}
        <span className="push-end import-tools">
          {eloToFill > 0 && (
            <button className="secondary sm" onClick={zeroMissingElo}>
              Mettre 0 aux Elo manquants ou illisibles ({eloToFill})
            </button>
          )}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={onlyProblems}
              onChange={(e) => setOnlyProblems(e.target.checked)}
            />
            Lignes à vérifier seulement
          </label>
        </span>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <div className="table-scroll import-table-wrap">
        <table className="data import-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Tout cocher"
                  checked={rows.length > 0 && rows.every((r) => r.include)}
                  onChange={(e) => setRows((prev) => prev.map((r) => ({ ...r, include: e.target.checked })))}
                />
              </th>
              <th className="num">Ligne</th>
              <th className="left">Nom</th>
              <th className="left">Elo</th>
              {withClub && <th className="left">Club / équipe</th>}
              <th className="left">À vérifier</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={withClub ? 6 : 5} className="muted">
                  Aucune ligne à vérifier.
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const p = problems.get(r.id) ?? []
              const nameBad = p.includes('name-empty') || p.includes('name-reserved') || p.includes('duplicate')
              const eloBad = r.include && (p.includes('elo-missing') || p.includes('elo-invalid'))
              return (
                <tr key={r.id} className={!r.include ? 'is-skipped' : p.length ? 'has-problem' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Importer la ligne ${r.line}`}
                      checked={r.include}
                      onChange={(e) => updateRow(r.id, { include: e.target.checked })}
                    />
                  </td>
                  <td className="num muted">{r.line}</td>
                  <td className="left">
                    <input
                      type="text"
                      className={nameBad && r.include ? 'input-sm invalid' : 'input-sm'}
                      aria-label={`Nom, ligne ${r.line}`}
                      value={r.name}
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="left">
                    <input
                      type="text"
                      inputMode="numeric"
                      className={eloBad ? 'input-sm import-elo invalid' : 'input-sm import-elo'}
                      aria-label={`Elo, ligne ${r.line}`}
                      placeholder="?"
                      value={r.elo}
                      onChange={(e) => updateRow(r.id, { elo: e.target.value })}
                    />
                  </td>
                  {withClub && (
                    <td className="left">
                      <input
                        type="text"
                        className="input-sm"
                        aria-label={`Club, ligne ${r.line}`}
                        value={r.club}
                        onChange={(e) => updateRow(r.id, { club: e.target.value })}
                      />
                    </td>
                  )}
                  <td className="left import-problems">
                    {p.map((k) => (
                      <span
                        key={k}
                        className={k === 'duplicate' && !r.include ? 'badge' : 'badge badge-warn'}
                      >
                        {k === 'duplicate' && !r.include ? 'Doublon — non importé' : PROBLEM_LABELS[k]}
                      </span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
