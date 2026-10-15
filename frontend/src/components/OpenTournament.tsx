import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import type { RecentTournament } from '../types'
import { fmtDate } from '../format'
import { Icon } from './Icon'

interface Props {
  onOpenFolder: (path: string) => void
  onBrowse: () => void
  onImportFile: (data: unknown) => void
  onError: (message: string) => void
}

export function OpenTournament({ onOpenFolder, onBrowse, onImportFile, onError }: Props) {
  const [recent, setRecent] = useState<RecentTournament[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.listRecent().then(setRecent).catch(() => setRecent([]))
  }, [])

  async function readFile(file: File) {
    try {
      onImportFile(JSON.parse(await file.text()))
    } catch {
      onError(`Le fichier « ${file.name} » n'est pas un fichier JSON valide.`)
    }
  }

  return (
    <section className="card card-open">
      <header className="card-head">
        <h2>Ouvrir un tournoi</h2>
      </header>

      {recent.length > 0 ? (
        <>
          <h3 className="section-label">Récents</h3>
          <ul className="recent-list">
            {recent.map((r) => (
              <li key={r.path}>
                <button className="recent-entry" onClick={() => onOpenFolder(r.path)} title={r.path}>
                  <Icon name="folder" className="recent-icon" />
                  <span className="recent-main">
                    <span className="recent-name">{r.name}</span>
                    <span className="recent-path">{r.path}</span>
                  </span>
                  <span className="recent-date">{fmtDate(r.saved_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="hint open-empty">Aucun tournoi enregistré récemment sur cet ordinateur.</p>
      )}

      <div className="actions">
        <button className="secondary" onClick={onBrowse}>
          <Icon name="folder-open" />
          Parcourir les dossiers…
        </button>
        <button className="ghost" onClick={() => fileInput.current?.click()}>
          <Icon name="file" />
          Importer un .json
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) readFile(f)
            e.target.value = ''
          }}
        />
      </div>
      <p className="hint">
        Un tournoi enregistré est un dossier contenant <code>tournoi.json</code> (l'état complet,
        rechargeable) ainsi que les appariements et grilles de chaque ronde.
      </p>
    </section>
  )
}
