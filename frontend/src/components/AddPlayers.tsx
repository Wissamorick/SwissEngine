import { useEffect, useRef, useState } from 'react'
import type { PlayerInput } from '../types'
import { Icon } from './Icon'
import { EmptyState } from './Feedback'
import { ImportPlayers } from './ImportPlayers'
import { ACCEPTED_FILES } from '../import/readSheet'

interface Props {
  /** players already registered on the server */
  registered: PlayerInput[]
  /** players typed but not sent yet */
  pending: PlayerInput[]
  /** the tournament has started: no more players can be added */
  locked: boolean
  showClub: boolean
  /** maximum number of players (round-robin), null = no limit */
  maxPlayers?: number | null
  busy?: boolean
  onToggleClub: (show: boolean) => void
  /** club of a registered player (can be changed at any time) */
  onSetClub: (name: string, club: string) => void
  /** rename a registered player and/or change their Elo (allowed at any time).
   *  Resolves to true when the change was accepted by the server. */
  onEditPlayer: (name: string, newName: string, elo: number) => Promise<boolean>
  onAdd: (player: PlayerInput) => void
  onRemove: (index: number) => void
  onSubmit: () => void
  /** register players read from a file; resolves to an error message or null */
  onImport: (players: PlayerInput[], hasClub: boolean) => Promise<string | null>
  /** unregister a player (before the start only) */
  onRemovePlayer: (name: string) => void
}

/** Same rule as the server: a name may not be empty, "bye", or another
 *  player's name (case-insensitive). Returns an error message or null. */
function nameError(newName: string, current: string, all: PlayerInput[]): string | null {
  const t = newName.trim()
  if (!t) return 'Le nom ne peut pas être vide.'
  if (t.toLowerCase() === 'bye') return 'Le nom « bye » est réservé.'
  if (t !== current && all.some((p) => p.name !== current && p.name.trim().toLowerCase() === t.toLowerCase()))
    return `Le nom « ${t} » est déjà pris par un autre joueur.`
  return null
}

/**
 * Text that turns into a field on hover / click and saves itself when the
 * field is left (Tab, click elsewhere, Enter). Escape restores the old value.
 * An invalid value is not sent: the old value comes back and the message is
 * reported through onError.
 */
