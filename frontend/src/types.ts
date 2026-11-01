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
  /** round 1: color of the higher-ranked player on table 1 (then alternating) */
  first_board_color: 'white' | 'random' | 'black'
  /** round-robin only: every game twice, colors reversed (all first-leg rounds first) */
  double_round_robin: boolean
  show_club: boolean
}

export interface PlayerInput {
  name: string
  elo: number
  club?: string | null
  /** late arrival: first round the player could play (state only) */
  joined?: number | null
  /** withdrawal: first round no longer played (state only) */
  withdrawn_from?: number | null
  /** declared absent from the next round: points of the absence, 0 or ½ (state only) */
  absent_next?: number | null
}

/** Forfeits, written from White's side: Black forfeited, White forfeited, both */
export const FORFEIT_CODES = ['1-F', 'F-1', 'F-F'] as const
export type ForfeitCode = (typeof FORFEIT_CODES)[number]

/** Result from White's side: 1, 0.5, 0, or a forfeit code */
export type Score = number | ForfeitCode

export interface ResultInput {
  table: number
  white_score: Score
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
  /** number of the next round to pair (absences are declared for it) */
  next_round: number
  config: Omit<TournamentConfigInput, 'name' | 'show_club'>
  save_dir: string | null
  last_saved: string | null
  save_error: string | null
  /** round-robin calendar: games entered / games in the calendar (null otherwise) */
  games_total: number | null
  games_played: number | null
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
  /** result from White's perspective (or forfeit code), null until entered */
  white_score: Score | null
}

/** A player not paired in a round */
export interface AbsentEntry {
  name: string
  /** points scored for the round */
  points: number
  reason: 'absent' | 'withdrawn' | 'late'
}

export interface RoundInfo {
  round: number
  win_value: number
  completed: boolean
  pairings: Pairing[]
  absent: AbsentEntry[]
}

export interface StandingEntry {
  rank: number
  name: string
  club: string | null
  elo: number
  pts: number
  color_diff: number
  tiebreaks: Record<string, number | null>
  withdrawn?: boolean
}

export interface CrosstableCell {
  round: number
  bye: boolean
  /** null: no result yet */
  kind?: 'game' | 'forfeit' | 'bye' | 'absent' | 'withdrawn' | 'late' | null
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
  tiebreaks: Record<string, number | null>
  cells: CrosstableCell[]
}

export interface Crosstable {
  after_round: number
  tiebreak_keys: string[]
  rows: CrosstableRow[]
}

/** Round-robin results grid (double-entry table), one cell per opponent */
export interface GridGame {
  round: number
  /** color of the row player */
  color: 'W' | 'B'
  /** row player's result, null until entered */
  score: number | null
  /** the game was not played (forfeit) */
  forfeit?: boolean
}

export interface GridRow {
  rank: number
  name: string
  club: string | null
  elo: number
  pts: number
  tiebreaks: Record<string, number | null>
  played: number
  /** same order as the rows; null on the diagonal */
  cells: (GridGame[] | null)[]
}

export interface ResultsGrid {
  legs: number
  tiebreak_keys: string[]
  games_total: number
  games_played: number
  rows: GridRow[]
}

/** Player registered during a round: joins when its results are validated */
export interface PendingLate {
  name: string
  elo: number
  club: string | null
  /** points of each missed round (0 or ½) */
  missed: number
}

export interface TournamentState {
  status: TournamentStatus
  players: PlayerInput[]
  pending_late: PendingLate[]
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

/** same limit as the server (larger grids would not fit on a page) */
export const MAX_ROUND_ROBIN_PLAYERS = 24

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
  Perf: 'Perf.',
}

/** tooltips of the tiebreak columns */
export const TIEBREAK_HELP: Record<string, string> = {
  Bu1: 'Buchholz tronqué : somme des points des adversaires, sans le plus faible',
  Bu: 'Buchholz : somme des points des adversaires',
  SB: 'Sonneborn-Berger : points des adversaires battus + moitié de ceux des nulles',
  Perf:
    "Performance : l'Elo qui aurait donné exactement ce score contre ces adversaires classés (vide à 100 %, à 0 % ou sans adversaire classé)",
}
