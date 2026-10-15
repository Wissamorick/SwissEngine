// Shared feedback components: modal shell, confirmation dialog, banners,
// empty states and loading indicators.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'
import loadingGif from '../assets/brand/logo-loading-176.gif'
import { LogoMark } from './Brand'

// ---------------------------------------------------------------- modal
interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md'
  /** role="alertdialog" for confirmations */
  alert?: boolean
}

export function Modal({ title, onClose, children, footer, size = 'md', alert = false }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    // focus the first field, else the primary button, else the panel
    const target =
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.current?.querySelector<HTMLElement>('input, select, textarea') ??
      panel.current
    target?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
      previous?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={panel}
        className={`modal modal-${size}`}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------- confirmation
export interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** the action discards data: red confirm button */
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/** Promise-based replacement for window.confirm, rendered in the app's style. */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  )

  function close(ok: boolean) {
    pending?.resolve(ok)
    setPending(null)
  }

  const element = pending && (
    <Modal
      title={pending.title}
      size="sm"
      alert
      onClose={() => close(false)}
      footer={
        <>
          <button type="button" className="secondary" onClick={() => close(false)}>
            {pending.cancelLabel ?? 'Annuler'}
          </button>
          <button
            type="button"
            className={pending.danger ? 'danger-solid' : undefined}
            onClick={() => close(true)}
            data-autofocus
          >
            {pending.confirmLabel ?? 'Confirmer'}
          </button>
        </>
      }
    >
      <div className="confirm-message">{pending.message}</div>
    </Modal>
  )

  return [confirm, element]
}

// ---------------------------------------------------------------- banner
type Tone = 'error' | 'success' | 'warning' | 'info'

const TONE_ICON: Record<Tone, IconName> = {
  error: 'alert',
  success: 'check',
  warning: 'alert',
  info: 'info',
}

export function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: Tone
  children: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div className={`banner banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={TONE_ICON[tone]} className="banner-icon" />
      <div className="banner-text">{children}</div>
      {onDismiss && (
        <button type="button" className="icon-button" onClick={onDismiss} aria-label="Masquer le message">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  )
}

// ----------------------------------------------------------- empty state
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p className="empty-text">{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- loading
/** Discreet inline indicator for short waits. */
export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </span>
  )
}

/** Thin red line under the header while any request is running. */
export function BusyBar({ active }: { active: boolean }) {
  return <div className={active ? 'busy-bar active' : 'busy-bar'} aria-hidden />
}

const OVERLAY_DELAY_MS = 700

/**
 * Long operations only (pairing computation, opening a saved tournament…):
 * the animated logo appears if the operation is still running after
 * OVERLAY_DELAY_MS, so quick requests never flash it.
 */
export function LongTaskOverlay({ label }: { label: string | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!label) {
      setVisible(false)
      return
    }
    const timer = window.setTimeout(() => setVisible(true), OVERLAY_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [label])

  if (!label || !visible) return null
  return (
    <div className="long-task" role="status" aria-live="polite">
      <div className="long-task-panel">
        <img className="long-task-anim" src={loadingGif} width={88} height={88} alt="" />
        <LogoMark size={88} className="long-task-still" />
        <p>{label}</p>
      </div>
    </div>
  )
}
