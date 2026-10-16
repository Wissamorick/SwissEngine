import { useCallback, useEffect, useState } from 'react'
import * as api from './api'
import { ApiError } from './api'
import type {
  PlayerInput,
  ResultInput,
  TournamentConfigInput,
  TournamentState,
  TournamentStatus,
} from './types'
import { SYSTEM_LABELS } from './types'
import { fmtDate } from './format'
import { CreateTournament } from './components/CreateTournament'
import { AddPlayers } from './components/AddPlayers'
import { Pairings } from './components/Pairings'
import { Standings } from './components/Standings'
import { Crosstable } from './components/Crosstable'
import { RoundHistory } from './components/RoundHistory'
import type { EditRequest } from './components/RoundHistory'
import { OpenTournament } from './components/OpenTournament'
import { FolderPicker } from './components/FolderPicker'
import { Faq } from './components/Faq'
import { BrandLockup } from './components/Brand'
import { Icon } from './components/Icon'
import { Banner, BusyBar, LongTaskOverlay, useConfirm } from './components/Feedback'
import './App.css'

type Tab = 'standings' | 'crosstable' | 'rounds'
type Dialog = null | 'save' | 'open'
type View = 'tournament' | 'faq'

const CURRENT_KEY = 'swissengine.currentTournament'

// localStorage may be unavailable (private mode…): never let it break the app
function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id)
    else localStorage.removeItem(CURRENT_KEY)
  } catch {
    // ignore
  }
}

function recall(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY)
  } catch {
    return null
  }
}

