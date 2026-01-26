import { useAuthStore } from '../../store/authStore'
import { SiteSelector } from '../ui/SiteSelector'
import { YardSelector } from '../ui/YardSelector'
import { Container, LogOut, User } from 'lucide-react'

export function Header() {
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
      {/* Left: Logo and title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Container className="w-6 h-6 text-primary-400" />
          <span className="text-lg font-semibold text-white">WorkHub</span>
        </div>
        <div className="w-px h-6 bg-slate-600 mx-2" />
        <SiteSelector />
        <YardSelector />
      </div>

      {/* Right: User info and logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-slate-300">
          <User className="w-4 h-4" />
          <span className="text-sm">{user?.name || user?.username}</span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          title="Esci"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
