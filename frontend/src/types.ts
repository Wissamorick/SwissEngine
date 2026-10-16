// Types mirroring the backend Pydantic schemas.
// The frontend holds no tournament logic: it only sends/receives these shapes.

export interface TournamentConfigInput {
  name: string
  system: string
  rounds: number
  points: number[]
  beta: number
  bye_value: number
  seeding: boolean
  show_club: boolean
}

export interface PlayerInput {
  name: string
  elo: number
  club?: string | null
}

export interface ResultInput {
  table: number
  white_score: number
}

export interface TournamentStatus {
  id: string
  name: string
  system: string
  total_rounds: number
  current_round: number
  completed_rounds: number
  started: boolean
  awaiting_results: boolean
  finished: boolean
  player_count: number
  show_club: boolean
  /** above this number of rounds a full pairing may not exist (null: round-robin) */
  max_safe_rounds: number | null
  config: Omit<TournamentConfigInput, 'name' | 'show_club'>
  save_dir: string | null
  last_saved: string | null
  save_error: string | null
}

export interface Pairing {
  table: number
  white_name: string
  black_name: string
  is_bye: boolean
  white_elo: number
  black_elo: number
  /** points before the round */
  white_pts: number
  black_pts: number
  /** result from White's perspective, null until entered */
  white_score: number | null
}

export interface RoundInfo {
  round: number
  win_value: number
  completed: boolean
  pairings: Pairing[]
}

export interface StandingEntry {
  rank: number
  name: string
  club: string | null
  elo: number
  pts: number
  color_diff: number
  tiebreaks: Record<string, number>
}

export interface CrosstableCell {
  round: number
  bye: boolean
  opponent: string | null
  opponent_rank: number | null
  color: 'W' | 'B' | null
  result: '+' | '=' | '-' | null
  points: number
}

export interface CrosstableRow {
  rank: number
  name: string
  club: string | null
  elo: number
  pts: number
  tiebreaks: Record<string, number>
  cells: CrosstableCell[]
}

export interface Crosstable {
  after_round: number
  tiebreak_keys: string[]
  rows: CrosstableRow[]
}

export interface TournamentState {
  status: TournamentStatus
  players: PlayerInput[]
  rounds: RoundInfo[]
  standings: StandingEntry[]
}

export interface RecentTournament {
  name: string
  path: string
  saved_at: string | null
}

export interface DirEntry {
  name: string
  path: string
  is_tournament: boolean
}

export interface DirListing {
  path: string
  parent: string | null
  is_tournament: boolean
  entries: DirEntry[]
  roots: string[]
  home: string
  default_dir: string
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

// Pairing system names are kept in English on purpose (standard names).
export const SYSTEM_LABELS: Record<string, string> = {
  dutch: 'Swiss Dutch',
  burstein: 'Swiss Burstein',
  monrad: 'Monrad',
  swissrandom: 'Swiss Random',
  swissrandom2: 'Swiss Random 2',
  mixed: 'Mixte (Swiss Dutch puis Swiss Burstein)',
  random: 'Aléatoire',
  roundrobin: 'Round-robin (toutes rondes)',
}

export const TIEBREAK_LABELS: Record<string, string> = {
  Bu1: 'Tr.',
  Bu: 'Buchholz',
  SB: 'S.-B.',
}
