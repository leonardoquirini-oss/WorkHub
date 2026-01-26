import { useNotificationStore } from '../../store/notificationStore'
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import type { Notification } from '../../types'

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: 'bg-green-500/20 border-green-500/50 text-green-400',
  error: 'bg-red-500/20 border-red-500/50 text-red-400',
  warning: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
}

function ToastItem({ notification }: { notification: Notification }) {
  const { removeNotification } = useNotificationStore()
  const Icon = iconMap[notification.type]

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border backdrop-blur-sm ${colorMap[notification.type]} shadow-lg animate-slide-in`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="flex-1 text-sm">{notification.message}</p>
      <button
        onClick={() => removeNotification(notification.id)}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function Toast() {
  const { notifications } = useNotificationStore()

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((notification) => (
        <ToastItem key={notification.id} notification={notification} />
      ))}
    </div>
  )
}
