import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  message?: string
}

export function LoadingOverlay({ message = 'Caricamento...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
        <p className="mt-4 text-slate-400">{message}</p>
      </div>
    </div>
  )
}
