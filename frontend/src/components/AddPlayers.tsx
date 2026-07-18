import { useState } from 'react'
import type { PlayerInput } from '../types'

interface Props {
  players: PlayerInput[]
  disabled: boolean
  onAdd: (player: PlayerInput) => void
  onRemove: (index: number) => void
  onSubmit: () => void
}

export function AddPlayers({ players, disabled, onAdd, onRemove, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [elo, setElo] = useState(1500)

  function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, elo })
    setName('')
  }

  return (
    <div className="card">
      <h2>2. Ajouter des joueurs</h2>

      <form className="inline" onSubmit={add}>
        <input
          type="text"
          placeholder="Nom"
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          placeholder="Elo"
          value={elo}
          disabled={disabled}
          onChange={(e) => setElo(Number(e.target.value))}
        />
        <button type="submit" disabled={disabled}>
          Ajouter
        </button>
      </form>

      <ol className="player-list">
        {players.map((p, i) => (
          <li key={`${p.name}-${i}`}>
            <span>
              {p.name} ({p.elo})
            </span>
            {!disabled && (
              <button className="link" onClick={() => onRemove(i)}>
                retirer
              </button>
            )}
          </li>
        ))}
      </ol>

      <button disabled={disabled || players.length < 2} onClick={onSubmit}>
        Enregistrer {players.length} joueur(s)
      </button>
    </div>
  )
}
