// Parser for src/content/faq.md — a small, documented Markdown dialect.
// No dependency: only the constructs the FAQ needs (see the header of faq.md).

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'hint'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; classes: string[]; head: string[]; rows: string[][] }
  | { kind: 'points'; pros: string[]; cons: string[] }
  | { kind: 'pairs'; items: string[] }
  | { kind: 'glossary'; entries: [string, string][] }
  | { kind: 'quality'; chart: QualityChartData }
  | { kind: 'radars'; chart: RadarSet }
  | { kind: 'radar'; name: string }
  | { kind: 'pdf'; label: string }
  | { kind: 'toc' }

export interface QualityRow {
  name: string
  /** null = not measured */
  tau: number | null
  highlight: boolean
}

/** One simulation series, rescaled with its own references. */
export interface QualityGroup {
  title: string
  zero: number
  hundred: number
  rows: QualityRow[]
}

export interface QualityChartData {
  title: string
  zeroLabel: string
  hundredLabel: string
  groups: QualityGroup[]
  note: string
}

export interface RadarSystem {
  name: string
  scores: number[]
  highlight: boolean
}

export interface RadarSet {
  title: string
  criteria: { short: string; long: string }[]
  max: number
  reference: string | null
  systems: RadarSystem[]
  note: string
}

export interface Question {
  id: string
  q: string
  blocks: Block[]
}

export interface Section {
  id: string
  title: string
  blocks: Block[]
  questions: Question[]
}

export interface FaqDoc {
  title: string
  intro: Block[]
  sections: Section[]
  /** every :::araignees block, so [[araignee: …]] can find its data */
  radarSets: RadarSet[]
}

const HEADING_ID = /^(.*?)\s*\{#([\w-]+)\}\s*$/

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function heading(line: string, level: number): { title: string; id: string } {
  const raw = line.slice(level + 1).trim()
  const m = raw.match(HEADING_ID)
  return m ? { title: m[1], id: m[2] } : { title: raw, id: slug(raw) }
}

/** "clé: valeur" lines and "* nom | a | b" rows of a ::: block */
function splitFields(lines: string[]) {
  const fields: Record<string, string> = {}
  const rows: { cells: string[]; star: boolean }[] = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const field = t.match(/^([\p{L}-]+)\s*:\s*(.*)$/u)
    if (field && !t.includes('|')) {
      fields[field[1].toLowerCase()] = field[2]
    } else if (field && /^(critères|criteres|zéro|zero|cent)$/i.test(field[1])) {
      fields[field[1].toLowerCase()] = field[2]
    } else {
      const star = t.startsWith('*')
      rows.push({ cells: t.replace(/^\*\s*/, '').split('|').map((c) => c.trim()), star })
    }
  }
  return { fields, rows }
}

function num(s: string): number {
  return Number(s.replace(',', '.'))
}

/** "0.7086 | libellé", "0.7086" or just "libellé" */
function valueLabel(s: string | undefined, fallback: string) {
  const parts = (s ?? '').split('|').map((x) => x.trim())
  if (parts.length === 1 && isNaN(num(parts[0]))) return { value: 0, label: parts[0] || fallback }
  return { value: num(parts[0] || '0'), label: parts[1] || fallback }
}

