import { useAuthStore } from '../../store/authStore'
import { LoginForm } from '../ui/LoginForm'
import { LoadingOverlay } from '../ui/LoadingOverlay'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return <LoadingOverlay message="Verifica autenticazione..." />
  }

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return <>{children}</>
}
