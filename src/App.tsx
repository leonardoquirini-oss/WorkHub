import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { AuthGuard } from './components/layout/AuthGuard'
import { AppLayout } from './components/layout/AppLayout'
import { Toast } from './components/ui/Toast'

function App() {
  const { initializeAuth } = useAuthStore()

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <>
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
      <Toast />
    </>
  )
}

export default App
