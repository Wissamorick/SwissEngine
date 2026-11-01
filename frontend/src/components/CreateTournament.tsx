import { useState } from 'react'
import { ALL_SYSTEMS, SYSTEM_LABELS } from '../types'
import type { TournamentConfigInput } from '../types'
import { Icon } from './Icon'

interface Props {
  disabled: boolean
  onCreate: (config: TournamentConfigInput) => void
  /** edit mode: current settings of a tournament that has not started yet */
  initial?: TournamentConfigInput
  /** edit mode: close without saving */
  onCancel?: () => void
  /** open the FAQ at a given section */
  onHelp?: (anchor: string) => void
}

// Points given to the player without opponent, as a fraction of a win.
const BYE_OPTIONS = [
  { value: 0, label: '0', help: 'Aucun point.' },
  { value: 0.5, label: '½', help: 'Une nulle : conseillé, l’exempt est souvent en bas du classement.' },
  { value: 1, label: '1', help: 'Une victoire : la valeur la plus répandue (règle par défaut de la FIDE).' },
]

// Round 1: color of the higher-ranked player on table 1; colors then alternate.
const FIRST_BOARD_OPTIONS: { value: TournamentConfigInput['first_board_color']; label: string }[] = [
  { value: 'white', label: 'Blancs' },
  { value: 'random', label: 'Aléatoire' },
  { value: 'black', label: 'Noirs' },
]

export function CreateTournament({ disabled, onCreate, onHelp, initial, onCancel }: Props) {
  const editing = initial !== undefined
  const [name, setName] = useState(initial?.name ?? '')
  const [system, setSystem] = useState(initial?.system ?? 'dutch')
  // round-robin "all rounds" is stored as 0: keep a sensible number for the field
  const [rounds, setRounds] = useState(initial && initial.rounds > 0 ? initial.rounds : 5)
  const [pointsText, setPointsText] = useState(initial?.points.join(',') ?? '')
  const [beta, setBeta] = useState(initial?.beta ?? 2)
  const [byeValue, setByeValue] = useState(initial?.bye_value ?? 0.5)
  const [seeding, setSeeding] = useState(initial?.seeding ?? true)
  const [firstBoard, setFirstBoard] = useState<TournamentConfigInput['first_board_color']>(
    initial?.first_board_color ?? 'random',
  )
  const [showClub, setShowClub] = useState(initial?.show_club ?? false)
  // Round-robin: as many rounds as needed for everyone to meet everyone
  // Round-robin: every game twice ("aller-retour"), colors reversed
  const [doubleRR, setDoubleRR] = useState(initial?.double_round_robin ?? false)

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
      // round-robin: always the complete schedule (0 = automatic, ×2 for aller-retour)
      rounds: isRoundRobin ? 0 : rounds,
      points: isRoundRobin ? [] : points,
      beta,
      bye_value: isRoundRobin ? 0 : byeValue,
      seeding,
      first_board_color: firstBoard,
      double_round_robin: isRoundRobin && doubleRR,
      show_club: showClub,
    })
  }

  return (
    <form className={editing ? 'settings-form' : 'card card-form'} onSubmit={submit}>
      {!editing && (
        <header className="card-head">
          <h2>Nouveau tournoi</h2>
        </header>
      )}

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

        {!isRoundRobin && (
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
        <>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={doubleRR}
              onChange={(e) => setDoubleRR(e.target.checked)}
            />
            Aller-retour
          </label>
          <p className="field-help rr-help">
            {doubleRR
              ? 'Chaque rencontre est jouée deux fois, couleurs inversées : toutes les rondes aller, puis toutes les rondes retour.'
              : 'Chaque joueur rencontre tous les autres une fois.'}{' '}
            Tout le calendrier est créé d'un coup ; les résultats se saisissent dans n'importe quel
            ordre. 24 joueurs au plus ; avec un nombre impair, le joueur exempt marque 0 point.
          </p>
        </>
      )}

      <label className="checkbox">
        <input type="checkbox" checked={showClub} onChange={(e) => setShowClub(e.target.checked)} />
        Afficher club / équipe
      </label>

      <details className="advanced" open={editing || undefined}>
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

          {!isRoundRobin && (
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
          )}

          {(!isRoundRobin || usesSwissOptions) && (
            <div className="field-row">
              {!isRoundRobin && (
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
              )}

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
          )}

          <div className="field">
            <span className="field-label" id="first-board-label">
              Couleur à la table 1 (ronde 1)
            </span>
            <div className="seg seg-field" role="radiogroup" aria-labelledby="first-board-label">
              {FIRST_BOARD_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={firstBoard === o.value}
                  className="seg-btn"
                  onClick={() => setFirstBoard(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <span className="field-help">
              Couleur du mieux classé de la table 1 ; elle alterne ensuite d'une table à l'autre.
            </span>
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
        {editing && onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Annuler
          </button>
        )}
        <button type="submit" disabled={disabled}>
          {editing ? 'Enregistrer les paramètres' : 'Créer le tournoi'}
        </button>
      </div>
    </form>
  )
}