export default function App() {
  const [state, setState] = useState<TournamentState | null>(null)
  const [version, setVersion] = useState(0)
  const [pendingPlayers, setPendingPlayers] = useState<PlayerInput[]>([])
  const [results, setResults] = useState<Record<number, number>>({})
  const [tab, setTab] = useState<Tab>('standings')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)
  // label of a potentially long operation, shown with the animated logo
  const [longTask, setLongTask] = useState<string | null>(null)
  const [confirm, confirmDialog] = useConfirm()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null)
  // message of the last "round impossible to pair" error (null = none)
  const [pairingBlocked, setPairingBlocked] = useState<string | null>(null)
  const [view, setView] = useState<View>('tournament')
  const [faqAnchor, setFaqAnchor] = useState<string | null>(null)

  function openFaq(anchor?: string) {
    setView('faq')
    setFaqAnchor(anchor ?? null)
  }

  const status = state?.status ?? null
  const id = status?.id ?? null

  const load = useCallback(async (tournamentId: string) => {
    const s = await api.getState(tournamentId)
    setState(s)
    setPairingBlocked(null)
    setVersion((v) => v + 1)
    remember(tournamentId)
    return s
  }, [])

  // Reconnect to the tournament that was open before a page reload
  useEffect(() => {
    const previous = recall()
    if (previous) load(previous).catch(() => remember(null))
  }, [load])

  // Run an async action and surface any error in the banner.
  // `longLabel`: the operation may take a while (shown if it does).
  async function run(fn: () => Promise<void>, longLabel?: string) {
    try {
      setBusy(true)
      setLongTask(longLabel ?? null)
      setError(null)
      setNotice(null)
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setLongTask(null)
    }
  }

  async function openStatus(s: TournamentStatus, message?: string) {
    setPendingPlayers([])
    setResults({})
    setTab('standings')
    await load(s.id)
    if (message) setNotice(message)
  }

  // ------------------------------------------------------------- actions
  function handleCreate(config: TournamentConfigInput) {
    run(async () => openStatus(await api.createTournament(config)), 'Création du tournoi…')
  }

  function handleOpenFolder(path: string) {
    run(async () => {
      const s = await api.openTournament(path)
      setDialog(null)
      await openStatus(s, `Tournoi « ${s.name} » ouvert (ronde ${s.completed_rounds} terminée).`)
    }, 'Ouverture du tournoi…')
  }

  function handleImportFile(data: unknown) {
    run(async () => {
      const s = await api.importTournament(data)
      await openStatus(
        s,
        `Tournoi « ${s.name} » importé. Pensez à l'enregistrer dans un dossier pour activer la sauvegarde automatique.`,
      )
    }, 'Import du tournoi…')
  }

  function handleSave(directory: string, folderName: string) {
    if (!id) return
    run(async () => {
      let s: TournamentStatus
      try {
        s = await api.saveTournament(id, directory, folderName)
      } catch (e) {
        if (
          e instanceof ApiError &&
          e.status === 409 &&
          (await confirm({
            title: 'Ce dossier existe déjà',
            message: (
              <>
                <p>{e.message}</p>
                <p>Le tournoi qu'il contient sera remplacé par celui-ci.</p>
              </>
            ),
            confirmLabel: 'Remplacer',
            danger: true,
          }))
        ) {
          s = await api.saveTournament(id, directory, folderName, true)
        } else {
          throw e
        }
      }
      setDialog(null)
      await load(id)
      setNotice(`Tournoi enregistré dans ${s.save_dir}. Il sera sauvegardé automatiquement.`)
    }, 'Enregistrement…')
  }

  async function handleClose() {
    if (status && !status.save_dir && status.player_count > 0) {
      const ok = await confirm({
        title: 'Fermer sans enregistrer ?',
        message:
          "Ce tournoi n'est enregistré dans aucun dossier : il sera perdu à l'arrêt du serveur.",
        confirmLabel: 'Fermer quand même',
        danger: true,
      })
      if (!ok) return
    }
    setState(null)
    setPendingPlayers([])
    setResults({})
    setError(null)
    setNotice(null)
    remember(null)
  }

  function handleSubmitPlayers() {
    if (!id) return
    run(async () => {
      await api.addPlayers(id, pendingPlayers)
      setPendingPlayers([])
      await load(id)
    })
  }

  function handleGenerateRound() {
    if (!id) return
    run(async () => {
      try {
        await api.generateRound(id)
      } catch (e) {
        // 409: no full pairing found; the tournament is unchanged
        if (e instanceof ApiError && e.status === 409) {
          setPairingBlocked(e.message)
          return
        }
        throw e
      }
      setResults({})
      await load(id)
    }, 'Calcul des appariements…')
  }

  async function handleEndTournament() {
    if (!id || !status) return
    const ok = await confirm({
      title: `Terminer le tournoi après la ronde ${status.completed_rounds} ?`,
      message:
        'Le classement actuel deviendra le classement final. Il restera possible de corriger un résultat ou de revenir à une ronde précédente.',
      confirmLabel: 'Terminer le tournoi',
    })
    if (!ok) return
    run(async () => {
      await api.endTournament(id)
      await load(id)
      setNotice(`Tournoi terminé après la ronde ${status.completed_rounds}.`)
    })
  }

  function handleSubmitResults(payload: ResultInput[]) {
    if (!id) return
    run(async () => {
      await api.enterResults(id, payload)
      setResults({})
      await load(id)
    })
  }

  function handleToggleClub(show: boolean) {
    if (!id) return
    run(async () => {
      await api.setOptions(id, show)
      await load(id)
    })
  }

  function handleSetClub(name: string, club: string) {
    if (!id) return
    run(async () => {
      await api.setPlayerClub(id, name, club)
      await load(id)
    })
  }

  // Rename a player and/or change their Elo. Returns true on success.
  async function handleEditPlayer(name: string, newName: string, elo: number): Promise<boolean> {
    if (!id) return false
    let ok = false
    await run(async () => {
      await api.editPlayer(id, name, newName, elo)
      await load(id)
      setNotice(newName !== name ? `« ${name} » s'appelle maintenant « ${newName} ».` : `Elo de ${name} mis à jour.`)
      ok = true
    })
    return ok
  }

  // Correct the results of a completed round. Returns true on success.
  async function handleCorrect(
    round: number,
    payload: ResultInput[],
    keepLaterRounds: boolean,
  ): Promise<boolean> {
    if (!id) return false
    let ok = false
    await run(async () => {
      await api.correctResults(id, round, payload, keepLaterRounds)
      if (!keepLaterRounds) setResults({})
      await load(id)
      setNotice(
        keepLaterRounds
          ? `Résultats de la ronde ${round} corrigés.`
          : `Résultats de la ronde ${round} corrigés. Les rondes suivantes ont été annulées : vous pouvez refaire les appariements.`,
      )
      ok = true
    })
    return ok
  }

  function requestCorrection(round: number) {
    setTab('rounds')
    setEditRequest({ round, nonce: Date.now() })
  }

  async function handleRollback(roundsToKeep: number) {
    if (!id || !status) return
    const cancelled = status.completed_rounds - roundsToKeep
    const pending = status.awaiting_results ? ' ainsi que les appariements de la ronde en cours' : ''
    const ok = await confirm(
      cancelled > 0
        ? {
            title: `Revenir à la fin de la ronde ${roundsToKeep} ?`,
            message: `Les résultats des ${cancelled} ronde(s) suivante(s)${pending} seront annulés.`,
            confirmLabel: 'Revenir à cette ronde',
            danger: true,
          }
        : {
            title: `Annuler les appariements de la ronde ${status.current_round} ?`,
            message: 'Vous pourrez les générer à nouveau.',
            confirmLabel: 'Annuler les appariements',
            cancelLabel: 'Conserver',
            danger: true,
          },
    )
    if (!ok) return
    run(async () => {
      await api.rollback(id, roundsToKeep)
      setResults({})
      await load(id)
      if (status.save_dir) setNotice('Les fichiers des rondes annulées ont été déplacés dans le dossier « archives ».')
    })
  }

  function openPrint(url: string) {
    window.open(url, '_blank')
  }

  // -------------------------------------------------------------- render
  const pendingRound =
    state && status?.awaiting_results ? state.rounds[state.rounds.length - 1] : null
  const roundLabel = status ? Math.min(status.current_round, status.total_rounds) : 0
  const canGenerate =
    !!status && !status.finished && !status.awaiting_results && status.player_count >= 2

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <BrandLockup onClick={() => setView('tournament')} />
          <nav className="main-nav" aria-label="Navigation principale">
            <button
              className="nav-tab"
              aria-current={view === 'tournament' ? 'page' : undefined}
              onClick={() => setView('tournament')}
            >
              Tournoi
            </button>
            <button
              className="nav-tab"
              aria-current={view === 'faq' ? 'page' : undefined}
              onClick={() => openFaq()}
            >
              <span className="label-long">FAQ &amp; documentation</span>
              <span className="label-short">Aide</span>
            </button>
          </nav>
        </div>
        <BusyBar active={busy} />
      </header>

      <main className="page">
        {(error || notice) && (
          <div className="banners">
            {error && (
              <Banner tone="error" onDismiss={() => setError(null)}>
                {error}
              </Banner>
            )}
            {notice && (
              <Banner tone="success" onDismiss={() => setNotice(null)}>
                {notice}
              </Banner>
            )}
          </div>
        )}

        {view === 'faq' && <Faq anchor={faqAnchor} />}

        {view === 'tournament' && !status && (
          <>
            <div className="page-head">
              <h1 className="page-title">Tournois</h1>
              <p className="page-lead">
                Créez un tournoi ou reprenez un tournoi enregistré. Appariements, résultats,
                classement et grille américaine sont calculés à chaque ronde.
              </p>
            </div>
            <div className="home-grid">
              <CreateTournament
                disabled={busy}
                onCreate={handleCreate}
                onHelp={(anchor) => openFaq(anchor)}
              />
              <OpenTournament
                onOpenFolder={handleOpenFolder}
                onBrowse={() => setDialog('open')}
                onImportFile={handleImportFile}
                onError={setError}
              />
            </div>
          </>
        )}

        {view === 'tournament' && status && state && (
          <>
            <section className="t-head" aria-label="Tournoi en cours">
              <div className="t-head-main">
                <p className="eyebrow">{SYSTEM_LABELS[status.system] ?? status.system}</p>
                <h1 className="page-title">{status.name}</h1>
                <RoundTrack
                  total={status.total_rounds}
                  completed={status.completed_rounds}
                  awaiting={status.awaiting_results}
                />
                <p className="t-meta">
                  <span>{status.player_count} joueurs</span>
                  <span>
                    {status.finished
                      ? `Terminé · ${status.total_rounds} rondes`
                      : `Ronde ${roundLabel} sur ${status.total_rounds}`}
                  </span>
                  {status.awaiting_results && <span>En attente des résultats</span>}
                </p>
              </div>

              <div className="t-head-side">
                <div className="toolbar">
                  <button className="secondary" onClick={() => setDialog('save')} disabled={busy}>
                    <Icon name="save" />
                    {status.save_dir ? 'Enregistrer sous…' : 'Enregistrer…'}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => openPrint(api.urls.exportJson(status.id))}
                    title="Télécharger l'état complet du tournoi (.json)"
                  >
                    <Icon name="download" />
                    .json
                  </button>
                  <button className="ghost" onClick={handleClose}>
                    Fermer
                  </button>
                </div>
                <div
                  className={
                    status.save_error ? 'save-state err' : status.save_dir ? 'save-state ok' : 'save-state warn'
                  }
                >
                  <span className="save-dot" aria-hidden />
                  {status.save_error ? (
                    <span>{status.save_error}</span>
                  ) : status.save_dir ? (
                    <span>
                      Sauvegarde automatique · {fmtDate(status.last_saved)}
                      <code title={status.save_dir}>{status.save_dir}</code>
                    </span>
                  ) : (
                    <span>
                      Non enregistré ·{' '}
                      <button className="link" onClick={() => setDialog('save')}>
                        choisir un dossier
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </section>

            {!status.finished &&
              !status.started &&
              status.max_safe_rounds !== null &&
              status.player_count >= 2 &&
              status.total_rounds > status.max_safe_rounds && (
                <Banner tone="warning">
                  Ce tournoi prévoit {status.total_rounds} rondes pour {status.player_count}{' '}
                  joueurs. Au-delà de {status.max_safe_rounds} rondes, il peut devenir impossible
                  de trouver un adversaire inédit à chacun ; le tournoi devra alors s'arrêter
                  plus tôt que prévu.{' '}
                  <button className="link" onClick={() => openFaq('nb-rondes')}>
                    Combien de rondes prévoir ?
                  </button>
                </Banner>
              )}

            {!status.finished && pairingBlocked && !status.awaiting_results && (
              <Banner tone="error" onDismiss={() => setPairingBlocked(null)}>
                <p>{pairingBlocked}</p>
                {status.completed_rounds > 0 && (
                  <div className="banner-actions">
                    <button className="secondary sm" onClick={handleEndTournament} disabled={busy}>
                      Terminer le tournoi après la ronde {status.completed_rounds}
                    </button>
                  </div>
                )}
              </Banner>
            )}

            {!status.finished && (
              <section className="card card-current">
                {pendingRound ? (
                  <>
                    <header className="card-head">
                      <h2>
                        Ronde {pendingRound.round}
                        <span className="card-sub">Appariements</span>
                      </h2>
                    </header>
                    <Pairings
                      round={pendingRound}
                      results={results}
                      editable
                      onSetResult={(table, score) => setResults((prev) => ({ ...prev, [table]: score }))}
                      onSubmit={handleSubmitResults}
                      onPrint={() => openPrint(api.urls.printPairings(status.id, pendingRound.round))}
                      onCancelRound={() => handleRollback(status.completed_rounds)}
                      extraActions={
                        pendingRound.round > 1 && (
                          <button
                            className="secondary"
                            onClick={() => requestCorrection(pendingRound.round - 1)}
                          >
                            <Icon name="edit" />
                            Corriger la ronde {pendingRound.round - 1}
                          </button>
                        )
                      }
                    />
                  </>
                ) : (
                  <div className="next-round">
                    <div>
                      <h2>Ronde {roundLabel}</h2>
                      <p className="hint">
                        {status.player_count < 2
                          ? 'Inscrivez au moins 2 joueurs pour générer les appariements.'
                          : status.completed_rounds === 0
                            ? 'Les inscriptions seront closes à la génération de la première ronde.'
                            : `Ronde ${status.completed_rounds} terminée. Les appariements tiennent compte des scores, des couleurs et des rencontres déjà jouées.`}
                      </p>
                    </div>
                    <div className="actions">
                      {status.completed_rounds > 0 && (
                        <button
                          className="secondary"
                          onClick={() => requestCorrection(status.completed_rounds)}
                        >
                          <Icon name="edit" />
                          Corriger la ronde {status.completed_rounds}
                        </button>
                      )}
                      <button onClick={handleGenerateRound} disabled={!canGenerate || busy}>
                        Générer la ronde {roundLabel}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {status.finished && (
              <Banner tone="success">
                Tournoi terminé après {status.total_rounds} ronde{status.total_rounds > 1 ? 's' : ''}. Le classement ci-dessous est
                définitif ; il reste possible de corriger un résultat dans « Rondes jouées ».
              </Banner>
            )}

            <AddPlayers
              registered={state.players}
              pending={pendingPlayers}
              locked={status.started}
              showClub={status.show_club}
              busy={busy}
              onToggleClub={handleToggleClub}
              onSetClub={handleSetClub}
              onEditPlayer={handleEditPlayer}
              onAdd={(p) => setPendingPlayers((prev) => [...prev, p])}
              onRemove={(i) => setPendingPlayers((prev) => prev.filter((_, idx) => idx !== i))}
              onSubmit={handleSubmitPlayers}
            />

            <section className="card card-results">
              <div className="tabs" role="tablist" aria-label="Résultats du tournoi">
                <button
                  role="tab"
                  aria-selected={tab === 'standings'}
                  className="tab"
                  onClick={() => setTab('standings')}
                >
                  Classement
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'crosstable'}
                  className="tab"
                  onClick={() => setTab('crosstable')}
                >
                  Grille américaine
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'rounds'}
                  className="tab"
                  onClick={() => setTab('rounds')}
                >
                  Rondes jouées <span className="count">{status.completed_rounds}</span>
                </button>
              </div>

              <div className="tab-panel" role="tabpanel">
                {tab === 'standings' && (
                  <Standings standings={state.standings} showClub={status.show_club} />
                )}
                {tab === 'crosstable' && (
                  <Crosstable
                    tournamentId={status.id}
                    completedRounds={status.completed_rounds}
                    showClub={status.show_club}
                    version={version}
                  />
                )}
                {tab === 'rounds' && (
                  <RoundHistory
                    rounds={state.rounds}
                    editRequest={editRequest}
                    busy={busy}
                    onCorrect={handleCorrect}
                    onPrintPairings={(r) => openPrint(api.urls.printPairings(status.id, r))}
                    onPrintCrosstable={(r) => openPrint(api.urls.printCrosstable(status.id, r))}
                    onRollback={handleRollback}
                  />
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {dialog === 'save' && status && (
        <FolderPicker
          mode="save"
          title="Enregistrer le tournoi"
          defaultName={status.name}
          busy={busy}
          actionError={error}
          onCancel={() => setDialog(null)}
          onConfirm={handleSave}
        />
      )}
      {dialog === 'open' && (
        <FolderPicker
          mode="open"
          title="Ouvrir un tournoi"
          busy={busy}
          actionError={error}
          onCancel={() => setDialog(null)}
          onConfirm={(path) => handleOpenFolder(path)}
        />
      )}
      {confirmDialog}
      <LongTaskOverlay label={longTask} />
    </div>
  )
}

/**
 * One segment per round: played (ink), current (red, like the logo's field),
 * still to come (light). Gives the tournament's progress at a glance.
 */
function RoundTrack({
  total,
  completed,
  awaiting,
}: {
  total: number
  completed: number
  awaiting: boolean
}) {
  if (total <= 0) return null
  const current = completed < total ? completed + 1 : null
  return (
    <ol className="round-track" aria-label={`${completed} ronde(s) jouée(s) sur ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const r = i + 1
        const state = r <= completed ? 'done' : r === current ? (awaiting ? 'live' : 'next') : 'todo'
        return (
          <li key={r} className={`rt-${state}`} title={`Ronde ${r}`}>
            <span className="rt-label">{r}</span>
          </li>
        )
      })}
    </ol>
  )
}
