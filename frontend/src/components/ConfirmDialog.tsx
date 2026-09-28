import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Diálogo modal nativo (<dialog>): foco preso, Esc fecha e o fundo fica inerte. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onCancel()
      }}
    >
      {open && (
        <>
          <div className="dialog__body">
            <h2 id={titleId}>{title}</h2>
            {children}
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--danger-solid"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              {confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
