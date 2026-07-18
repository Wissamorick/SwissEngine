import { useState } from 'react'
import * as api from './api'
import type {
  Pairing,
  PlayerInput,
  ResultInput,
  StandingEntry,
  TournamentConfigInput,
  TournamentStatus,
} from './types'
import { CreateTournament } from './components/CreateTournament'
import { AddPlayers } from './components/AddPlayers'
import { Pairings } from './components/Pairings'
import { Standings } from './components/Standings'
import './App.css'

export default function App() {
  const [status, setStatus] = useState<TournamentStatus | null>(null)
  const [players, setPlayers] = useState<PlayerInput[]>([])
  const [playersSubmitted, setPlayersSubmitted] = useState(false)
  const [pairings, setPairings] = useState<Pairing[]>([])
  const [results, setResults] = useState<Record<number, number>>({})
  const [standings, setStandings] = useState<StandingEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  // Run an async API call and surface any error in the banner.
  async function run(fn: () => Promise<void>) {
    try {
      setError(null)
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function handleCreate(config: TournamentConfigInput) {
    run(async () => {
      const s = await api.createTournament(config)
      setStatus(s)
      setPlayers([])
      setPlayersSubmitted(false)
      setPairings([])
      setResults({})
      setStandings([])
    })
  }

  function handleSubmitPlayers() {
    if (!status) return
    run(async () => {
      const s = await api.addPlayers(status.id, players)
      setStatus(s)
      setPlayersSubmitted(true)
    })
  }

  function handleGenerateRound() {
    if (!status) return
    run(async () => {
      const p = await api.generateRound(status.id)
      setPairings(p)
      setResults({})
      // generate-round returns pairings; refetch status for round/awaiting flags.
      setStatus(await api.getStatus(status.id))
    })
  }

  function handleSetResult(table: number, whiteScore: number) {
    setResults((prev) => ({ ...prev, [table]: whiteScore }))
  }

  function handleSubmitResults(payload: ResultInput[]) {
    if (!status) return
    run(async () => {
      const s = await api.enterResults(status.id, payload)
      setStatus(s)
      setStandings(await api.getStandings(status.id))
      setPairings([])
      setResults({})
    })
  }

  const roundLabel = status
    ? Math.min(status.current_round, status.total_rounds)
    : 0

  return (
    <div className="app">
      <h1>SwissEngine</h1>

      {error && <div className="error">{error}</div>}

      {status && (
        <div className="status">
          Système <b>{status.system}</b> · ronde <b>{roundLabel}/{status.total_rounds}</b>{' '}
          · {status.player_count} joueurs
          {status.awaiting_results && ' · en attente de résultats'}
          {status.finished && ' · terminé'}
        </div>
      )}

      <CreateTournament disabled={status !== null} onCreate={handleCreate} />

      {status && (
        <AddPlayers
          players={players}
          disabled={playersSubmitted}
          onAdd={(p) => setPlayers((prev) => [...prev, p])}
          onRemove={(i) =>
            setPlayers((prev) => prev.filter((_, idx) => idx !== i))
          }
          onSubmit={handleSubmitPlayers}
        />
      )}

      {playersSubmitted && !status?.finished && (
        <div className="card">
          <h2>3. Rondes</h2>
          <button
            onClick={handleGenerateRound}
            disabled={status?.awaiting_results}
          >
            Générer la ronde {roundLabel}
          </button>
        </div>
      )}

      {pairings.length > 0 && (
        <Pairings
          pairings={pairings}
          results={results}
          awaitingResults={status?.awaiting_results ?? false}
          onSetResult={handleSetResult}
          onSubmit={handleSubmitResults}
        />
      )}

      <Standings standings={standings} />
    </div>
  )
}
