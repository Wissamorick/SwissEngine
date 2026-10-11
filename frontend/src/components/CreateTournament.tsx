import { useState } from 'react'
import { ALL_SYSTEMS, SYSTEM_LABELS } from '../types'
import type { TournamentConfigInput } from '../types'

interface Props {
  disabled: boolean
  onCreate: (config: TournamentConfigInput) => void
  /** open the FAQ at a given section */
  onHelp?: (anchor: string) => void
}

export function CreateTournament({ disabled, onCreate, onHelp }: Props) {
  const [name, setName] = useState('')
  const [system, setSystem] = useState('dutch')
  const [rounds, setRounds] = useState(5)
  const [pointsText, setPointsText] = useState('')
  const [beta, setBeta] = useState(2)
  const [byeValue, setByeValue] = useState(0.5)
  const [seeding, setSeeding] = useState(true)
  const [showClub, setShowClub] = useState(false)
  // Round-robin: as many rounds as needed for everyone to meet everyone
  const [rrAllRounds, setRrAllRounds] = useState(true)

  const isRoundRobin = system === 'roundrobin'
  // Beta (colors) and seeding only matter for the Swiss-style systems
  const usesSwissOptions = system !== 'roundrobin' && system !== 'random'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // "3,2,1" -> [3, 2, 1] ; empty -> [] (engine defaults each round to 1)
    const points = pointsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
    onCreate({
      name: name.trim() || 'Tournoi',
      system,
      rounds: isRoundRobin && rrAllRounds ? 0 : rounds,
      points,
      beta,
      bye_value: byeValue,
      seeding,
      show_club: showClub,
    })
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Nouveau tournoi</h2>

      <label>
        Nom du tournoi
        <input
          type="text"
          value={name}
          placeholder="ex. Open d'automne 2026"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="tight">
        Système
        <select value={system} onChange={(e) => setSystem(e.target.value)}>
          {ALL_SYSTEMS.map((s) => (
            <option key={s} value={s}>
              {SYSTEM_LABELS[s] ?? s}
            </option>
          ))}
        </select>
      </label>
      {onHelp && (
        <p className="field-help">
          <button type="button" className="link small" onClick={() => onHelp('choisir')}>
            Quel système choisir ?
          </button>
        </p>
      )}

      {isRoundRobin ? (
        <>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={rrAllRounds}
              onChange={(e) => setRrAllRounds(e.target.checked)}
            />
            Toutes les rondes (chaque joueur rencontre tous les autres)
          </label>
          {!rrAllRounds && (
            <label>
              Nombre de rondes
              <input
                type="number"
                min={1}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
              />
            </label>
          )}
        </>
      ) : (
        <label>
          Nombre de rondes
          <input
            type="number"
            min={1}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          />
        </label>
      )}

      <label className="checkbox">
        <input type="checkbox" checked={showClub} onChange={(e) => setShowClub(e.target.checked)} />
        Afficher club / équipe
      </label>

      <details className="advanced">
        <summary>Paramètres avancés</summary>
        {onHelp && (
          <p className="hint advanced-help">
            <button type="button" className="link small" onClick={() => onHelp('options')}>
              À quoi servent ces options ?
            </button>
          </p>
        )}

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
          Valeur du bye (fraction d'une victoire)
          <input
            type="number"
            step={0.5}
            min={0}
            value={byeValue}
            onChange={(e) => setByeValue(Number(e.target.value))}
          />
        </label>

        {usesSwissOptions && (
          <>
            <label>
              Beta (contrainte couleurs)
              <input
                type="number"
                min={1}
                value={beta}
                onChange={(e) => setBeta(Number(e.target.value))}
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
          </>
        )}
      </details>

      <button type="submit" disabled={disabled}>
        Créer
      </button>
    </form>
  )
}
