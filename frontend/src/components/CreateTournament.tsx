import { useState } from 'react'
import { ALL_SYSTEMS, SYSTEM_LABELS } from '../types'
import type { TournamentConfigInput } from '../types'
import { Icon } from './Icon'

interface Props {
  disabled: boolean
  onCreate: (config: TournamentConfigInput) => void
  /** open the FAQ at a given section */
  onHelp?: (anchor: string) => void
}

// Points given to the player without opponent, as a fraction of a win.
const BYE_OPTIONS = [
  { value: 0, label: '0', help: 'Aucun point.' },
  { value: 0.5, label: '½', help: 'Une nulle : conseillé, l’exempt est souvent en bas du classement.' },
  { value: 1, label: '1', help: 'Une victoire : la valeur la plus répandue (règle par défaut de la FIDE).' },
]

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
    <form className="card card-form" onSubmit={submit}>
      <header className="card-head">
        <h2>Nouveau tournoi</h2>
      </header>

      <label className="field">
        <span className="field-label">Nom du tournoi</span>
        <input
          type="text"
          value={name}
          placeholder="ex. Open d'automne 2026"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="field-row">
        <label className="field grow">
          <span className="field-label">
            Système
            {onHelp && (
              <button type="button" className="link field-aside" onClick={() => onHelp('choisir')}>
                Quel système choisir ?
              </button>
            )}
          </span>
          <select value={system} onChange={(e) => setSystem(e.target.value)}>
            {ALL_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {SYSTEM_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </label>

        {(!isRoundRobin || !rrAllRounds) && (
          <label className="field field-rounds">
            <span className="field-label">Rondes</span>
            <input
              type="number"
              min={1}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
            />
          </label>
        )}
      </div>

      {isRoundRobin && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={rrAllRounds}
            onChange={(e) => setRrAllRounds(e.target.checked)}
          />
          Toutes les rondes (chaque joueur rencontre tous les autres)
        </label>
      )}

      <label className="checkbox">
        <input type="checkbox" checked={showClub} onChange={(e) => setShowClub(e.target.checked)} />
        Afficher club / équipe
      </label>

      <details className="advanced">
        <summary>
          <Icon name="chevron-right" className="summary-chevron" />
          Paramètres avancés
        </summary>
        <div className="advanced-body">
          {onHelp && (
            <p className="hint">
              <button type="button" className="link" onClick={() => onHelp('options')}>
                À quoi servent ces options ?
              </button>
            </p>
          )}

          <label className="field">
            <span className="field-label">Points par ronde</span>
            <input
              type="text"
              value={pointsText}
              placeholder="1,1,1,1,1"
              onChange={(e) => setPointsText(e.target.value)}
            />
            <span className="field-help">ex. 3,2,1 — vide = 1 point par victoire à chaque ronde</span>
          </label>

          <div className="field-row">
            <div className="field grow">
              <span className="field-label" id="bye-label">
                Valeur du bye
              </span>
              <div className="seg seg-field" role="radiogroup" aria-labelledby="bye-label">
                {BYE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={byeValue === o.value}
                    className="seg-btn"
                    title={o.help}
                    onClick={() => setByeValue(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <span className="field-help">
                {BYE_OPTIONS.find((o) => o.value === byeValue)?.help ?? "fraction d'une victoire"}
              </span>
            </div>

            {usesSwissOptions && (
              <label className="field grow">
                <span className="field-label">Beta</span>
                <input
                  type="number"
                  min={1}
                  value={beta}
                  onChange={(e) => setBeta(Number(e.target.value))}
                />
                <span className="field-help">contrainte sur les couleurs</span>
              </label>
            )}
          </div>

          {usesSwissOptions && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={seeding}
                onChange={(e) => setSeeding(e.target.checked)}
              />
              Seeding par Elo (sinon Buchholz)
            </label>
          )}
        </div>
      </details>

      <div className="form-foot">
        <button type="submit" disabled={disabled}>
          Créer le tournoi
        </button>
      </div>
    </form>
  )
}
