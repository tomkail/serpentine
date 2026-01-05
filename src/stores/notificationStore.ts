import { create } from 'zustand'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  details?: string
  timestamp: number
  dismissable: boolean
  autoDismiss: boolean
}

interface NotificationState {
  notifications: Notification[]
  
  // Actions
  notify: (type: NotificationType, message: string, options?: {
    details?: string
    dismissable?: boolean
    autoDismiss?: boolean
    duration?: number
  }) => void
  dismiss: (id: string) => void
  dismissAll: () => void
  
  // Convenience methods
  info: (message: string, details?: string) => void
  success: (message: string, details?: string) => void
  warning: (message: string, details?: string) => void
  error: (message: string, details?: string) => void
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  
  notify: (type, message, options = {}) => {
    const {
      details,
      dismissable = true,
      autoDismiss = type !== 'error',
      duration = type === 'error' ? 8000 : 4000
    } = options
    
    const id = crypto.randomUUID()
    const notification: Notification = {
      id,
      type,
      message,
      details,
      timestamp: Date.now(),
      dismissable,
      autoDismiss
    }
    
    set(state => ({
      notifications: [...state.notifications, notification]
    }))
    
    // Auto-dismiss after duration
    if (autoDismiss) {
      setTimeout(() => {
        get().dismiss(id)
      }, duration)
    }
  },
  
  dismiss: (id) => set(state => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  
  dismissAll: () => set({ notifications: [] }),
  
  // Convenience methods
  info: (message, details) => get().notify('info', message, { details }),
  success: (message, details) => get().notify('success', message, { details }),
  warning: (message, details) => get().notify('warning', message, { details }),
  error: (message, details) => get().notify('error', message, { details, autoDismiss: false })
}))

// Global error handler helper
export function reportError(error: unknown, context?: string): void {
  const store = useNotificationStore.getState()
  
  let message = 'An unexpected error occurred'
  let details: string | undefined
  
  if (error instanceof Error) {
    message = error.message
    details = error.stack
  } else if (typeof error === 'string') {
    message = error
  }
  
  if (context) {
    message = `${context}: ${message}`
  }
  
  console.error(`[StringPath Error] ${message}`, error)
  store.error(message, details)
}

