import { useEffect, useState } from 'react'
import * as api from '../api'
import type { DirListing } from '../types'
import { Icon } from './Icon'
import { Banner, Modal } from './Feedback'

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

  const footer = (
    <>
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
    </>
  )

  return (
    <Modal title={title} onClose={onCancel} footer={footer}>
      <form
        className="path-bar"
        onSubmit={(e) => {
          e.preventDefault()
          go(typedPath)
        }}
      >
        <input
          type="text"
          className="mono"
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
          <button
            className="ghost sm"
            disabled={!listing.parent}
            onClick={() => go(listing.parent ?? undefined)}
          >
            <Icon name="up" />
            Dossier parent
          </button>
          <button className="ghost sm" onClick={() => go(listing.home)}>
            <Icon name="home" />
            Dossier personnel
          </button>
          <button className="ghost sm" onClick={() => go(listing.default_dir)}>
            <Icon name="folder" />
            Documents
          </button>
          {listing.roots.length > 1 &&
            listing.roots.map((r) => (
              <button key={r} className="ghost sm mono" onClick={() => go(r)}>
                {r}
              </button>
            ))}
        </div>
      )}

      {error && <Banner tone="error">{error}</Banner>}

      <ul className="dir-list">
        {listing?.entries.length === 0 && <li className="dir-empty">Aucun sous-dossier</li>}
        {listing?.entries.map((e) => (
          <li key={e.path}>
            <button
              className={e.is_tournament ? 'dir-entry is-tournament' : 'dir-entry'}
              onClick={() => go(e.path)}
              onDoubleClick={() => mode === 'open' && e.is_tournament && onConfirm(e.path, '')}
            >
              <Icon name="folder" className="dir-icon" />
              <span className="dir-name">{e.name}</span>
              {e.is_tournament && <span className="badge badge-brand">Tournoi</span>}
            </button>
          </li>
        ))}
      </ul>

      {mode === 'save' && listing && (
        <label className="field">
          <span className="field-label">Nom du dossier du tournoi</span>
          <input type="text" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
          <span className="field-help">
            Dossier créé : <code>{joinPath(listing.path, cleanName || '…')}</code>
          </span>
        </label>
      )}

      {mode === 'open' && listing && !listing.is_tournament && (
        <p className="hint">
          Choisissez un dossier marqué <span className="badge badge-brand">Tournoi</span> (il
          contient tournoi.json). Double-cliquez pour l'ouvrir directement.
        </p>
      )}
      {mode === 'open' && listing?.is_tournament && (
        <Banner tone="success">Ce dossier contient un tournoi enregistré.</Banner>
      )}

      {actionError && <Banner tone="error">{actionError}</Banner>}
    </Modal>
  )
}