function InlineField({
  value,
  label,
  className,
  placeholder,
  numeric = false,
  validate,
  onSave,
  onError,
}: {
  value: string
  label: string
  className: string
  placeholder?: string
  numeric?: boolean
  validate?: (text: string) => string | null
  /** resolves to false when the server refused the change */
  onSave: (text: string) => Promise<boolean> | void
  onError?: (message: string | null) => void
}) {
  const [text, setText] = useState(value)
  const cancelled = useRef(false)

  // follow changes coming from the server (other field saved, reload…)
  useEffect(() => setText(value), [value])

  async function commit() {
    if (cancelled.current) {
      cancelled.current = false
      setText(value)
      return
    }
    const t = text.trim()
    if (t === value) {
      setText(value)
      return
    }
    const error = validate?.(t) ?? null
    onError?.(error)
    if (error) {
      setText(value)
      return
    }
    const ok = await onSave(t)
    if (ok === false) setText(value)
  }

  return (
    <input
      type="text"
      inputMode={numeric ? 'numeric' : undefined}
      className={`inline-input ${className}`}
      aria-label={label}
      title={`${label} — cliquez pour modifier`}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => onError?.(null)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function RegisteredRow({
  player,
  index,
  all,
  showClub,
  started,
  busy,
  onEdit,
  onSetClub,
  onRemove,
}: {
  player: PlayerInput
  index: number
  all: PlayerInput[]
  showClub: boolean
  started: boolean
  busy: boolean
  onEdit: (name: string, newName: string, elo: number) => Promise<boolean>
  onSetClub: (name: string, club: string) => void
  onRemove: (name: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  return (
    <li className={error ? 'has-error' : undefined}>
      <span className="pl-num">{index + 1}</span>
      <InlineField
        className="pl-name-input"
        label={`Nom de ${player.name}`}
        value={player.name}
        validate={(t) => nameError(t, player.name, all)}
        onSave={(t) => onEdit(player.name, t, player.elo)}
        onError={setError}
      />
      <InlineField
        className="pl-elo-input"
        label={`Elo de ${player.name}`}
        numeric
        value={String(player.elo)}
        validate={(t) => (/^\d+$/.test(t) ? null : "L'Elo doit être un entier positif ou nul (0 si non classé).")}
        onSave={(t) => onEdit(player.name, player.name, Number(t))}
        onError={setError}
      />
      {showClub && (
        <InlineField
          className="pl-club-input"
          label={`Club / équipe de ${player.name}`}
          placeholder="Club / équipe"
          value={player.club ?? ''}
          onSave={(t) => onSetClub(player.name, t)}
        />
      )}
      {!started && (
        <button
          type="button"
          className="icon-button pl-remove"
          onClick={() => onRemove(player.name)}
          disabled={busy}
          aria-label={`Retirer ${player.name}`}
          title="Retirer ce joueur"
        >
          <Icon name="close" size={14} />
        </button>
      )}
      {error && (
        <span className="pl-error" role="alert">
          {error}
        </span>
      )}
    </li>
  )
}

export function AddPlayers({
  registered,
  pending,
  locked,
  showClub,
  maxPlayers = null,
  busy = false,
  onToggleClub,
  onSetClub,
  onEditPlayer,
  onAdd,
  onRemove,
  onSubmit,
  onImport,
  onRemovePlayer,
}: Props) {
  const [name, setName] = useState('')
  const [elo, setElo] = useState(1500)
  const [club, setClub] = useState('')
  /** player list file being imported */
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function runImport(players: PlayerInput[], hasClub: boolean): Promise<string | null> {
    const error = await onImport(players, hasClub)
    if (!error) setImportFile(null)
    return error
  }

  function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || full) return
    onAdd({ name: trimmed, elo, club: showClub && club.trim() ? club.trim() : null })
    setName('')
  }

  const clubToggle = (
    <label className="checkbox switch-label">
      <input type="checkbox" checked={showClub} onChange={(e) => onToggleClub(e.target.checked)} />
      Afficher club / équipe
    </label>
  )

  const total = registered.length + pending.length
  const full = maxPlayers !== null && total >= maxPlayers

  const registeredList =
    total === 0 ? (
      <EmptyState title="Aucun joueur inscrit">
        Saisissez le nom et l'Elo de chaque participant (0 si non classé), puis enregistrez la
        liste.
      </EmptyState>
    ) : (
      <ol className={showClub ? 'player-list with-club' : 'player-list'}>
        {registered.map((p, i) => (
          // keyed by position: renaming a player must not remount the row
          // (the focus would jump out of the next field)
          <RegisteredRow
            key={i}
            player={p}
            index={i}
            all={[...registered, ...pending]}
            showClub={showClub}
            started={locked}
            busy={busy}
            onEdit={onEditPlayer}
            onSetClub={onSetClub}
            onRemove={onRemovePlayer}
          />
        ))}
        {pending.map((p, i) => (
          <li key={`p-${p.name}-${i}`} className="pending">
            <span className="pl-num">{registered.length + i + 1}</span>
            <span className="pl-name">
              {p.name}
              <span className="badge badge-warn">à enregistrer</span>
            </span>
            <span className="pl-elo">{p.elo}</span>
            {showClub && <span className="pl-club">{p.club ?? ''}</span>}
            <button
              className="icon-button"
              onClick={() => onRemove(i)}
              aria-label={`Retirer ${p.name}`}
              title="Retirer"
            >
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ol>
    )

  if (locked) {
    return (
      <details className="card card-players">
        <summary className="card-head">
          <h2>
            <Icon name="chevron-right" className="summary-chevron" />
            Joueurs
            <span className="count">{registered.length}</span>
          </h2>
          <span className="card-aside">Inscriptions closes</span>
        </summary>
        <div className="card-body">
          {clubToggle}
          {registeredList}
        </div>
      </details>
    )
  }

  return (
    <section className="card card-players">
      <header className="card-head">
        <h2>
          Joueurs
          <span className="count">{total}</span>
        </h2>
        <div className="card-head-tools">
          <button
            type="button"
            className="secondary sm"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            title="Fichier CSV, Excel (XLSX) ou LibreOffice (ODS), par exemple l'export d'un Google Forms"
          >
            <Icon name="file" />
            Importer une liste
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_FILES}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setImportFile(f)
              e.target.value = ''
            }}
          />
          {clubToggle}
        </div>
      </header>

      {importFile && (
        <ImportPlayers
          file={importFile}
          existingNames={[...registered, ...pending].map((p) => p.name)}
          busy={busy}
          onCancel={() => setImportFile(null)}
          onImport={runImport}
        />
      )}

      <form className="player-form" onSubmit={add}>
        <label className="field grow">
          <span className="field-label">Nom</span>
          <input
            type="text"
            placeholder="Prénom Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {showClub && (
          <label className="field grow">
            <span className="field-label">Club / équipe</span>
            <input
              type="text"
              placeholder="facultatif"
              value={club}
              onChange={(e) => setClub(e.target.value)}
            />
          </label>
        )}
        <label className="field field-elo">
          <span className="field-label">Elo</span>
          <input type="number" value={elo} onChange={(e) => setElo(Number(e.target.value))} />
        </label>
        <button
          type="submit"
          className="secondary"
          disabled={!name.trim() || full}
          title={full ? `Un round-robin est limité à ${maxPlayers} joueurs` : undefined}
        >
          <Icon name="plus" />
          Ajouter
        </button>
      </form>
      {maxPlayers !== null && (
        <p className={full ? 'hint limit-hint full' : 'hint limit-hint'}>
          {full
            ? `Limite atteinte : un round-robin compte ${maxPlayers} joueurs au plus. Au-delà, choisissez un système suisse.`
            : `Round-robin : ${maxPlayers} joueurs au plus (${total} inscrit${total > 1 ? 's' : ''}).`}
        </p>
      )}

      {registeredList}

      {pending.length > 0 && (
        <div className="form-foot">
          <button disabled={busy} onClick={onSubmit}>
            Enregistrer {pending.length} joueur{pending.length > 1 ? 's' : ''}
          </button>
          <span className="hint">
            Les joueurs ne sont pris en compte qu'une fois enregistrés.
          </span>
        </div>
      )}
    </section>
  )
}
