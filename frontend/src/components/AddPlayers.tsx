import { useState } from 'react'
import type { PlayerInput } from '../types'
import { Icon } from './Icon'
import { EmptyState } from './Feedback'

interface Props {
  /** players already registered on the server */
  registered: PlayerInput[]
  /** players typed but not sent yet */
  pending: PlayerInput[]
  /** the tournament has started: no more players can be added */
  locked: boolean
  showClub: boolean
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
}

function ClubInput({ value, onSave }: { value: string; onSave: (club: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <input
      type="text"
      className="club-input input-sm"
      placeholder="Club / équipe"
      aria-label="Club / équipe"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== value && onSave(text.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
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

function EditPlayerRow({
  player,
  index,
  all,
  started,
  busy,
  onSave,
  onCancel,
}: {
  player: PlayerInput
  index: number
  all: PlayerInput[]
  started: boolean
  busy: boolean
  onSave: (newName: string, elo: number) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(player.name)
  const [elo, setElo] = useState(String(player.elo))
  const eloValue = Number(elo)
  const eloOk = elo.trim() !== '' && Number.isInteger(eloValue) && eloValue >= 0
  const error = nameError(name, player.name, all) ?? (eloOk ? null : "L'Elo doit être un entier positif ou nul.")
  const changed = name.trim() !== player.name || (eloOk && eloValue !== player.elo)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (error || !changed) return
    onSave(name.trim(), eloValue)
  }

  return (
    <li className="editing">
      <form
        className="pl-edit"
        onSubmit={submit}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <span className="pl-num">{index + 1}</span>
        <input
          type="text"
          className="input-sm pl-edit-name"
          aria-label="Nom du joueur"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          min={0}
          step={1}
          className="input-sm pl-edit-elo"
          aria-label="Elo"
          value={elo}
          onChange={(e) => setElo(e.target.value)}
        />
        <button
          type="submit"
          className="icon-button"
          disabled={busy || !!error || !changed}
          aria-label="Valider la modification"
          title="Valider (Entrée)"
        >
          <Icon name="check" size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={onCancel}
          aria-label="Annuler la modification"
          title="Annuler (Échap)"
        >
          <Icon name="close" size={14} />
        </button>
        {error ? (
          <span className="pl-edit-msg error" role="alert">{error}</span>
        ) : (
          started &&
          eloOk &&
          eloValue !== player.elo && (
            <span className="pl-edit-msg">
              Les appariements déjà faits ne changent pas ; le nouvel Elo comptera pour les
              rondes suivantes.
            </span>
          )
        )}
      </form>
    </li>
  )
}

export function AddPlayers({
  registered,
  pending,
  locked,
  showClub,
  busy = false,
  onToggleClub,
  onSetClub,
  onEditPlayer,
  onAdd,
  onRemove,
  onSubmit,
}: Props) {
  const [name, setName] = useState('')
  const [elo, setElo] = useState(1500)
  const [club, setClub] = useState('')
  /** name of the registered player being edited (null = none) */
  const [editing, setEditing] = useState<string | null>(null)

  async function saveEdit(current: string, newName: string, newElo: number) {
    if (await onEditPlayer(current, newName, newElo)) setEditing(null)
  }

  function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
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

  const registeredList =
    total === 0 ? (
      <EmptyState title="Aucun joueur inscrit">
        Saisissez le nom et l'Elo de chaque participant (0 si non classé), puis enregistrez la
        liste.
      </EmptyState>
    ) : (
      <ol className={showClub ? 'player-list with-club' : 'player-list'}>
        {registered.map((p, i) =>
          editing === p.name ? (
            <EditPlayerRow
              key={`e-${p.name}`}
              player={p}
              index={i}
              all={[...registered, ...pending]}
              started={locked}
              busy={busy}
              onSave={(n, e) => saveEdit(p.name, n, e)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <li key={`r-${p.name}`}>
              <span className="pl-num">{i + 1}</span>
              <span className="pl-name">{p.name}</span>
              <span className="pl-elo">{p.elo}</span>
              {showClub && (
                <ClubInput
                  key={p.club ?? ''}
                  value={p.club ?? ''}
                  onSave={(c) => onSetClub(p.name, c)}
                />
              )}
              <button
                className="icon-button"
                onClick={() => setEditing(p.name)}
                disabled={busy}
                aria-label={`Modifier le nom ou l'Elo de ${p.name}`}
                title="Modifier le nom ou l'Elo"
              >
                <Icon name="edit" size={14} />
              </button>
            </li>
          ),
        )}
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
        {clubToggle}
      </header>

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
        <button type="submit" className="secondary" disabled={!name.trim()}>
          <Icon name="plus" />
          Ajouter
        </button>
      </form>

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
