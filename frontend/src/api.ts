// Thin HTTP client around the FastAPI backend.
// Every function maps to exactly one endpoint.

import type {
  Pairing,
  PlayerInput,
  ResultInput,
  StandingEntry,
  TournamentConfigInput,
  TournamentStatus,
} from './types'

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // response had no JSON body
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export function createTournament(
  config: TournamentConfigInput,
): Promise<TournamentStatus> {
  return request('/tournament', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

export function getStatus(id: string): Promise<TournamentStatus> {
  return request(`/tournament/${id}`)
}

export function addPlayers(
  id: string,
  players: PlayerInput[],
): Promise<TournamentStatus> {
  return request(`/tournament/${id}/players`, {
    method: 'POST',
    body: JSON.stringify({ players }),
  })
}

export function generateRound(id: string): Promise<Pairing[]> {
  return request(`/tournament/${id}/generate-round`, { method: 'POST' })
}

export function enterResults(
  id: string,
  results: ResultInput[],
): Promise<TournamentStatus> {
  return request(`/tournament/${id}/results`, {
    method: 'POST',
    body: JSON.stringify({ results }),
  })
}

export function getStandings(id: string): Promise<StandingEntry[]> {
  return request(`/tournament/${id}/standings`)
}
