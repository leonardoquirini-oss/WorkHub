import { create } from 'zustand'
import type { Notification } from '../types'

interface NotificationStore {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

let notificationId = 0

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = `notification-${++notificationId}`
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000,
    }

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }))

    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id)
      }, newNotification.duration)
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }))
  },

  clearAll: () => set({ notifications: [] }),
}))

// Helper functions for easy notification creation
export const notify = {
  success: (message: string, duration?: number) => {
    useNotificationStore.getState().addNotification({ type: 'success', message, duration })
  },
  error: (message: string, duration?: number) => {
    useNotificationStore.getState().addNotification({ type: 'error', message, duration: duration ?? 8000 })
  },
  warning: (message: string, duration?: number) => {
    useNotificationStore.getState().addNotification({ type: 'warning', message, duration })
  },
  info: (message: string, duration?: number) => {
    useNotificationStore.getState().addNotification({ type: 'info', message, duration })
  },
}
