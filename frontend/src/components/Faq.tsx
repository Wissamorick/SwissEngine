// FAQ & documentation tab.
// The text lives in src/content/faq.md (Markdown, see the guide at the top of
// that file). This component only renders it, with the app's components.

import { Fragment, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import faqSource from '../content/faq.md?raw'
import { parseFaq, parseInline } from './faq/parse'
import type { Block, FaqDoc, InlineNode, QualityChartData, QualityGroup } from './faq/parse'
import { Radar, RadarGrid } from './faq/Radar'

const PDF_URL = `${import.meta.env.BASE_URL}Pheng_New_Pairing_System.pdf`

interface Props {
  /** id of a section or question to open and scroll to */
  anchor?: string | null
}

// ---------------------------------------------------------------- inline
function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((n, i) => {
    if (typeof n === 'string') return <Fragment key={i}>{n}</Fragment>
    switch (n.t) {
      case 'b':
        return <b key={i}>{renderInline(n.children)}</b>
      case 'i':
        return <i key={i}>{renderInline(n.children)}</i>
      case 'sup':
        return <sup key={i}>{renderInline(n.children)}</sup>
      case 'code':
        return <code key={i}>{n.text}</code>
      case 'a': {
        const external = /^https?:/.test(n.href)
        return (
          <a
            key={i}
            href={n.href}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {renderInline(n.children)}
          </a>
        )
      }
    }
  })
}

const md = (text: string) => renderInline(parseInline(text))

