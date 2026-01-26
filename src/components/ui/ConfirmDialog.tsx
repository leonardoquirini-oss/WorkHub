import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  variant = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: {
      icon: 'bg-red-500/20 text-red-400',
      button: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      icon: 'bg-amber-500/20 text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
      icon: 'bg-blue-500/20 text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${styles.icon}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="font-medium text-white">{title}</span>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-slate-300">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-4 py-3 bg-slate-700/30 border-t border-slate-700">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
