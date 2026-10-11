import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import type { RecentTournament } from '../types'
import { fmtDate } from '../format'

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
    <div className="card">
      <h2>Ouvrir un tournoi</h2>

      {recent.length > 0 && (
        <>
          <h3>Récents</h3>
          <ul className="recent-list">
            {recent.map((r) => (
              <li key={r.path}>
                <button className="dir-entry" onClick={() => onOpenFolder(r.path)} title={r.path}>
                  <span>
                    <b>{r.name}</b>
                    <br />
                    <span className="muted small">{r.path}</span>
                  </span>
                  <span className="muted small">{fmtDate(r.saved_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="actions">
        <button onClick={onBrowse}>Parcourir les dossiers…</button>
        <button className="secondary" onClick={() => fileInput.current?.click()}>
          Importer un fichier .json
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
    </div>
  )
}
