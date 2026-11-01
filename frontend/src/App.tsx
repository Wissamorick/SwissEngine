import { useCallback, useEffect, useState } from 'react'
import * as api from './api'
import { ApiError } from './api'
import type {
  PlayerInput,
  ResultInput,
  Score,
  TournamentConfigInput,
  TournamentState,
  TournamentStatus,
} from './types'
import { MAX_ROUND_ROBIN_PLAYERS, SYSTEM_LABELS } from './types'
import { fmtDate } from './format'
import { CreateTournament } from './components/CreateTournament'
import { AddPlayers } from './components/AddPlayers'
import { Pairings } from './components/Pairings'
import { Standings } from './components/Standings'
import { Crosstable } from './components/Crosstable'
import { ResultsGrid } from './components/ResultsGrid'
import { Schedule } from './components/Schedule'
import { RoundHistory } from './components/RoundHistory'
import type { EditRequest } from './components/RoundHistory'
import { OpenTournament } from './components/OpenTournament'
import { FolderPicker } from './components/FolderPicker'
import { Faq } from './components/Faq'
import { BrandLockup } from './components/Brand'
import { Icon } from './components/Icon'
import { Banner, BusyBar, LongTaskOverlay, Modal, useConfirm } from './components/Feedback'
import './App.css'

