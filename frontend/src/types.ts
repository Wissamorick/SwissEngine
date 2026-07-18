// Types mirroring the backend Pydantic schemas.
// The frontend holds no tournament logic: it only sends/receives these shapes.

export interface TournamentConfigInput {
  system: string
  rounds: number
  points: number[]
  beta: number
  bye_value: number
  seeding: boolean
}

export interface PlayerInput {
  name: string
  elo: number
}

export interface ResultInput {
  table: number
  white_score: number
}

export interface TournamentStatus {
  id: string
  system: string
  total_rounds: number
  current_round: number
  started: boolean
  awaiting_results: boolean
  finished: boolean
  player_count: number
}

export interface Pairing {
  table: number
  white_name: string
  black_name: string
  is_bye: boolean
}

export interface StandingEntry {
  rank: number
  name: string
  elo: number
  pts: number
  color_diff: number
  tiebreaks: Record<string, number>
}

export const SWISS_SYSTEMS = [
  'dutch',
  'burstein',
  'monrad',
  'swissrandom',
  'swissrandom2',
  'mixed',
] as const

export const ALL_SYSTEMS = [...SWISS_SYSTEMS, 'random', 'roundrobin'] as const