// ------------------------------------------------------------ components
function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="pros-cons">
      <div>
        <div className="pc-title pc-pros">Points forts</div>
        <ul>
          {pros.map((p) => (
            <li key={p}>{md(p)}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="pc-title pc-cons">Points faibles</div>
        <ul>
          {cons.map((c) => (
            <li key={c}>{md(c)}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** "1 – 6" style example of who meets whom in a group of 10 players */
function PairingExample({ pairs }: { pairs: string[] }) {
  return (
    <div className="pairing-example" aria-label="Exemple d'appariements">
      {pairs.map((p) => (
        <span key={p} className="pe-chip">
          {p}
        </span>
      ))}
    </div>
  )
}

// Ranking quality: Kendall tau-b rescaled between the references of each
// simulation series (0 = random pairings, 100 = round-robin), see faq.md.
function QualityChart({ data }: { data: QualityChartData }) {
  const scoreOf = (g: QualityGroup, tau: number) =>
    Math.round(((tau - g.zero) / (g.hundred - g.zero)) * 100)
  const all = data.groups.flatMap((g) =>
    g.rows.filter((r) => r.tau !== null).map((r) => scoreOf(g, r.tau as number)),
  )
  const lowest = Math.min(0, ...all)
  const min = lowest < 0 ? lowest - 8 : 0
  const max = Math.max(104, ...all.map((s) => s + 4))
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const zero = pct(0)
  return (
    <figure className="quality-chart">
      <figcaption>{md(data.title)}</figcaption>
      {data.groups.map((g, gi) => (
        <div className="qc-group" key={gi}>
          {g.title && <p className="qc-group-title">{md(g.title)}</p>}
          <div className="qc-rows">
            {g.rows.map((row) => {
              if (row.tau === null) {
                return (
                  <div className="qc-row is-missing" key={row.name}>
                    <div className="qc-label">{row.name}</div>
                    <div className="qc-track">
                      <div className="qc-zero" style={{ left: `${zero}%` }} />
                      <div className="qc-hundred" style={{ left: `${pct(100)}%` }} />
                      <span className="qc-missing" style={{ left: `calc(${zero}% + 8px)` }}>
                        non mesuré
                      </span>
                    </div>
                    <div className="qc-value">–</div>
                  </div>
                )
              }
              const score = scoreOf(g, row.tau)
              const left = score >= 0 ? zero : pct(score)
              const width = Math.abs(pct(score) - zero)
              return (
                <div
                  className="qc-row"
                  key={row.name}
                  title={`${row.name} : ${score} (Kendall τb = ${row.tau})`}
                >
                  <div className="qc-label">{row.name}</div>
                  <div className="qc-track">
                    <div className="qc-zero" style={{ left: `${zero}%` }} />
                    <div className="qc-hundred" style={{ left: `${pct(100)}%` }} />
                    <div
                      className={`qc-bar${row.highlight ? ' hl' : ''}${score < 0 ? ' neg' : ''}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </div>
                  <div className="qc-value">{score < 0 ? `−${-score}` : score}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="qc-axis">
        <span style={{ left: `${pct(0)}%` }}>0 · {data.zeroLabel}</span>
        <span className="qc-axis-end" style={{ left: `${pct(100)}%` }}>
          100 · {data.hundredLabel}
        </span>
      </div>
      {data.note && <p className="hint">{md(data.note)}</p>}
    </figure>
  )
}

// ---------------------------------------------------------------- blocks
function Blocks({ blocks, doc }: { blocks: Block[]; doc: FaqDoc }) {
  const out: ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const key = i
    switch (b.kind) {
      case 'p':
        out.push(<p key={key}>{md(b.text)}</p>)
        break
      case 'hint':
        out.push(
          <p key={key} className="hint">
            {md(b.text)}
          </p>,
        )
        break
      case 'ul':
        out.push(
          <ul key={key}>
            {b.items.map((it, k) => (
              <li key={k}>{md(it)}</li>
            ))}
          </ul>,
        )
        break
      case 'ol':
        out.push(
          <ol key={key} className="steps">
            {b.items.map((it, k) => (
              <li key={k}>{md(it)}</li>
            ))}
          </ol>,
        )
        break
      case 'table':
        out.push(
          <div key={key} className="table-scroll">
            <table className={['advice', ...b.classes].join(' ')}>
              <thead>
                <tr>
                  {b.head.map((h, k) => (
                    <th key={k}>{md(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, k) => (
                  <tr key={k}>
                    {r.map((c, j) => (
                      <td key={j}>{md(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        )
        break
      case 'points':
        out.push(<ProsCons key={key} pros={b.pros} cons={b.cons} />)
        break
      case 'pairs':
        out.push(<PairingExample key={key} pairs={b.items} />)
        break
      case 'glossary':
        out.push(
          <dl key={key} className="glossary">
            {b.entries.map(([term, def]) => (
              <Fragment key={term}>
                <dt>{md(term)}</dt>
                <dd>{md(def)}</dd>
              </Fragment>
            ))}
          </dl>,
        )
        break
      case 'quality':
        out.push(<QualityChart key={key} data={b.chart} />)
        break
      case 'radars':
        out.push(<RadarGrid key={key} set={b.chart} />)
        break
      case 'radar': {
        const set = doc.radarSets.find((s) => s.systems.some((x) => x.name === b.name))
        const system = set?.systems.find((x) => x.name === b.name)
        if (!set || !system) {
          out.push(
            <p key={key} className="hint">
              (Diagramme introuvable : « {b.name} » ne figure dans aucun bloc :::araignees.)
            </p>,
          )
          break
        }
        // a radar followed by its points forts/faibles: shown side by side
        const next = blocks[i + 1]
        if (next?.kind === 'points') {
          out.push(
            <div key={key} className="system-profile">
              <div>
                <Radar set={set} system={system} showName={false} />
              </div>
              <ProsCons pros={next.pros} cons={next.cons} />
            </div>,
          )
          i++
        } else {
          out.push(<Radar key={key} set={set} system={system} />)
        }
        break
      }
      case 'pdf':
        out.push(
          <p key={key}>
            <a className="pdf-link" href={PDF_URL} target="_blank" rel="noreferrer">
              {b.label}
            </a>
          </p>,
        )
        break
      case 'toc':
        out.push(
          <nav key={key} className="faq-toc" aria-label="Sommaire">
            {doc.sections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.title}
              </a>
            ))}
          </nav>,
        )
        break
    }
  }
  return <>{out}</>
}

// ------------------------------------------------------------------ page
export function Faq({ anchor }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const doc = useMemo(() => parseFaq(faqSource), [])

  // Open and scroll to the requested section / question
  useEffect(() => {
    if (!anchor) {
      window.scrollTo({ top: 0 })
      return
    }
    const el = document.getElementById(anchor)
    if (!el) return
    if (el instanceof HTMLDetailsElement) el.open = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [anchor])

  // In-page links (#id) also open the question they point to
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest('a')
      const href = a?.getAttribute('href')
      if (!href?.startsWith('#')) return
      const target = document.getElementById(href.slice(1))
      if (target instanceof HTMLDetailsElement) target.open = true
    }
    const node = root.current
    node?.addEventListener('click', onClick)
    return () => node?.removeEventListener('click', onClick)
  }, [])

  function toggleAll(open: boolean) {
    root.current?.querySelectorAll<HTMLDetailsElement>('details.faq-q').forEach((d) => {
      d.open = open
    })
  }

  return (
    <div className="faq" ref={root}>
      <div className="faq-intro">
        <p className="eyebrow">Aide</p>
        <h1 className="page-title">{doc.title}</h1>
        <Blocks blocks={doc.intro} doc={doc} />
        <div className="actions">
          <button className="secondary sm" onClick={() => toggleAll(true)}>
            Tout déplier
          </button>
          <button className="ghost sm" onClick={() => toggleAll(false)}>
            Tout replier
          </button>
        </div>
      </div>

      {doc.sections.map((s) => (
        <section key={s.id} className="faq-section" id={s.id}>
          <h2>{s.title}</h2>
          <Blocks blocks={s.blocks} doc={doc} />
          {s.questions.map((q) => (
            <details key={q.id} className="faq-q" id={q.id}>
              <summary>{q.q}</summary>
              <div className="faq-a">
                <Blocks blocks={q.blocks} doc={doc} />
              </div>
            </details>
          ))}
        </section>
      ))}
    </div>
  )
}

