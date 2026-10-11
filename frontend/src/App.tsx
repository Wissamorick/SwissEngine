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
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null)
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
  async function run(fn: () => Promise<void>) {
    try {
      setBusy(true)
      setError(null)
      setNotice(null)
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
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
    run(async () => openStatus(await api.createTournament(config)))
  }

  function handleOpenFolder(path: string) {
    run(async () => {
      const s = await api.openTournament(path)
      setDialog(null)
      await openStatus(s, `Tournoi « ${s.name} » ouvert (ronde ${s.completed_rounds} terminée).`)
    })
  }

  function handleImportFile(data: unknown) {
    run(async () => {
      const s = await api.importTournament(data)
      await openStatus(
        s,
        `Tournoi « ${s.name} » importé. Pensez à l'enregistrer dans un dossier pour activer la sauvegarde automatique.`,
      )
    })
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
          window.confirm(`${e.message}\n\nRemplacer le tournoi existant ?`)
        ) {
          s = await api.saveTournament(id, directory, folderName, true)
        } else {
          throw e
        }
      }
      setDialog(null)
      await load(id)
      setNotice(`Tournoi enregistré dans ${s.save_dir}. Il sera sauvegardé automatiquement.`)
    })
  }

  function handleClose() {
    if (status && !status.save_dir && status.player_count > 0) {
      if (!window.confirm("Ce tournoi n'est pas enregistré. Le fermer quand même ?")) return
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
      await api.generateRound(id)
      setResults({})
      await load(id)
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

  function handleRollback(roundsToKeep: number) {
    if (!id || !status) return
    const cancelled = status.completed_rounds - roundsToKeep
    const pending = status.awaiting_results ? ' ainsi que les appariements de la ronde en cours' : ''
    const msg =
      cancelled > 0
        ? `Revenir à la fin de la ronde ${roundsToKeep} ? Les résultats des ${cancelled} ronde(s) suivante(s)${pending} seront annulés.`
        : `Annuler les appariements de la ronde ${status.current_round} ? Vous pourrez les générer à nouveau.`
    if (!window.confirm(msg)) return
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
      <header className="topbar">
        <div className="brand-nav">
          <h1>SwissEngine</h1>
          <nav className="main-nav" aria-label="Navigation principale">
            <button
              className={view === 'tournament' ? 'nav-tab active' : 'nav-tab'}
              onClick={() => setView('tournament')}
            >
              Tournoi
            </button>
            <button
              className={view === 'faq' ? 'nav-tab active' : 'nav-tab'}
              onClick={() => openFaq()}
            >
              FAQ &amp; documentation
            </button>
          </nav>
        </div>
        {status && view === 'tournament' && (
          <div className="topbar-actions">
            <button className="secondary" onClick={() => setDialog('save')} disabled={busy}>
              {status.save_dir ? 'Enregistrer sous…' : 'Enregistrer…'}
            </button>
            <button className="secondary" onClick={() => openPrint(api.urls.exportJson(status.id))}>
              Télécharger (.json)
            </button>
            <button className="secondary" onClick={handleClose}>
              Fermer
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
          <button className="link close" onClick={() => setError(null)} aria-label="Masquer le message">
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="notice">
          {notice}
          <button className="link close" onClick={() => setNotice(null)} aria-label="Masquer le message">
            ×
          </button>
        </div>
      )}

      {view === 'faq' && <Faq anchor={faqAnchor} />}

      {view === 'tournament' && !status && (
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
      )}

      {view === 'tournament' && status && state && (
        <>
          <section className="status">
            <div>
              <h2 className="tournament-name">{status.name}</h2>
              <div className="muted">
                {SYSTEM_LABELS[status.system] ?? status.system} · {status.player_count} joueurs ·{' '}
                {status.finished
                  ? `terminé (${status.total_rounds} rondes)`
                  : `ronde ${roundLabel}/${status.total_rounds}`}
                {status.awaiting_results && ' · en attente des résultats'}
              </div>
            </div>
            <div className={status.save_dir ? 'save-state ok' : 'save-state warn'}>
              {status.save_error ? (
                <span className="danger-text">{status.save_error}</span>
              ) : status.save_dir ? (
                <>
                  Sauvegarde automatique · {fmtDate(status.last_saved)}
                  <br />
                  <code title={status.save_dir}>{status.save_dir}</code>
                </>
              ) : (
                <>
                  Non enregistré —{' '}
                  <button className="link" onClick={() => setDialog('save')}>
                    choisir un dossier
                  </button>
                </>
              )}
            </div>
          </section>

          <AddPlayers
            registered={state.players}
            pending={pendingPlayers}
            locked={status.started}
            showClub={status.show_club}
            onToggleClub={handleToggleClub}
            onSetClub={handleSetClub}
            onAdd={(p) => setPendingPlayers((prev) => [...prev, p])}
            onRemove={(i) => setPendingPlayers((prev) => prev.filter((_, idx) => idx !== i))}
            onSubmit={handleSubmitPlayers}
          />

          {!status.finished && (
            <div className="card">
              <h2>{pendingRound ? `Ronde ${pendingRound.round} — appariements` : 'Rondes'}</h2>
              {pendingRound ? (
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
                        Corriger la ronde {pendingRound.round - 1}
                      </button>
                    )
                  }
                />
              ) : (
                <div className="actions">
                  <button onClick={handleGenerateRound} disabled={!canGenerate || busy}>
                    Générer la ronde {roundLabel}
                  </button>
                  {status.completed_rounds > 0 && (
                    <button
                      className="secondary"
                      onClick={() => requestCorrection(status.completed_rounds)}
                    >
                      Corriger la ronde {status.completed_rounds}
                    </button>
                  )}
                </div>
              )}
              {!pendingRound && status.player_count < 2 && (
                <p className="hint">Inscrivez au moins 2 joueurs.</p>
              )}
            </div>
          )}

          <div className="card">
            <div className="tabs" role="tablist">
              <button
                role="tab"
                className={tab === 'standings' ? 'tab active' : 'tab'}
                onClick={() => setTab('standings')}
              >
                Classement
              </button>
              <button
                role="tab"
                className={tab === 'crosstable' ? 'tab active' : 'tab'}
                onClick={() => setTab('crosstable')}
              >
                Grille américaine
              </button>
              <button
                role="tab"
                className={tab === 'rounds' ? 'tab active' : 'tab'}
                onClick={() => setTab('rounds')}
              >
                Rondes jouées ({status.completed_rounds})
              </button>
            </div>

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
        </>
      )}

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
    </div>
  )
}
