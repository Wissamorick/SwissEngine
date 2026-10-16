// Thin HTTP client around the FastAPI backend.
// Every function maps to exactly one endpoint.

import type {
  Crosstable,
  DirListing,
  Pairing,
  PlayerInput,
  RecentTournament,
  ResultInput,
  StandingEntry,
  TournamentConfigInput,
  TournamentState,
  TournamentStatus,
} from './types'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new ApiError(
      "Impossible de joindre le serveur. Vérifiez que l'API (uvicorn) est lancée.",
      0,
    )
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // response had no JSON body
    }
    throw new ApiError(detail, res.status)
  }
  return res.json() as Promise<T>
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function createTournament(config: TournamentConfigInput): Promise<TournamentStatus> {
  return post('/tournament', config)
}

export function getStatus(id: string): Promise<TournamentStatus> {
  return request(`/tournament/${id}`)
}

export function getState(id: string): Promise<TournamentState> {
  return request(`/tournament/${id}/state`)
}

export function addPlayers(id: string, players: PlayerInput[]): Promise<TournamentStatus> {
  return post(`/tournament/${id}/players`, { players })
}

export function generateRound(id: string): Promise<Pairing[]> {
  return post(`/tournament/${id}/generate-round`)
}

export function enterResults(id: string, results: ResultInput[]): Promise<TournamentStatus> {
  return post(`/tournament/${id}/results`, { results })
}

export function getStandings(id: string): Promise<StandingEntry[]> {
  return request(`/tournament/${id}/standings`)
}

export function getCrosstable(id: string, round?: number): Promise<Crosstable> {
  const q = round === undefined ? '' : `?round=${round}`
  return request(`/tournament/${id}/crosstable${q}`)
}

export function correctResults(
  id: string,
  round: number,
  results: ResultInput[],
  keepLaterRounds: boolean,
): Promise<TournamentStatus> {
  return post(`/tournament/${id}/rounds/${round}/results`, {
    results,
    keep_later_rounds: keepLaterRounds,
  })
}

export function setOptions(id: string, showClub: boolean): Promise<TournamentStatus> {
  return post(`/tournament/${id}/options`, { show_club: showClub })
}

export function setPlayerClub(id: string, name: string, club: string): Promise<TournamentStatus> {
  return post(`/tournament/${id}/player-club`, { name, club })
}

export function editPlayer(
  id: string,
  name: string,
  newName: string,
  elo: number,
): Promise<TournamentStatus> {
  return post(`/tournament/${id}/player-edit`, { name, new_name: newName, elo })
}

export function endTournament(id: string): Promise<TournamentStatus> {
  return post(`/tournament/${id}/end`)
}

export function rollback(id: string, roundsToKeep: number): Promise<TournamentStatus> {
  return post(`/tournament/${id}/rollback`, { rounds_to_keep: roundsToKeep })
}

export function saveTournament(
  id: string,
  directory: string,
  folderName: string,
  overwrite = false,
): Promise<TournamentStatus> {
  return post(`/tournament/${id}/save`, {
    directory,
    folder_name: folderName,
    overwrite,
  })
}

export function openTournament(path: string): Promise<TournamentStatus> {
  return post('/tournaments/open', { path })
}

export function importTournament(data: unknown): Promise<TournamentStatus> {
  return post('/tournaments/import', { data })
}

export function listRecent(): Promise<RecentTournament[]> {
  return request('/recent')
}

export function listDirectory(path?: string): Promise<DirListing> {
  const q = path ? `?path=${encodeURIComponent(path)}` : ''
  return request(`/fs/list${q}`)
}

// URLs opened in a new tab (printable pages / file download)
export const urls = {
  printPairings: (id: string, round: number) =>
    `${BASE}/tournament/${id}/print/pairings/${round}?auto=true`,
  printCrosstable: (id: string, round: number) =>
    `${BASE}/tournament/${id}/print/crosstable/${round}?auto=true`,
  exportJson: (id: string) => `${BASE}/tournament/${id}/export`,
}
