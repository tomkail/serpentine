import { useNotificationStore, type Notification } from '../../stores/notificationStore'
import styles from './Notifications.module.css'

export function Notifications() {
  const notifications = useNotificationStore(state => state.notifications)
  const dismiss = useNotificationStore(state => state.dismiss)
  
  if (notifications.length === 0) return null
  
  return (
    <div className={styles.container}>
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => dismiss(notification.id)}
        />
      ))}
    </div>
  )
}

interface NotificationToastProps {
  notification: Notification
  onDismiss: () => void
}

function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const { type, message, details, dismissable } = notification
  
  const icons: Record<string, string> = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✕'
  }
  
  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <span className={styles.icon}>{icons[type]}</span>
      <div className={styles.content}>
        <p className={styles.message}>{message}</p>
        {details && (
          <details className={styles.details}>
            <summary>Details</summary>
            <pre>{details}</pre>
          </details>
        )}
      </div>
      {dismissable && (
        <button className={styles.dismissButton} onClick={onDismiss}>
          ✕
        </button>
      )}
    </div>
  )
}



