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

export function AddPlayers({
  registered,
  pending,
  locked,
  showClub,
  busy = false,
  onToggleClub,
  onSetClub,
  onAdd,
  onRemove,
  onSubmit,
}: Props) {
  const [name, setName] = useState('')
  const [elo, setElo] = useState(1500)
  const [club, setClub] = useState('')

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
        {registered.map((p, i) => (
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
          </li>
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
