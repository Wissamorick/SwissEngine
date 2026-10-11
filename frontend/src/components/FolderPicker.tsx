import { useEffect, useState } from 'react'
import * as api from '../api'
import type { DirListing } from '../types'

interface Props {
  mode: 'open' | 'save'
  title: string
  /** save mode: default name of the folder to create */
  defaultName?: string
  initialPath?: string
  busy?: boolean
  /** error coming from the confirm action (e.g. save failed) */
  actionError?: string | null
  onCancel: () => void
  /** open: path of the tournament folder · save: parent folder + folder name */
  onConfirm: (path: string, folderName: string) => void
}

function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`
}

// Browse the folders of the computer running the API (local app).
export function FolderPicker({
  mode,
  title,
  defaultName = '',
  initialPath,
  busy = false,
  actionError = null,
  onCancel,
  onConfirm,
}: Props) {
  const [listing, setListing] = useState<DirListing | null>(null)
  const [typedPath, setTypedPath] = useState('')
  const [folderName, setFolderName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)

  async function go(path?: string) {
    try {
      const l = await api.listDirectory(path)
      setListing(l)
      setTypedPath(l.path)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    go(initialPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cleanName = folderName.trim()

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>

        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault()
            go(typedPath)
          }}
        >
          <input
            type="text"
            value={typedPath}
            onChange={(e) => setTypedPath(e.target.value)}
            aria-label="Chemin du dossier"
          />
          <button type="submit" className="secondary">
            Aller
          </button>
        </form>

        {listing && (
          <div className="picker-shortcuts">
            <button className="link" disabled={!listing.parent} onClick={() => go(listing.parent ?? undefined)}>
              ↑ Dossier parent
            </button>
            <button className="link" onClick={() => go(listing.home)}>
              Dossier personnel
            </button>
            <button className="link" onClick={() => go(listing.default_dir)}>
              Documents
            </button>
            {listing.roots.length > 1 &&
              listing.roots.map((r) => (
                <button key={r} className="link" onClick={() => go(r)}>
                  {r}
                </button>
              ))}
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <ul className="dir-list">
          {listing?.entries.length === 0 && <li className="muted">(aucun sous-dossier)</li>}
          {listing?.entries.map((e) => (
            <li key={e.path}>
              <button
                className="dir-entry"
                onClick={() => go(e.path)}
                onDoubleClick={() => mode === 'open' && e.is_tournament && onConfirm(e.path, '')}
              >
                <span className="folder-icon" aria-hidden>
                  ▸
                </span>
                {e.name}
                {e.is_tournament && <span className="badge">tournoi</span>}
              </button>
            </li>
          ))}
        </ul>

        {mode === 'save' && listing && (
          <>
            <label>
              Nom du dossier du tournoi
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </label>
            <p className="hint">
              Dossier créé : <code>{joinPath(listing.path, cleanName || '…')}</code>
            </p>
          </>
        )}

        {mode === 'open' && listing && !listing.is_tournament && (
          <p className="hint">Choisissez un dossier marqué « tournoi » (il contient tournoi.json).</p>
        )}

        {actionError && <div className="error">{actionError}</div>}

        <div className="actions end">
          <button className="secondary" onClick={onCancel}>
            Annuler
          </button>
          {mode === 'save' ? (
            <button
              disabled={!listing || !cleanName || busy}
              onClick={() => listing && onConfirm(listing.path, cleanName)}
            >
              Enregistrer ici
            </button>
          ) : (
            <button
              disabled={!listing?.is_tournament || busy}
              onClick={() => listing && onConfirm(listing.path, '')}
            >
              Ouvrir ce tournoi
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