type Tab = 'standings' | 'crosstable' | 'rounds' | 'grid'
type Dialog = null | 'save' | 'open' | 'settings'
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
  const [results, setResults] = useState<Record<number, Score>>({})
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
  // Settings can be changed until the first round is generated.
  function handleUpdateSettings(config: TournamentConfigInput) {
    if (!id) return
    run(async () => {
      await api.updateSettings(id, config)
      setDialog(null)
      await load(id)
      setNotice('Paramètres du tournoi mis à jour.')
    })
  }

  async function handleRemovePlayer(name: string) {
    if (!id) return
    const ok = await confirm({
      title: 'Retirer ce joueur ?',
      message: `« ${name} » sera retiré de la liste des inscrits.`,
      confirmLabel: 'Retirer',
      danger: true,
    })
    if (!ok) return
    run(async () => {
      await api.removePlayer(id, name)
      await load(id)
      setNotice(`« ${name} » a été retiré.`)
    })
  }

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

  // Round-robin: the whole calendar at once (closes the registrations)
  function handleStartSchedule() {
    if (!id) return
    run(async () => {
      await api.startSchedule(id)
      await load(id)
    }, 'Création du calendrier…')
  }

  // Round-robin: one result saved at once (null clears it)
  function handleSetGameResult(round: number, table: number, whiteScore: Score | null) {
    if (!id) return
    run(async () => {
      await api.setGameResult(id, round, table, whiteScore)
      await load(id)
    })
  }

  async function handleEndCalendar() {
    if (!id || !status) return
    const ok = await confirm({
      title: 'Terminer le tournoi maintenant ?',
      message: (
        <>
          <p>
            Les rondes qui n'ont encore aucun résultat seront retirées du calendrier et le
            classement actuel deviendra définitif. Cette action est définitive.
          </p>
          <p>Toutes les rondes déjà commencées doivent être complètes.</p>
        </>
      ),
      confirmLabel: 'Terminer le tournoi',
      danger: true,
    })
    if (!ok) return
    run(async () => {
      await api.endTournament(id)
      const s = await load(id)
      setNotice(`Tournoi terminé après ${s.status.total_rounds} ronde${s.status.total_rounds > 1 ? 's' : ''}.`)
    })
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
  // Players read from a file are registered at once (not added to the pending list).
  async function handleImportPlayers(players: PlayerInput[], hasClub: boolean): Promise<string | null> {
    if (!id) return 'Aucun tournoi ouvert.'
    const turnOnClub = hasClub && !status?.show_club
    try {
      setBusy(true)
      await api.addPlayers(id, players)
      let clubOn = false
      if (turnOnClub) {
        try {
          await api.setOptions(id, true)
          clubOn = true
        } catch {
          // players are registered anyway; the option can be turned on by hand
        }
      }
      await load(id)
      setError(null)
      setNotice(
        `${players.length} joueur${players.length > 1 ? 's' : ''} importé${players.length > 1 ? 's' : ''}.` +
          (clubOn ? ' L’option « Afficher club / équipe » a été activée (vous pouvez la désactiver).' : ''),
      )
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    } finally {
      setBusy(false)
    }
  }

  // ---- absences, late arrivals, withdrawals (Swiss and random systems)
  function handleAbsence(name: string, value: number | null) {
    if (!id) return
    run(async () => {
      await api.setAbsence(id, name, value)
      await load(id)
    })
  }

  async function handleWithdraw(name: string) {
    if (!id || !status) return
    const ok = await confirm({
      title: `Retrait de ${name} ?`,
      message: (
        <>
          <p>
            {name} ne sera plus apparié à partir de la ronde {status.next_round} et marquera 0 point aux rondes
            restantes. Il reste dans le classement.
          </p>
          {status.awaiting_results && (
            <p>Sa partie de la ronde en cours doit quand même recevoir un résultat (un forfait si elle n'est pas jouée).</p>
          )}
          <p>Le retrait peut être annulé (« Réintégrer »).</p>
        </>
      ),
      confirmLabel: 'Confirmer le retrait',
      danger: true,
    })
    if (!ok) return
    run(async () => {
      await api.withdrawPlayer(id, name)
      await load(id)
      setNotice(`${name} s'est retiré du tournoi.`)
    })
  }

  function handleCancelLate(name: string) {
    if (!id) return
    run(async () => {
      await api.cancelLate(id, name)
      await load(id)
      setNotice(`L'inscription de ${name} a été annulée.`)
    })
  }

  function handleReinstate(name: string) {
    if (!id) return
    run(async () => {
      await api.reinstatePlayer(id, name)
      await load(id)
      setNotice(`${name} sera de nouveau apparié à partir de la ronde ${status?.next_round}.`)
    })
  }

  async function handleAddLate(player: PlayerInput, missedValue: number): Promise<string | null> {
    if (!id) return 'Aucun tournoi ouvert.'
    try {
      setBusy(true)
      await api.addLatePlayers(id, [player], missedValue)
      const s = await load(id)
      setError(null)
      setNotice(
        s.pending_late.some((p) => p.name === player.name)
          ? `${player.name} sera inscrit à la validation des résultats de la ronde ${s.status.current_round} et jouera à partir de la ronde ${s.status.next_round}.`
          : `${player.name} est inscrit : il jouera à partir de la ronde ${s.status.next_round}.`,
      )
      return null
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    } finally {
      setBusy(false)
    }
  }

  async function handleEditPlayer(name: string, newName: string, elo: number): Promise<boolean> {
    if (!id) return false
    let ok = false
    await run(async () => {
      await api.editPlayer(id, name, newName, elo)
      await load(id)
      setNotice(
        newName !== name
          ? `« ${name} » s'appelle maintenant « ${newName} ».`
          : `Elo de ${name} mis à jour.` +
              (status?.started
                ? ' Les appariements déjà faits ne changent pas ; le nouvel Elo comptera pour les rondes suivantes.'
                : ''),
      )
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
  const isRoundRobin = status?.system === 'roundrobin'
  // round-robin once started: every round exists, results in any order
  const calendar = isRoundRobin && !!status?.started
  const legRounds =
    status && status.config.double_round_robin ? status.total_rounds / 2 : (status?.total_rounds ?? 0)
  // the crosstable and the round history do not apply to a round-robin
  const shownTab: Tab = isRoundRobin
    ? tab === 'standings'
      ? 'standings'
      : 'grid'
    : tab === 'grid'
      ? 'crosstable'
      : tab
  const roundComplete = (r: { pairings: { is_bye: boolean; white_score: Score | null }[] }) =>
    r.pairings.every((p) => p.is_bye || p.white_score !== null)

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
                <p className="eyebrow">
                  {status.config.double_round_robin
                    ? 'Round-robin aller-retour'
                    : (SYSTEM_LABELS[status.system] ?? status.system)}
                </p>
                <h1 className="page-title">{status.name}</h1>
                {calendar ? (
                  <CalendarTrack rounds={state.rounds} />
                ) : (
                  <RoundTrack
                    total={status.total_rounds}
                    completed={status.completed_rounds}
                    awaiting={status.awaiting_results}
                  />
                )}
                <p className="t-meta">
                  <span>{status.player_count} joueurs</span>
                  {calendar ? (
                    <span>
                      {status.finished ? 'Terminé · ' : ''}
                      {status.games_played ?? 0} partie{(status.games_played ?? 0) > 1 ? 's' : ''}{' '}
                      saisie{(status.games_played ?? 0) > 1 ? 's' : ''} sur {status.games_total ?? 0}
                    </span>
                  ) : isRoundRobin ? (
                    <span>{status.total_rounds} rondes au calendrier</span>
                  ) : (
                    <span>
                      {status.finished
                        ? `Terminé · ${status.total_rounds} rondes`
                        : `Ronde ${roundLabel} sur ${status.total_rounds}`}
                    </span>
                  )}
                  {status.awaiting_results && <span>En attente des résultats</span>}
                </p>
              </div>

              <div className="t-head-side">
                <div className="toolbar">
                  {!status.started && (
                    <button
                      className="secondary"
                      onClick={() => setDialog('settings')}
                      disabled={busy}
                      title="Système, nombre de rondes, points… (modifiables jusqu'à la première ronde)"
                    >
                      <Icon name="edit" />
                      Paramètres
                    </button>
                  )}
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

            {calendar && (
              <section className="card card-current">
                <header className="card-head">
                  <h2>
                    Calendrier
                    <span className="card-sub">
                      {status.config.double_round_robin ? 'aller-retour' : `${status.total_rounds} rondes`}
                    </span>
                  </h2>
                  <div className="card-head-tools">
                    {!status.finished && (
                      <button
                        className="secondary sm"
                        onClick={handleEndCalendar}
                        disabled={busy || !status.games_played}
                        title="Arrêter le tournoi avant la fin du calendrier"
                      >
                        Terminer le tournoi
                      </button>
                    )}
                  </div>
                </header>
                <Schedule
                  rounds={state.rounds}
                  legRounds={legRounds}
                  double={status.config.double_round_robin}
                  initialRound={
                    (state.rounds.find((r) => !roundComplete(r))?.round ?? state.rounds.length) || 1
                  }
                  onSetResult={handleSetGameResult}
                  onPrint={(r) => openPrint(api.urls.printPairings(status.id, r))}
                />
              </section>
            )}

            {isRoundRobin && !status.started && (
              <section className="card card-current">
                <div className="next-round">
                  <div>
                    <h2>Calendrier</h2>
                    <p className="hint">
                      {status.player_count < 2
                        ? 'Inscrivez au moins 2 joueurs pour générer le calendrier.'
                        : `Toutes les rondes (${status.total_rounds}) seront créées d'un coup ; les résultats pourront être saisis dans n'importe quel ordre. Les inscriptions seront closes.`}
                    </p>
                  </div>
                  <div className="actions">
                    <button onClick={handleStartSchedule} disabled={!canGenerate || busy}>
                      Générer le calendrier
                    </button>
                  </div>
                </div>
              </section>
            )}

            {!status.finished && !isRoundRobin && (
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
                      onClearResult={(table) =>
                        setResults((prev) => {
                          const next = { ...prev }
                          delete next[table]
                          return next
                        })
                      }
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

            {status.finished && isRoundRobin && (
              <Banner tone="success">
                Tournoi terminé : tous les résultats sont saisis. Le classement ci-dessous est
                définitif ; un résultat peut encore être modifié dans le calendrier.
              </Banner>
            )}

            {status.finished && !isRoundRobin && (
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
              maxPlayers={isRoundRobin ? MAX_ROUND_ROBIN_PLAYERS : null}
              presence={
                !status.finished && !isRoundRobin
                  ? {
                      nextRound: status.next_round,
                      roundPending: status.awaiting_results,
                      lastRound: status.awaiting_results && status.current_round >= status.total_rounds,
                      pendingLate: state.pending_late ?? [],
                      onCancelLate: handleCancelLate,
                      onAbsence: handleAbsence,
                      onWithdraw: handleWithdraw,
                      onReinstate: handleReinstate,
                      onAddLate: handleAddLate,
                    }
                  : null
              }
              busy={busy}
              onToggleClub={handleToggleClub}
              onSetClub={handleSetClub}
              onEditPlayer={handleEditPlayer}
              onAdd={(p) => setPendingPlayers((prev) => [...prev, p])}
              onRemove={(i) => setPendingPlayers((prev) => prev.filter((_, idx) => idx !== i))}
              onSubmit={handleSubmitPlayers}
              onImport={handleImportPlayers}
              onRemovePlayer={handleRemovePlayer}
            />

            <section className="card card-results">
              <div className="tabs" role="tablist" aria-label="Résultats du tournoi">
                <button
                  role="tab"
                  aria-selected={shownTab === 'standings'}
                  className="tab"
                  onClick={() => setTab('standings')}
                >
                  Classement
                </button>
                {isRoundRobin ? (
                  <button
                    role="tab"
                    aria-selected={shownTab === 'grid'}
                    className="tab"
                    onClick={() => setTab('grid')}
                  >
                    Grille des résultats
                  </button>
                ) : (
                  <>
                    <button
                      role="tab"
                      aria-selected={shownTab === 'crosstable'}
                      className="tab"
                      onClick={() => setTab('crosstable')}
                    >
                      Grille américaine
                    </button>
                    <button
                      role="tab"
                      aria-selected={shownTab === 'rounds'}
                      className="tab"
                      onClick={() => setTab('rounds')}
                    >
                      Rondes jouées <span className="count">{status.completed_rounds}</span>
                    </button>
                  </>
                )}
              </div>

              <div className="tab-panel" role="tabpanel">
                {shownTab === 'standings' && (
                  <Standings standings={state.standings} showClub={status.show_club} />
                )}
                {shownTab === 'grid' &&
                  (status.started ? (
                    <ResultsGrid tournamentId={status.id} showClub={status.show_club} version={version} />
                  ) : (
                    <p className="hint">La grille apparaîtra dès que le calendrier sera généré.</p>
                  ))}
                {shownTab === 'crosstable' && (
                  <Crosstable
                    tournamentId={status.id}
                    completedRounds={status.completed_rounds}
                    showClub={status.show_club}
                    version={version}
                  />
                )}
                {shownTab === 'rounds' && (
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
      {dialog === 'settings' && status && !status.started && (
        <Modal title="Paramètres du tournoi" onClose={() => setDialog(null)} size="lg">
          {error && <Banner tone="error">{error}</Banner>}
          <p className="hint">
            Modifiables tant que la première ronde n'a pas été générée. Les joueurs inscrits sont
            conservés.
          </p>
          <CreateTournament
            disabled={busy}
            initial={{ ...status.config, name: status.name, show_club: status.show_club }}
            onCreate={handleUpdateSettings}
            onCancel={() => setDialog(null)}
            onHelp={(anchor) => {
              setDialog(null)
              openFaq(anchor)
            }}
          />
        </Modal>
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

/** Round-robin: one segment per round of the calendar, filled when complete. */
function CalendarTrack({
  rounds,
}: {
  rounds: { round: number; pairings: { is_bye: boolean; white_score: Score | null }[] }[]
}) {
  if (rounds.length === 0) return null
  const done = rounds.filter((r) => r.pairings.every((p) => p.is_bye || p.white_score !== null))
  return (
    <ol className="round-track" aria-label={`${done.length} ronde(s) complète(s) sur ${rounds.length}`}>
      {rounds.map((r) => {
        const games = r.pairings.filter((p) => !p.is_bye)
        const entered = games.filter((p) => p.white_score !== null).length
        const state = entered === games.length ? 'done' : entered > 0 ? 'partial' : 'todo'
        return (
          <li key={r.round} className={`rt-${state}`} title={`Ronde ${r.round} : ${entered}/${games.length}`}>
            <span className="rt-label">{r.round}</span>
          </li>
        )
      })}
    </ol>
  )
}
