import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { SiteSelector } from '../ui/SiteSelector'
import { YardSelector } from '../ui/YardSelector'
import { FindContainer } from '../ui/FindContainer'
import { Container, LogOut, User } from 'lucide-react'
import type { RealtimeStatus } from '../../types'

const REALTIME: Record<RealtimeStatus, { color: string; label: string }> = {
  sse: { color: 'bg-green-400', label: 'Aggiornamenti in tempo reale' },
  polling: { color: 'bg-amber-400', label: 'Aggiornamento ogni 15 s (stream non disponibile)' },
  connecting: { color: 'bg-sky-400 animate-pulse', label: 'Connessione allo stream...' },
  offline: { color: 'bg-slate-500', label: 'Nessun aggiornamento automatico' },
}

export function Header() {
  const { user, logout } = useAuthStore()
  const realtime = useUIStore((s) => s.realtime)
  const rt = REALTIME[realtime]

  return (
    <header className="min-h-14 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 sm:px-4 py-2">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <Container className="w-6 h-6 text-primary-400" />
          <span className="text-lg font-semibold text-white hidden sm:inline">WorkHub</span>
        </div>
        <div className="w-px h-6 bg-slate-600 mx-1 hidden sm:block" />
        <SiteSelector />
        <YardSelector />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <FindContainer />
        <span className="flex items-center gap-1.5 text-xs text-slate-400" title={rt.label}>
          <span className={`w-2.5 h-2.5 rounded-full ${rt.color}`} />
        </span>
        <div className="hidden md:flex items-center gap-2 text-slate-300">
          <User className="w-4 h-4" />
          <span className="text-sm">{user?.name || user?.username}</span>
        </div>
        <button onClick={() => void logout()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg" title="Esci">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
