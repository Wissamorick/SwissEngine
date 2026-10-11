import { useState } from 'react'
import type { PlayerInput } from '../types'

interface Props {
  /** players already registered on the server */
  registered: PlayerInput[]
  /** players typed but not sent yet */
  pending: PlayerInput[]
  /** the tournament has started: no more players can be added */
  locked: boolean
  showClub: boolean
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
      className="club-input"
      placeholder="Club / équipe"
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
    <label className="checkbox club-toggle">
      <input type="checkbox" checked={showClub} onChange={(e) => onToggleClub(e.target.checked)} />
      Afficher club / équipe
    </label>
  )

  const registeredList = (
    <ol className={showClub ? 'player-list with-club' : 'player-list'}>
      {registered.map((p) => (
        <li key={`r-${p.name}`}>
          <span className="player-main">
            <b>{p.name}</b> <span className="muted">({p.elo})</span>
          </span>
          {showClub && (
            <ClubInput
              key={p.club ?? ''}
              value={p.club ?? ''}
              onSave={(c) => onSetClub(p.name, c)}
            />
          )}
          {!locked && <span className="badge">inscrit</span>}
        </li>
      ))}
      {pending.map((p, i) => (
        <li key={`p-${p.name}-${i}`} className="pending">
          <span className="player-main">
            {p.name} <span className="muted">({p.elo})</span>
            {showClub && p.club && <span className="muted"> · {p.club}</span>}
          </span>
          <button className="link" onClick={() => onRemove(i)}>
            retirer
          </button>
        </li>
      ))}
    </ol>
  )

  if (locked) {
    return (
      <details className="card">
        <summary>
          <h2 className="inline-title">Joueurs ({registered.length})</h2>
        </summary>
        <div className="players-head">{clubToggle}</div>
        {registeredList}
      </details>
    )
  }

  return (
    <div className="card">
      <div className="players-head">
        <h2>Joueurs</h2>
        {clubToggle}
      </div>

      <form className="inline" onSubmit={add}>
        <input
          type="text"
          placeholder="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {showClub && (
          <input
            type="text"
            placeholder="Club / équipe (facultatif)"
            value={club}
            onChange={(e) => setClub(e.target.value)}
          />
        )}
        <input
          type="number"
          placeholder="Elo"
          className="elo-input"
          value={elo}
          onChange={(e) => setElo(Number(e.target.value))}
        />
        <button type="submit">Ajouter</button>
      </form>

      {registeredList}

      <button disabled={pending.length === 0} onClick={onSubmit}>
        Enregistrer {pending.length} joueur(s)
      </button>
    </div>
  )
}