function parseFenced(name: string, body: string[]): Block | null {
  switch (name) {
    case 'points': {
      const pros: string[] = []
      const cons: string[] = []
      for (const l of body) {
        const t = l.trim()
        if (t.startsWith('+')) pros.push(t.slice(1).trim())
        else if (t.startsWith('-')) cons.push(t.slice(1).trim())
      }
      return { kind: 'points', pros, cons }
    }
    case 'appariements':
      return {
        kind: 'pairs',
        items: body
          .join(',')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }
    case 'glossaire':
      return {
        kind: 'glossary',
        entries: body
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const i = l.indexOf(':')
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string]
          }),
      }
    case 'graphique-justesse': {
      // lines are read in order: each "série:" starts a new group of bars
      const chart: QualityChartData = { title: '', zeroLabel: '0', hundredLabel: '100', groups: [], note: '' }
      let defaults = { zero: 0, hundred: 1 }
      for (const line of body) {
        const t = line.trim()
        if (!t) continue
        const f = t.match(/^([\p{L}-]+)\s*:\s*(.*)$/u)
        const key = f?.[1].toLowerCase()
        if (key === 'titre') chart.title = f![2]
        else if (key === 'note') chart.note = f![2]
        else if (key === 'zéro' || key === 'zero') {
          const v = valueLabel(f![2], '0')
          chart.zeroLabel = v.label
          defaults = { ...defaults, zero: v.value }
        } else if (key === 'cent') {
          const v = valueLabel(f![2], '100')
          chart.hundredLabel = v.label
          defaults = { ...defaults, hundred: v.value }
        } else if (key === 'série' || key === 'serie') {
          const [title, zero, hundred] = f![2].split('|').map((x) => x.trim())
          chart.groups.push({ title, zero: num(zero), hundred: num(hundred), rows: [] })
        } else {
          if (chart.groups.length === 0) chart.groups.push({ title: '', ...defaults, rows: [] })
          const star = t.startsWith('*')
          const [name, value] = t.replace(/^\*\s*/, '').split('|').map((x) => x.trim())
          const tau = value === undefined || isNaN(num(value)) ? null : num(value)
          chart.groups[chart.groups.length - 1].rows.push({ name, tau, highlight: star })
        }
      }
      return { kind: 'quality', chart }
    }
    case 'araignees': {
      const { fields, rows } = splitFields(body)
      const criteria = (fields['critères'] ?? fields['criteres'] ?? '').split('|').map((c) => {
        const [short, long] = c.split('=').map((x) => x.trim())
        return { short, long: long || short }
      })
      return {
        kind: 'radars',
        chart: {
          title: fields['titre'] ?? '',
          criteria,
          max: fields['max'] ? num(fields['max']) : 5,
          reference: fields['référence'] ?? fields['reference'] ?? null,
          systems: rows.map((r) => ({
            name: r.cells[0],
            scores: r.cells.slice(1).map(num),
            highlight: r.star,
          })),
          note: fields['note'] ?? '',
        },
      }
    }
    default:
      return null
  }
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

/** Parse the body of a section/question into blocks. */
function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0
  let pendingClasses: string[] = []
  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()
    if (!t || t.startsWith('<!--')) {
      i++
      continue
    }
    // ::: fenced component
    if (t.startsWith(':::')) {
      const name = t.slice(3).trim().toLowerCase()
      const body: string[] = []
      i++
      while (i < lines.length && lines[i].trim() !== ':::') body.push(lines[i++])
      i++
      const b = parseFenced(name, body)
      if (b) blocks.push(b)
      continue
    }
    // [[shortcode]]
    const sc = t.match(/^\[\[\s*([\p{L}-]+)\s*(?::\s*(.*?))?\s*\]\]$/u)
    if (sc) {
      const name = sc[1].toLowerCase()
      if (name === 'sommaire') blocks.push({ kind: 'toc' })
      else if (name === 'pdf') blocks.push({ kind: 'pdf', label: sc[2] ?? 'PDF' })
      else if (name === 'araignee') blocks.push({ kind: 'radar', name: sc[2] ?? '' })
      i++
      continue
    }
    // {.class .class} before a table
    const cls = t.match(/^\{((?:\s*\.[\w-]+)+)\s*\}$/)
    if (cls) {
      pendingClasses = cls[1].trim().split(/\s+/).map((c) => c.slice(1))
      i++
      continue
    }
    // table
    if (t.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = lines[i++].trim()
        if (/^\|[\s:|-]+\|$/.test(r)) continue // separator line
        rows.push(parseTableRow(r))
      }
      blocks.push({ kind: 'table', classes: pendingClasses, head: rows[0] ?? [], rows: rows.slice(1) })
      pendingClasses = []
      continue
    }
    // lists (an indented line continues the previous item)
    const isUl = /^[-*]\s+/.test(t)
    const isOl = /^\d+[.)]\s+/.test(t)
    if (isUl || isOl) {
      const items: string[] = []
      const re = isUl ? /^[-*]\s+/ : /^\d+[.)]\s+/
      while (i < lines.length && lines[i].trim()) {
        const l = lines[i]
        if (re.test(l.trim()) && !/^\s{2,}/.test(l)) items.push(l.trim().replace(re, ''))
        else items[items.length - 1] += ' ' + l.trim()
        i++
      }
      blocks.push(isUl ? { kind: 'ul', items } : { kind: 'ol', items })
      continue
    }
    // note / hint
    if (t.startsWith('>')) {
      const parts: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        parts.push(lines[i++].trim().replace(/^>\s?/, ''))
      }
      blocks.push({ kind: 'hint', text: parts.join(' ') })
      continue
    }
    // paragraph
    const parts: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(:::|\[\[|\||>|[-*]\s|\d+[.)]\s|\{\.)/.test(lines[i].trim())) {
      parts.push(lines[i++].trim())
    }
    if (parts.length === 0) {
      // a line we do not recognise: keep it visible rather than dropping it
      parts.push(lines[i++].trim())
    }
    blocks.push({ kind: 'p', text: parts.join(' ') })
  }
  return blocks
}

