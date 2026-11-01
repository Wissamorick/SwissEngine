// Player list import (CSV / XLSX / ODS): column detection, name / Elo / club
// extraction and row checks. Pure functions, no React, no file access, so the
// whole logic can be tested on its own. Reading the files themselves is in
// readSheet.ts.

export type FieldKey = 'username' | 'fullName' | 'lastName' | 'firstName' | 'elo' | 'club'

export const FIELD_KEYS: FieldKey[] = ['username', 'fullName', 'lastName', 'firstName', 'elo', 'club']

export const FIELD_LABELS: Record<FieldKey, string> = {
  username: "Nom d'utilisateur",
  fullName: 'Nom complet',
  lastName: 'Nom',
  firstName: 'Prénom',
  elo: 'Elo',
  club: 'Club / équipe',
}

/** column index in the sheet, or null when the field is not used */
export type Mapping = Record<FieldKey, number | null>

export interface Sheet {
  name: string
  /** column titles (first non-empty row of the sheet) */
  header: string[]
  /** data rows, every row padded to header.length, cells trimmed */
  rows: string[][]
  /** line number of each data row in the file (first line = 1) */
  lines: number[]
}

// ---------------------------------------------------------------- headers
/** "Prénom (élève)" -> "prenom eleve" : lowercase, no accents, words only */
export function normalizeHeader(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Google Forms technical columns, contact details, personal data
const IGNORE_WORDS = [
  'horodateur', 'timestamp', 'email', 'mail', 'courriel', 'adresse', 'address',
  'telephone', 'tel', 'phone', 'portable', 'mobile', 'naissance', 'birth', 'birthday',
  'age', 'sexe', 'gender', 'date', 'heure', 'commentaire', 'commentaires', 'comment',
  'comments', 'remarque', 'remarques', 'message',
]
// identifiers that would otherwise look like a rating or a club ("N° FIDE", "Licence FFE", "Code club")
const ID_WORDS = ['id', 'ids', 'numero', 'num', 'n', 'no', 'nr', 'licence', 'license', 'matricule', 'code']
// online accounts: "Pseudo Lichess", "ID chess.com", "Discord" are usernames
const PLATFORM_WORDS = ['lichess', 'chess', 'chesscom', 'discord', 'steam', 'riot', 'epic', 'battlenet', 'psn', 'xbox', 'twitch', 'faceit']
const CLUB_WORDS = ['club', 'clubs', 'equipe', 'equipes', 'team', 'teams', 'clan', 'association', 'cercle', 'ecurie', 'guilde', 'guild']
const ELO_WORDS = ['elo', 'rating', 'ratings', 'classement', 'cote', 'cotation', 'mmr']
const USERNAME_WORDS = ['username', 'usernames', 'pseudo', 'pseudos', 'pseudonyme', 'login', 'identifiant', 'nickname', 'nick', 'gamertag', 'handle', 'compte', 'account']
const USERNAME_PHRASES = ['user name', 'nom d utilisateur', 'nom utilisateur', 'nom de joueur en ligne']
const FULLNAME_PHRASES = ['full name', 'nom complet', 'nom et prenom', 'prenom et nom']
const PLAYER_WORDS = ['joueur', 'joueuse', 'joueurs', 'player', 'players', 'participant', 'participante', 'competiteur', 'competitrice', 'concurrent', 'concurrente']
const LAST_WORDS = ['nom', 'noms', 'surname', 'lastname', 'famille']
const LAST_PHRASES = ['last name', 'family name']
const FIRST_WORDS = ['prenom', 'prenoms', 'firstname', 'forename', 'givenname']
const FIRST_PHRASES = ['first name', 'given name']

/** Which field a column title most likely holds ('ignore' = known useless column). */
export function classifyHeader(title: string): FieldKey | 'ignore' | null {
  const n = normalizeHeader(title)
  if (!n) return null
  const words = n.split(' ')
  const has = (list: string[]) => list.some((w) => words.includes(w))
  const phrase = (list: string[]) => list.some((p) => ` ${n} `.includes(` ${p} `))

  if (has(IGNORE_WORDS)) return 'ignore'
  if (has(PLATFORM_WORDS) && !has(ELO_WORDS) && !has(CLUB_WORDS)) return 'username'
  if (has(ID_WORDS)) return 'ignore'
  // before names: "Nom du club", "Nom de l'équipe" are clubs
  if (has(CLUB_WORDS)) return 'club'
  if (has(ELO_WORDS)) return 'elo'
  // before names: "Nom d'utilisateur" is a username
  if (has(USERNAME_WORDS) || phrase(USERNAME_PHRASES)) return 'username'
  if (phrase(FULLNAME_PHRASES)) return 'fullName'
  const last = has(LAST_WORDS) || phrase(LAST_PHRASES)
  const first = has(FIRST_WORDS) || phrase(FIRST_PHRASES)
  if (last && first) return 'fullName' // "Nom / Prénom", "Prénom Nom"
  if (first) return 'firstName'
  if (last) return 'lastName'
  if (has(['name', 'names']) || has(PLAYER_WORDS)) return 'fullName' // "Name", "Joueur"
  return null
}

export interface Detection {
  mapping: Mapping
  /** columns that all look like an Elo (more than one = nothing selected) */
  eloCandidates: number[]
  /** other fields matched by several columns: the first one is used */
  multiple: Partial<Record<FieldKey, number[]>>
}

export function emptyMapping(): Mapping {
  return { username: null, fullName: null, lastName: null, firstName: null, elo: null, club: null }
}

export function detectMapping(header: string[]): Detection {
  const found: Record<FieldKey, number[]> = {
    username: [], fullName: [], lastName: [], firstName: [], elo: [], club: [],
  }
  header.forEach((title, i) => {
    const kind = classifyHeader(title)
    if (kind && kind !== 'ignore') found[kind].push(i)
  })
  const mapping = emptyMapping()
  const multiple: Detection['multiple'] = {}
  for (const key of FIELD_KEYS) {
    const cols = found[key]
    if (key === 'elo') {
      // several possible Elo columns: do not guess, let the organiser choose
      mapping.elo = cols.length === 1 ? cols[0] : null
      continue
    }
    if (cols.length > 0) mapping[key] = cols[0]
    if (cols.length > 1) multiple[key] = cols
  }
  return { mapping, eloCandidates: found.elo.length > 1 ? found.elo : [], multiple }
}

/** At least one column gives a name. */
export function hasNameField(m: Mapping): boolean {
  return m.username !== null || m.fullName !== null || m.lastName !== null || m.firstName !== null
}

// ------------------------------------------------------------------ values
function clean(text: string | undefined): string {
  return (text ?? '').replace(/[\s  ]+/g, ' ').trim()
}

/**
 * Player name for one row. Priority:
 * username > "Nom, Prénom" > full name > Nom alone > Prénom alone.
 * An empty username falls back to the other fields.
 */
export function buildName(row: string[], m: Mapping): string {
  const get = (i: number | null) => (i === null ? '' : clean(row[i]))
  const username = get(m.username)
  if (username) return username
  const last = get(m.lastName)
  const first = get(m.firstName)
  if (last && first) return `${last}, ${first}`
  const full = get(m.fullName)
  if (full) return full
  return last || first
}

export type EloParse =
  | { kind: 'ok'; value: number }
  | { kind: 'missing' }
  | { kind: 'invalid'; raw: string }

/**
 * "1850", "1 850", "1850.0" and "1850 (FIDE)" give 1850. Empty cells are
 * missing; anything else ("NC", "1850 / 1700"…) is left to the organiser.
 */
export function parseElo(raw: string | undefined): EloParse {
  const text = clean(raw)
  if (!text) return { kind: 'missing' }
  const compact = text.replace(/ /g, '')
  if (/^\d+([.,]0+)?$/.test(compact)) return { kind: 'ok', value: parseInt(compact, 10) }
  // thousands separators: "1,850", "1.850", "1'850"
  if (/^\d{1,3}([,.']\d{3})+$/.test(compact)) return { kind: 'ok', value: parseInt(compact.replace(/\D/g, ''), 10) }
  const groups = text.match(/\d+/g) ?? []
  const ratings = groups.filter((g) => g.length >= 3 && g.length <= 4)
  if (ratings.length === 1 && groups.every((g) => g === ratings[0] || g.length < 3)) {
    return { kind: 'ok', value: parseInt(ratings[0], 10) }
  }
  return { kind: 'invalid', raw: text }
}

// -------------------------------------------------------------- draft rows
export interface DraftRow {
  /** stable key */
  id: number
  /** line number in the file (header = line 1), shown to the organiser */
  line: number
  include: boolean
  name: string
  /** text as typed: "" when missing */
  elo: string
  club: string
}

/** comparison key for duplicates: case, accents and spaces ignored */
export function nameKey(name: string): string {
  return normalizeHeader(name)
}

/**
 * One draft row per non-empty data row. A name that already exists (among
 * the registered players or earlier in the file) starts unticked.
 */
export function buildDraft(sheet: Sheet, m: Mapping, existingNames: string[]): DraftRow[] {
  const used = new Set(existingNames.map(nameKey))
  const draft: DraftRow[] = []
  sheet.rows.forEach((row, i) => {
    const name = buildName(row, m)
    const eloCell = m.elo === null ? '' : clean(row[m.elo])
    const club = m.club === null ? '' : clean(row[m.club])
    if (!name && !eloCell && !club) return // blank or irrelevant line
    const elo = parseElo(eloCell)
    const key = nameKey(name)
    const duplicate = !!key && used.has(key)
    if (key) used.add(key)
    draft.push({
      id: i,
      line: sheet.lines[i] ?? i + 2,
      include: !duplicate,
      name,
      elo: elo.kind === 'ok' ? String(elo.value) : elo.kind === 'invalid' ? elo.raw : '',
      club,
    })
  })
  return draft
}

export type RowProblem = 'name-empty' | 'name-reserved' | 'duplicate' | 'elo-missing' | 'elo-invalid'

export const PROBLEM_LABELS: Record<RowProblem, string> = {
  'name-empty': 'Nom manquant',
  'name-reserved': 'Nom « bye » réservé',
  duplicate: 'Doublon',
  'elo-missing': 'Elo manquant',
  'elo-invalid': 'Elo à corriger',
}

export function eloProblem(elo: string): RowProblem | null {
  const t = elo.trim()
  if (!t) return 'elo-missing'
  return /^\d+$/.test(t) ? null : 'elo-invalid'
}

/**
 * Problems of every row, recomputed from the current values. A duplicate is a
 * ticked row whose name matches a registered player or an earlier ticked row;
 * unticked rows are only reported as duplicates (they will not be imported).
 */
export function checkRows(rows: DraftRow[], existingNames: string[]): Map<number, RowProblem[]> {
  const taken = new Set(existingNames.map(nameKey))
  const result = new Map<number, RowProblem[]>()
  for (const r of rows) {
    const problems: RowProblem[] = []
    const key = nameKey(r.name)
    if (!r.name.trim()) problems.push('name-empty')
    else if (r.name.trim().toLowerCase() === 'bye') problems.push('name-reserved')
    if (key && taken.has(key)) problems.push('duplicate')
    if (r.include) {
      if (key) taken.add(key)
      const e = eloProblem(r.elo)
      if (e) problems.push(e)
    }
    result.set(r.id, problems)
  }
  return result
}

export interface ImportSummary {
  ready: number
  toFix: number
  eloMissing: number
  duplicates: number
  skipped: number
}

export function summarize(rows: DraftRow[], problems: Map<number, RowProblem[]>): ImportSummary {
  const s: ImportSummary = { ready: 0, toFix: 0, eloMissing: 0, duplicates: 0, skipped: 0 }
  for (const r of rows) {
    const p = problems.get(r.id) ?? []
    if (!r.include) {
      s.skipped++
      if (p.includes('duplicate')) s.duplicates++
      continue
    }
    if (p.length === 0) s.ready++
    else s.toFix++
    if (p.includes('elo-missing') || p.includes('elo-invalid')) s.eloMissing++
    if (p.includes('duplicate')) s.duplicates++
  }
  return s
}

/** Players ready to send to the server, or null while a ticked row has a problem. */
export function toPlayers(
  rows: DraftRow[],
  problems: Map<number, RowProblem[]>,
  withClub: boolean,
): { name: string; elo: number; club: string | null }[] | null {
  const chosen = rows.filter((r) => r.include)
  if (chosen.length === 0) return null
  if (chosen.some((r) => (problems.get(r.id) ?? []).length > 0)) return null
  return chosen.map((r) => ({
    name: r.name.trim(),
    elo: parseInt(r.elo.trim(), 10),
    club: withClub && r.club.trim() ? r.club.trim() : null,
  }))
}

// --------------------------------------------------------------------- CSV
/** Field separator of a CSV text: the most frequent of ; , tab | in the first line. */
export function guessDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  let best = ','
  let bestCount = 0
  for (const d of [';', ',', '\t', '|']) {
    let count = 0
    let quoted = false
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted
      else if (ch === d && !quoted) count++
    }
    if (count > bestCount) {
      best = d
      bestCount = count
    }
  }
  return best
}

/** RFC 4180 CSV (quotes, doubled quotes, line breaks inside quotes). */
export function parseCsv(text: string, delimiter = guessDelimiter(text)): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/**
 * Raw grid -> Sheet: first non-empty row = titles, empty titles named after
 * the column. firstLine: file line number of grid[0] (spreadsheets may not
 * start at row 1).
 */
export function toSheet(name: string, grid: unknown[][], firstLine = 1): Sheet | null {
  const cells = grid.map((r) => (r ?? []).map((c) => (c === null || c === undefined ? '' : String(c).trim())))
  const headerIndex = cells.findIndex((r) => r.some((c) => c !== ''))
  if (headerIndex < 0) return null
  const width = Math.max(...cells.slice(headerIndex).map((r) => r.length))
  const header = Array.from({ length: width }, (_, i) => cells[headerIndex][i] || `Colonne ${columnLetter(i)}`)
  const rows: string[][] = []
  const lines: number[] = []
  for (let k = headerIndex + 1; k < cells.length; k++) {
    if (!cells[k].some((c) => c !== '')) continue
    rows.push(Array.from({ length: width }, (_, i) => cells[k][i] ?? ''))
    lines.push(k + firstLine)
  }
  return { name, header, rows, lines }
}

export function columnLetter(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
