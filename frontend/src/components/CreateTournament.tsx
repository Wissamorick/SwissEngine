import { useState } from 'react'
import { ALL_SYSTEMS } from '../types'
import type { TournamentConfigInput } from '../types'

interface Props {
  disabled: boolean
  onCreate: (config: TournamentConfigInput) => void
}

export function CreateTournament({ disabled, onCreate }: Props) {
  const [system, setSystem] = useState('dutch')
  const [rounds, setRounds] = useState(5)
  const [pointsText, setPointsText] = useState('')
  const [beta, setBeta] = useState(2)
  const [byeValue, setByeValue] = useState(0.5)
  const [seeding, setSeeding] = useState(true)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // "3,2,1" -> [3, 2, 1] ; empty -> [] (engine defaults each round to 1)
    const points = pointsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
    onCreate({ system, rounds, points, beta, bye_value: byeValue, seeding })
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>1. Créer un tournoi</h2>

      <label>
        Système
        <select value={system} onChange={(e) => setSystem(e.target.value)}>
          {ALL_SYSTEMS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label>
        Nombre de rondes
        <input
          type="number"
          min={1}
          value={rounds}
          onChange={(e) => setRounds(Number(e.target.value))}
        />
      </label>

      <label>
        Points par ronde (ex. 3,2,1 — vide = 1 partout)
        <input
          type="text"
          value={pointsText}
          placeholder="1,1,1,1,1"
          onChange={(e) => setPointsText(e.target.value)}
        />
      </label>

      <label>
        Beta (contrainte couleurs)
        <input
          type="number"
          min={1}
          value={beta}
          onChange={(e) => setBeta(Number(e.target.value))}
        />
      </label>

      <label>
        Valeur du bye
        <input
          type="number"
          step={0.5}
          min={0}
          value={byeValue}
          onChange={(e) => setByeValue(Number(e.target.value))}
        />
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={seeding}
          onChange={(e) => setSeeding(e.target.checked)}
        />
        Seeding par Elo (sinon Buchholz)
      </label>

      <button type="submit" disabled={disabled}>
        Créer
      </button>
    </form>
  )
}