export function parseFaq(source: string): FaqDoc {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const doc: FaqDoc = { title: '', intro: [], sections: [], radarSets: [] }
  let buffer: string[] = []
  let section: Section | null = null
  let question: Question | null = null
  let inComment = false

  function flush() {
    const blocks = parseBlocks(buffer)
    buffer = []
    if (question) question.blocks.push(...blocks)
    else if (section) section.blocks.push(...blocks)
    else doc.intro.push(...blocks)
    for (const b of blocks) if (b.kind === 'radars') doc.radarSets.push(b.chart)
  }

  for (const line of lines) {
    // HTML comments (possibly multi-line) are notes for the author
    if (inComment) {
      if (line.includes('-->')) inComment = false
      continue
    }
    if (line.trim().startsWith('<!--')) {
      if (!line.includes('-->')) inComment = true
      continue
    }
    if (line.startsWith('### ')) {
      flush()
      const h = heading(line, 3)
      question = { id: h.id, q: h.title, blocks: [] }
      section?.questions.push(question)
    } else if (line.startsWith('## ')) {
      flush()
      const h = heading(line, 2)
      question = null
      section = { id: h.id, title: h.title, blocks: [], questions: [] }
      doc.sections.push(section)
    } else if (line.startsWith('# ')) {
      flush()
      doc.title = line.slice(2).trim()
    } else {
      buffer.push(line)
    }
  }
  flush()
  return doc
}

// ------------------------------------------------------------------ inline
export type InlineNode =
  | string
  | { t: 'b' | 'i' | 'sup'; children: InlineNode[] }
  | { t: 'code'; text: string }
  | { t: 'a'; href: string; children: InlineNode[] }

const INLINE =
  /(\*\*(.+?)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*([^*\s][^*]*?)\*)|(\^([^^\s][^^]*?)\^)/

/** **gras**, *italique*, `code`, [lien](#ancre ou https://…), ^exposant^ */
export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = []
  let rest = text
  while (rest) {
    const m = rest.match(INLINE)
    if (!m || m.index === undefined) {
      out.push(rest)
      break
    }
    if (m.index > 0) out.push(rest.slice(0, m.index))
    if (m[1]) out.push({ t: 'b', children: parseInline(m[2]) })
    else if (m[3]) out.push({ t: 'code', text: m[4] })
    else if (m[5]) out.push({ t: 'a', href: m[7], children: parseInline(m[6]) })
    else if (m[8]) out.push({ t: 'i', children: parseInline(m[9]) })
    else if (m[10]) out.push({ t: 'sup', children: parseInline(m[11]) })
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}
