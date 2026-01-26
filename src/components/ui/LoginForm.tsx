import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { Loader2, Container, Lock, User } from 'lucide-react'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error, clearError } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return

    try {
      await login(username.trim(), password)
    } catch {
      // Error is handled by the store
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-700/50 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500/20 mb-4">
              <Container className="w-8 h-8 text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">WorkHub</h1>
            <p className="text-slate-400 mt-1">Gestione Piazzale Container 3D</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (error) clearError()
                  }}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Inserisci username"
                  disabled={isLoading}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) clearError()
                  }}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Inserisci password"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Accesso in corso...</span>
                </>
              ) : (
                <span>Accedi</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-500">
            BERLink Platform - WorkHub v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
